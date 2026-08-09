import { supabase } from './supabase';

const RUANGAN_CACHE_KEY = 'insan_j_ruangan_cache';

export const getCurrentUser = () => {
  const userStr = localStorage.getItem('currentUser') || sessionStorage.getItem('currentUser');
  if (!userStr) return null;
  try {
    return JSON.parse(userStr);
  } catch {
    return null;
  }
};

export const logoutUser = async () => {
  try {
    await supabase.auth.signOut();
  } catch (e) {
    console.warn('Sign out offline warning:', e);
  }
  localStorage.removeItem('currentUser');
  sessionStorage.removeItem('currentUser');
  window.location.href = import.meta.env.BASE_URL;
};

/**
 * Mendapatkan daftar ruangan dari cache localStorage (untuk offline)
 */
export const getCachedRuangan = () => {
  try {
    const raw = localStorage.getItem(RUANGAN_CACHE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

/**
 * Menyimpan daftar ruangan ke localStorage (cache)
 */
export const cacheRuangan = (list) => {
  try {
    localStorage.setItem(RUANGAN_CACHE_KEY, JSON.stringify(list));
  } catch (e) {
    console.warn('Gagal menyimpan cache ruangan:', e);
  }
};

/**
 * Mengambil daftar nama ruangan dari Supabase.
 * Jika berhasil, hasilnya di-cache ke localStorage untuk akses offline.
 * Jika gagal/offline, gunakan data dari cache.
 */
export const fetchDaftarRuangan = async () => {
  try {
    const { data, error } = await supabase
      .from('ruangan')
      .select('nama_ruangan')
      .order('nama_ruangan', { ascending: true });

    if (error || !data) {
      // Fallback ke cache jika terjadi error
      const cached = getCachedRuangan();
      if (cached.length > 0) {
        console.info('Menggunakan cache ruangan (DB error).');
        return cached;
      }
      return [];
    }

    const list = data.map(r => r.nama_ruangan);

    // Simpan ke cache untuk penggunaan offline
    cacheRuangan(list);

    return list;
  } catch (e) {
    // Fallback ke cache saat offline/network error
    const cached = getCachedRuangan();
    if (cached.length > 0) {
      console.info('Menggunakan cache ruangan (offline).');
      return cached;
    }
    console.warn('Gagal memuat ruangan dari DB:', e);
    return [];
  }
};

// ─── APP SETTINGS ─────────────────────────────────────────────────────────────
const SETTINGS_CACHE_PREFIX = 'insan_j_setting_';

/**
 * Membaca sebuah setting dari tabel app_settings di Supabase.
 * Fallback ke localStorage jika tabel tidak ada / offline.
 * @param {string} key - nama setting
 * @param {*} defaultValue - nilai default jika tidak ditemukan
 */
export const getSetting = async (key, defaultValue = null) => {
  try {
    const { data, error } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', key)
      .maybeSingle();

    if (!error && data) {
      // Cache lokal agar bisa diakses cepat
      localStorage.setItem(SETTINGS_CACHE_PREFIX + key, JSON.stringify(data.value));
      return data.value;
    }
  } catch (_) {
    // table mungkin belum ada atau offline
  }

  // Fallback ke cache localStorage
  try {
    const cached = localStorage.getItem(SETTINGS_CACHE_PREFIX + key);
    if (cached !== null) return JSON.parse(cached);
  } catch (_) { /* */ }

  return defaultValue;
};

/**
 * Menyimpan setting ke Supabase app_settings (upsert) dan localStorage.
 * @param {string} key
 * @param {*} value
 */
export const setSetting = async (key, value) => {
  // Simpan ke localStorage dulu (agar UI responsif)
  localStorage.setItem(SETTINGS_CACHE_PREFIX + key, JSON.stringify(value));

  try {
    const { error } = await supabase
      .from('app_settings')
      .upsert({ key, value }, { onConflict: 'key' });

    if (error) throw error;
  } catch (e) {
    console.warn('Gagal menyimpan setting ke DB, tersimpan di localStorage:', e);
  }
};

/**
 * Membaca setting secara sinkron dari cache localStorage (tanpa network call).
 */
export const getSettingCached = (key, defaultValue = null) => {
  try {
    const cached = localStorage.getItem(SETTINGS_CACHE_PREFIX + key);
    if (cached !== null) return JSON.parse(cached);
  } catch (_) { /* */ }
  return defaultValue;
};
