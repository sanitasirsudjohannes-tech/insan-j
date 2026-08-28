/** Pembagian dua desimal; sisa pembulatan tetap pada tanggal terakhir. */
export const distributeValue = (total, days) => {
  if (!total || days <= 0) return Array(days).fill(0);
  const parsed = parseFloat(total);
  if (isNaN(parsed) || parsed === 0) return Array(days).fill(0);

  // Mengubah ke integer agar tidak ada floating point bug (misal: kalikan 100)
  const totalInt = Math.round(parsed * 100);
  const baseShareInt = Math.floor(totalInt / days);
  const remainderInt = totalInt - baseShareInt * days;
  const result = Array(days).fill(baseShareInt / 100);
  // Selisih pembulatan diberikan ke tanggal terakhir
  result[days - 1] = (baseShareInt + remainderInt) / 100;
  return result;
};
