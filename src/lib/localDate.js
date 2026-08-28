/**
 * Menghasilkan tanggal kalender lokal tanpa konversi ke UTC.
 * Penting untuk pengguna WITA: toISOString() dapat menghasilkan tanggal
 * kemarin antara pukul 00.00 dan 07.59 WITA.
 */
export const getLocalDateString = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const getLocalMonthString = (date = new Date()) =>
  getLocalDateString(date).slice(0, 7);
