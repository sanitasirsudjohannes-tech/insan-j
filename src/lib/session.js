import { supabase } from './supabase';
import { withTimeout } from './asyncTimeout';

const CURRENT_USER_KEY = 'currentUser';
const SESSION_TIMEOUT_MS = 10000;
const PROFILE_TIMEOUT_MS = 8000;
const RESTORE_DEADLINE_MS = 15000;
const FRESH_PROFILE_MS = 30_000;

// Cache in-memory saja: hilang saat reload, sehingga verifikasi penuh tetap
// dilakukan ketika aplikasi dibuka kembali. Berguna untuk mencegah pengambilan
// profil dua kali tepat setelah login dan dashboard baru dimuat.
let freshProfile = null;

const timeoutOptions = (message, code = 'session_timeout') => ({ message, code });

export const getCachedUser = () => {
  let value = null;
  try {
    value = localStorage.getItem(CURRENT_USER_KEY) || sessionStorage.getItem(CURRENT_USER_KEY);
  } catch {
    // Storage dapat diblokir browser. Perlakukan seperti belum ada cache.
    return null;
  }

  if (!value) return null;

  try {
    return JSON.parse(value);
  } catch {
    clearCachedUser();
    return null;
  }
};

export const cacheUser = (user, { verified = false } = {}) => {
  const value = JSON.stringify(user);

  try {
    localStorage.setItem(CURRENT_USER_KEY, value);
  } catch {
    // Kuota penuh atau storage diblokir. Login tetap boleh berlanjut.
  }

  try {
    sessionStorage.setItem(CURRENT_USER_KEY, value);
  } catch {
    // Cache sessionStorage bersifat opsional.
  }

  if (verified && user?.id) {
    freshProfile = { userId: user.id, user, verifiedAt: Date.now() };
  }
};

export const clearCachedUser = () => {
  freshProfile = null;

  try {
    localStorage.removeItem(CURRENT_USER_KEY);
  } catch {
    // Abaikan storage yang diblokir.
  }

  try {
    sessionStorage.removeItem(CURRENT_USER_KEY);
  } catch {
    // Abaikan storage yang diblokir.
  }
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

const isAdminRole = role => String(role || '').trim().toLowerCase() === 'admin';

const getFreshProfile = userId => {
  if (!freshProfile || freshProfile.userId !== userId) return null;
  if (Date.now() - freshProfile.verifiedAt > FRESH_PROFILE_MS) {
    freshProfile = null;
    return null;
  }
  return freshProfile.user;
};

export async function loadUserProfile(userId) {
  const { data, error } = await withTimeout(
    supabase
      .from('profiles')
      .select('username, nama, role')
      .eq('id', userId)
      .maybeSingle(),
    PROFILE_TIMEOUT_MS,
    timeoutOptions('Profil pengguna terlalu lama dimuat.'),
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

async function restoreUserSessionInternal(isCurrent) {
  const cancelled = () => ({ status: 'cancelled', user: null });
  if (!isCurrent()) return cancelled();

  const cachedUser = getCachedUser();

  if (!navigator.onLine) {
    return cachedUser
      ? { status: 'offline', user: cachedUser }
      : { status: 'error', user: null, reason: 'offline' };
  }

  let session = null;
  try {
    const current = await withTimeout(
      supabase.auth.getSession(),
      SESSION_TIMEOUT_MS,
      timeoutOptions('Pemeriksaan sesi terlalu lama.'),
    );
    if (!isCurrent()) return cancelled();
    if (current.error) throw current.error;
    session = current.data?.session || null;

    if (!session && cachedUser) {
      const refreshed = await withTimeout(
        supabase.auth.refreshSession(),
        SESSION_TIMEOUT_MS,
        timeoutOptions('Pembaruan sesi terlalu lama.'),
      );
      if (!isCurrent()) return cancelled();
      if (refreshed.error) throw refreshed.error;
      session = refreshed.data?.session || null;
    }

    if (!session?.user) {
      clearCachedUser();
      return { status: 'unauthenticated', user: null };
    }

    const user = getFreshProfile(session.user.id) || await loadUserProfile(session.user.id);
    if (!isCurrent()) return cancelled();

    // Verifikasi privileged identity sekali per recovery, dipakai bersama
    // oleh seluruh protected route.
    let adminVerified = false;
    if (isAdminRole(user.role)) {
      const verified = await withTimeout(
        supabase.auth.getUser(),
        SESSION_TIMEOUT_MS,
        timeoutOptions('Verifikasi administrator terlalu lama.'),
      );
      if (!isCurrent()) return cancelled();
      if (verified.error) throw verified.error;
      if (verified.data?.user?.id !== session.user.id) {
        throw Object.assign(new Error('Identitas sesi administrator tidak cocok.'), { code: 'session_not_found' });
      }
      adminVerified = true;
    }

    if (!isCurrent()) return cancelled();
    cacheUser(user, { verified: true });
    return { status: 'authenticated', user, adminVerified };
  } catch (error) {
    if (!isCurrent()) return cancelled();
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

export async function restoreUserSession({ isCurrent = () => true } = {}) {
  let expired = false;
  const isActive = () => !expired && isCurrent();

  try {
    return await withTimeout(
      restoreUserSessionInternal(isActive),
      RESTORE_DEADLINE_MS,
      timeoutOptions('Pemulihan sesi terlalu lama.'),
    );
  } catch (error) {
    expired = true;
    if (!isCurrent()) return { status: 'cancelled', user: null };

    const cachedUser = getCachedUser();
    if (cachedUser) {
      console.warn('Pemulihan sesi melewati batas waktu; cache pengguna tetap digunakan.', {
        reason: error?.code || error?.name || 'session_timeout',
      });
      return { status: 'degraded', user: cachedUser, reason: 'temporary_error' };
    }

    console.warn('Pemulihan sesi gagal sementara.', {
      reason: error?.code || error?.name || 'session_timeout',
    });
    return { status: 'error', user: null, reason: 'temporary_error' };
  }
}
