export const waterErrorMessage = error => {
  if (!navigator.onLine || error?.message?.includes('Failed to fetch')) {
    return 'Koneksi ke server terputus. Periksa internet lalu coba kembali.';
  }
  if (error?.code === '42P01' || error?.code === 'PGRST205') {
    return 'Pengaturan pemeriksaan air belum tersedia. Jalankan migrasi SQL baku mutu terlebih dahulu.';
  }
  return error?.message || 'Terjadi kesalahan saat memproses data.';
};
