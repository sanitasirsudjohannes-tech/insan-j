// Urutan ini harus sama dengan query tanggal dan waktu_input di Supabase.
export const compareWasteRows = (a, b) => {
  const dateA = a?.tanggal || '';
  const dateB = b?.tanggal || '';
  if (dateA !== dateB) return dateB.localeCompare(dateA);
  const waktuA = a?.waktu_input || '';
  const waktuB = b?.waktu_input || '';
  return waktuB.localeCompare(waktuA);
};
