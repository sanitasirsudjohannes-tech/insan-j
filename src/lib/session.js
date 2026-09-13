import { supabase } from './supabase';

const CURRENT_USER_KEY = 'currentUser';
const SESSION_TIMEOUT_MS = 12000;

const timeoutError = () => Object.assign(new Error('Pemulihan sesi terlalu lama.'), {
  code: 'session_timeout',
});

const withTimeout = promise => Promise.race([
  promise,
  new Promise((_, reject) => window.setTimeout(() => reject(timeoutError()), SESSION_TIMEOUT_MS)),
]);

export const getCachedUser = () => {
  const value = localStorage.getItem(CURRENT_USER_KEY) || sessionStorage.getItem(CURRENT_USER_KEY);
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    clearCachedUser();
    return null;
  }
};

export const cacheUser = user => {
  const value = JSON.stringify(user);
  localStorage.setItem(CURRENT_USER_KEY, value);
  sessionStorage.setItem(CURRENT_USER_KEY, value);
};

export const clearCachedUser = () => {
  localStorage.removeItem(CURRENT_USER_KEY);
  sessionStorage.removeItem(CURRENT_USER_KEY);
};

const isInvalidSessionError = error => {
  const code = String(error?.code || '').toLowerCase();
  const name = String(error?.name || '').toLowerCase();
  return [
    'refresh_token_not_found',
    'invalid_refresh_token',
    'session_not_found',
  ].includes(code) || name === 'authsessionmissingerror';
};

const isMissingProfileError = error => error?.code === 'profile_not_found';

export async function loadUserProfile(userId) {
  const { data, error } = await withTimeout(
    supabase
      .from('profiles')
      .select('username, nama, role')
      .eq('id', userId)
      .maybeSingle(),
  );

  if (error) throw error;
  if (!data) {
    throw Object.assign(new Error('Profil pengguna tidak ditemukan.'), {
      code: 'profile_not_found',
    });
  }

  return {
    id: userId,
    username: data.username,
    nama: data.nama,
    role: data.role,
  };
}

export async function restoreUserSession() {
  const cachedUser = getCachedUser();

  if (!navigator.onLine) {
    return cachedUser
      ? { status: 'offline', user: cachedUser }
      : { status: 'error', user: null, reason: 'offline' };
  }

  let session = null;
  try {
    const current = await withTimeout(supabase.auth.getSession());
    if (current.error) throw current.error;
    session = current.data?.session || null;

    if (!session && cachedUser) {
      const refreshed = await withTimeout(supabase.auth.refreshSession());
      if (refreshed.error) throw refreshed.error;
      session = refreshed.data?.session || null;
    }

    if (!session?.user) {
      clearCachedUser();
      return { status: 'unauthenticated', user: null };
    }

    const user = await loadUserProfile(session.user.id);
    cacheUser(user);
    return { status: 'authenticated', user };
  } catch (error) {
    if (isInvalidSessionError(error) || isMissingProfileError(error)) {
      clearCachedUser();
      if (isMissingProfileError(error)) {
        supabase.auth.signOut({ scope: 'local' }).catch(() => {});
      }
      return {
        status: 'unauthenticated',
        user: null,
        reason: isMissingProfileError(error) ? 'profile_missing' : 'session_invalid',
      };
    }

    if (cachedUser && (!session?.user || cachedUser.id === session.user.id)) {
      console.warn('Sesi belum dapat diverifikasi; cache pengguna tetap digunakan.', {
        reason: error?.code || error?.name || 'temporary_error',
      });
      return { status: 'degraded', user: cachedUser, reason: 'temporary_error' };
    }

    console.warn('Pemulihan sesi gagal sementara.', {
      reason: error?.code || error?.name || 'temporary_error',
    });
    return { status: 'error', user: null, reason: 'temporary_error' };
  }
}
