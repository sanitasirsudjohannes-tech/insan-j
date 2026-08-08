import { supabase } from './supabase';

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
 * Mengambil daftar nama ruangan secara dinamis dari tabel database 'ruangan' Supabase
 */
export const fetchDaftarRuangan = async () => {
  try {
    const { data, error } = await supabase
      .from('ruangan')
      .select('nama_ruangan')
      .order('nama_ruangan', { ascending: true });

    if (error || !data) return [];
    return data.map(r => r.nama_ruangan);
  } catch (e) {
    console.warn('Gagal memuat ruangan dari DB:', e);
    return [];
  }
};
