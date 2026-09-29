import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../src/lib/session.js', import.meta.url), 'utf8')
  .replace("import { supabase } from './supabase';", '')
  .replaceAll('export ', '');

function setup({ getSession, getUser, profile = async () => ({ data: { role: 'petugas' } }) }) {
  const makeStorage = () => {
    const values = new Map();
    return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
  };
  const context = vm.createContext({
    localStorage: makeStorage(), sessionStorage: makeStorage(),
    navigator: { onLine: true }, window: { setTimeout: () => 0 },
    console: { warn() {} },
    supabase: {
      auth: { getSession, getUser, signOut: async () => {} },
      from: () => ({ select: () => ({ eq: () => ({ maybeSingle: profile }) }) }),
    },
  });
  return vm.runInContext(source + '\n({ restoreUserSession, cacheUser, clearCachedUser, getCachedUser })', context);
}

test('late profile response cannot recreate user cache after logout', async () => {
  let completeProfile;
  let profileStarted;
  const started = new Promise(resolve => { profileStarted = resolve; });
  const api = setup({
    getSession: async () => ({ data: { session: { user: { id: 'old-user' } } } }),
    profile: () => { profileStarted(); return new Promise(resolve => { completeProfile = resolve; }); },
  });
  api.cacheUser({ id: 'old-user' });
  let current = true;
  const recovery = api.restoreUserSession({ isCurrent: () => current });
  await started;
  current = false;
  api.clearCachedUser();
  completeProfile({ data: { role: 'petugas' } });
  assert.equal((await recovery).status, 'cancelled');
  assert.equal(api.getCachedUser(), null);
});

test('obsolete invalid-session response cannot clear a newer user cache', async () => {
  let finish;
  const api = setup({ getSession: () => new Promise(resolve => { finish = resolve; }) });
  api.cacheUser({ id: 'old-user' });
  let current = true;
  const recovery = api.restoreUserSession({ isCurrent: () => current });
  current = false;
  api.cacheUser({ id: 'new-user' });
  finish({ error: { code: 'invalid_refresh_token' } });
  assert.equal((await recovery).status, 'cancelled');
  assert.equal(api.getCachedUser().id, 'new-user');
});

test('temporary network failure preserves the current cached session', async () => {
  const api = setup({ getSession: async () => { throw new Error('Network unavailable'); } });
  api.cacheUser({ id: 'current-user' });
  assert.equal((await api.restoreUserSession()).status, 'degraded');
  assert.equal(api.getCachedUser().id, 'current-user');
});

test('confirmed invalid session still clears the current user', async () => {
  const api = setup({ getSession: async () => ({ error: { code: 'invalid_refresh_token' } }) });
  api.cacheUser({ id: 'current-user' });
  assert.equal((await api.restoreUserSession()).status, 'unauthenticated');
  assert.equal(api.getCachedUser(), null);
});

test('admin access requires a server profile and matching authenticated identity', async () => {
  const api = setup({
    getSession: async () => ({ data: { session: { user: { id: 'admin' } } } }),
    getUser: async () => ({ data: { user: { id: 'admin' } } }),
    profile: async () => ({ data: { role: 'admin' } }),
  });
  const result = await api.restoreUserSession();
  assert.equal(result.status, 'authenticated');
  assert.equal(result.adminVerified, true);
});

test('an identity mismatch cannot authorize administrator navigation', async () => {
  const api = setup({
    getSession: async () => ({ data: { session: { user: { id: 'admin' } } } }),
    getUser: async () => ({ data: { user: { id: 'other' } } }),
    profile: async () => ({ data: { role: 'admin' } }),
  });
  api.cacheUser({ id: 'admin', role: 'admin' });
  assert.equal((await api.restoreUserSession()).status, 'unauthenticated');
  assert.equal(api.getCachedUser(), null);
});

test('temporary admin verification failure preserves session but not admin authorization', async () => {
  const api = setup({
    getSession: async () => ({ data: { session: { user: { id: 'admin' } } } }),
    getUser: async () => { throw new Error('Network unavailable'); },
    profile: async () => ({ data: { role: 'admin' } }),
  });
  api.cacheUser({ id: 'admin', role: 'admin' });
  const result = await api.restoreUserSession();
  assert.equal(result.status, 'degraded');
  assert.notEqual(result.adminVerified, true);
  assert.equal(api.getCachedUser().id, 'admin');
});

test('late administrator verification cannot restore an account after logout', async () => {
  let complete;
  let notify;
  const started = new Promise(resolve => { notify = resolve; });
  const api = setup({
    getSession: async () => ({ data: { session: { user: { id: 'admin' } } } }),
    getUser: () => { notify(); return new Promise(resolve => { complete = resolve; }); },
    profile: async () => ({ data: { role: 'admin' } }),
  });
  let current = true;
  const request = api.restoreUserSession({ isCurrent: () => current });
  await started;
  current = false;
  api.clearCachedUser();
  complete({ data: { user: { id: 'admin' } } });
  assert.equal((await request).status, 'cancelled');
  assert.equal(api.getCachedUser(), null);
});
