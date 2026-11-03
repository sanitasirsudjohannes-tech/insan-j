import { supabase } from '../../../lib/supabase';
import { withTimeout } from '../../../lib/asyncTimeout';
import { clearCachedUser, loadUserProfile } from '../../../lib/session';
import { resolveLoginEmail } from './loginEmailResolver';

const SIGN_IN_TIMEOUT_MS = 15000;

/**
 * Menjalankan seluruh rangkaian autentikasi:
 * username -> email -> signInWithPassword -> profil.
 *
 * Error dari tahap profil tetap ditandai `authenticated = true` agar UI bisa
 * membedakan kredensial salah dari kegagalan memuat profil setelah login.
 */
export async function authenticateUser({ username, password }) {
  const email = await resolveLoginEmail(username);
  let signedInUserId = null;

  try {
    const { data, error } = await withTimeout(
      supabase.auth.signInWithPassword({ email, password }),
      SIGN_IN_TIMEOUT_MS,
      {
        code: 'login_timeout',
        message: 'Proses login terlalu lama. Periksa koneksi lalu coba lagi.',
      },
    );

    if (error) throw error;
    signedInUserId = data?.user?.id || null;

    if (!signedInUserId) {
      throw Object.assign(new Error('Akun tidak dikenali.'), { code: 'invalid_credentials' });
    }

    const user = await loadUserProfile(signedInUserId);
    return { user };
  } catch (error) {
    if (signedInUserId) {
      throw Object.assign(
        new Error(error?.message || 'Profil pengguna belum dapat dimuat.'),
        {
          code: error?.code,
          status: error?.status,
          authenticated: true,
          cause: error,
        },
      );
    }
    throw error;
  }
}

/**
 * Membersihkan sesi yang berhasil terautentikasi tetapi tidak memiliki profil.
 * Dipisahkan dari UI agar halaman Login tidak perlu mengakses Supabase langsung.
 */
export async function discardIncompleteLogin() {
  clearCachedUser();
  await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
}
