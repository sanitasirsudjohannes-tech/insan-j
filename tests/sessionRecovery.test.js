import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../src/lib/session.js', import.meta.url), 'utf8')
  .replace("import { supabase } from './supabase';", '')
  .replaceAll('export ', '');

function setup({ getSession, profile = async () => ({ data: { role: 'petugas' } }) }) {
  const makeStorage = () => {
    const values = new Map();
    return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
  };
  const context = vm.createContext({
    localStorage: makeStorage(), sessionStorage: makeStorage(),
    navigator: { onLine: true }, window: { setTimeout: () => 0 },
    console: { warn() {} },
    supabase: {
      auth: { getSession, signOut: async () => {} },
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
