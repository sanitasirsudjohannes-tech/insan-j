export const OPERATIONAL_INTENTS = new Set([
  'input_officers', 'room_input_history', 'fewest_room_inputs', 'room_record_days',
  'exact_duplicates', 'negative_records', 'zero_rooms', 'unknown_rooms', 'missing_officers',
  'future_records', 'room_outliers', 'negative_balance_dates', 'since_transport', 'transport_balance',
  'recorded_day_average', 'daily_details', 'day_extremes', 'transport_vs_generated', 'transport_vs_available',
]);

export function detectOperationalIntent(text) {
  if (/pengangkutan.*(?:lebih\s+besar|melebihi).*(?:tersedia|sisa\s+awal)/i.test(text)) return 'transport_vs_available';
  if (/pengangkutan.*(?:lebih\s+besar|melebihi).*timbulan/i.test(text)) return 'transport_vs_generated';
  if (/(?:tinggi|terbesar).*dan.*(?:rendah|terkecil)/i.test(text)) return 'day_extremes';
  if (/tanpa\s+(?:nama\s+)?petugas|petugas.*(?:kosong|belum\s+diisi)/i.test(text)) return 'missing_officers';
  if (/siapa.*(?:petugas|input)|petugas.*(?:siapa|inputnya)/i.test(text)) return 'input_officers';
  if (/ruang.*(?:tidak\s+sesuai|di\s+luar|diluar).*(?:resmi|daftar)|nama\s+ruang.*(?:tidak\s+dikenal|tidak\s+resmi)/i.test(text)) return 'unknown_rooms';
  if (/data.*(?:setelah\s+hari\s+ini|masa\s+depan)|tanggal.*(?:masa\s+depan|setelah\s+hari\s+ini)/i.test(text)) return 'future_records';
  if (/sisa.*negatif.*(?:tanggal|kapan)|(?:tanggal|kapan).*sisa.*negatif/i.test(text)) return 'negative_balance_dates';
  if (/(?:nilai|angka|limbah).*negatif/i.test(text)) return 'negative_records';
  if (/ruang.*(?:semua|seluruh).*nol|ruang.*(?:semua|seluruh).*\b0\b/i.test(text)) return 'zero_rooms';
  if (/ruang.*(?:kebiasaan|pola|tidak\s+wajar)|(?:kebiasaan|pola).*ruang/i.test(text)) return 'room_outliers';
  if (/catatan.*(?:tanggal|ruang).*(?:berat|jenis).*sama/i.test(text)) return 'exact_duplicates';
  if (/jumlah\s+ruang.*paling\s+sedikit/i.test(text)) return 'fewest_room_inputs';
  if (/jumlah\s+ruang.*(?:setiap|per)\s+hari/i.test(text)) return 'room_input_history';
  if (/berapa\s+hari.*(?:catatan|tercatat|input)/i.test(text)) return 'room_record_days';
  if (/timbulan.*sejak.*pengangkutan\s+terakhir/i.test(text)) return 'since_transport';
  if (/sisa.*sebelum.*(?:setelah|sesudah).*pengangkutan/i.test(text)) return 'transport_balance';
  if (/rata[ -]?rata.*hari.*(?:catatan|tercatat)/i.test(text)) return 'recorded_day_average';
  if (/^(?:rinci|rincian|tampilkan).*per\s+tanggal/i.test(text)) return 'daily_details';
  return null;
}
