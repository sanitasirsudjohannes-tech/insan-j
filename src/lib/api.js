import { supabase } from './supabase';
import { clearCachedUser, getCachedUser } from './session';

const RUANGAN_CACHE_KEY = 'insan_j_ruangan_cache';

export const getCurrentUser = getCachedUser;

export const logoutUser = async () => {
  try {
    await supabase.auth.signOut({ scope: 'local' });
  } catch (error) {
    console.warn('Sign out offline warning:', error);
  } finally {
    clearCachedUser();
    window.location.href = import.meta.env.BASE_URL;
  }
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
 * Menyimpan daftar ruangan ke localStorage
 */
export const cacheRuangan = list => {
  try {
    localStorage.setItem(RUANGAN_CACHE_KEY, JSON.stringify(list));
  } catch (error) {
    console.warn('Gagal menyimpan cache ruangan:', error);
  }
};

export const fetchDaftarRuangan = async () => {
  try {
    const { data, error } = await supabase
      .from('ruangan')
      .select('nama_ruangan')
      .order('nama_ruangan', { ascending: true });

    if (error || !data) {
      const cached = getCachedRuangan();
      if (cached.length > 0) return cached;
      return [];
    }

    const list = data.map(row => row.nama_ruangan);
    cacheRuangan(list);
    return list;
  } catch (error) {
    const cached = getCachedRuangan();
    if (cached.length > 0) return cached;
    console.warn('Gagal memuat ruangan dari DB:', error);
    return [];
  }
};

const SETTINGS_CACHE_PREFIX = 'insan_j_setting_';

export const getSetting = async (key, defaultValue = null) => {
  try {
    const { data, error } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', key)
      .maybeSingle();

    if (!error && data) {
      localStorage.setItem(SETTINGS_CACHE_PREFIX + key, JSON.stringify(data.value));
      return data.value;
    }
  } catch (_) {
    // Gunakan cache jika layanan sedang tidak tersedia.
  }

  try {
    const cached = localStorage.getItem(SETTINGS_CACHE_PREFIX + key);
    if (cached !== null) return JSON.parse(cached);
  } catch (_) {
    // Nilai cache rusak; gunakan nilai bawaan.
  }
  return defaultValue;
};

export const setSetting = async (key, value) => {
  localStorage.setItem(SETTINGS_CACHE_PREFIX + key, JSON.stringify(value));
  try {
    const { error } = await supabase
      .from('app_settings')
      .upsert({ key, value }, { onConflict: 'key' });
    if (error) throw error;
  } catch (error) {
    console.warn('Gagal menyimpan setting ke DB, tersimpan di localStorage:', error);
  }
};

export const getSettingCached = (key, defaultValue = null) => {
  try {
    const cached = localStorage.getItem(SETTINGS_CACHE_PREFIX + key);
    if (cached !== null) return JSON.parse(cached);
  } catch (_) {
    // Nilai cache rusak; gunakan nilai bawaan.
  }
  return defaultValue;
};
