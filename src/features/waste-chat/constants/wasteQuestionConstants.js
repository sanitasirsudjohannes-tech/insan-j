export const MONTHS = ['januari', 'februari', 'maret', 'april', 'mei', 'juni', 'juli', 'agustus', 'september', 'oktober', 'november', 'desember'];
export const MONTH_PATTERN = MONTHS.join('|');

export const WASTE_TYPES = [
  { pattern: /infeksius|infectious/i, key: 'infectiousKg', label: 'limbah infeksius' },
  { pattern: /jarum(?: suntik)?|benda tajam|spuit|syringe|safety\s*box/i, key: 'sharpsKg', label: 'limbah jarum suntik' },
  { pattern: /botol(?: obat)?|vial|ampul/i, key: 'bottleKg', label: 'limbah botol obat' },
  { pattern: /sitotoksik|cytotoxic|sitostatika/i, key: 'cytotoxicKg', label: 'limbah sitotoksik' },
];

export const ALLOWED_INTENTS = new Set(['waste_summary', 'analysis', 'remaining', 'opening_balance', 'available_total', 'generated', 'transported', 'transport_dates', 'last_transport', 'transport_gap', 'type_dates', 'transport_coverage', 'average', 'dominant_type', 'type_breakdown', 'top_rooms', 'bottom_room', 'type_rooms', 'room_total', 'room_type_dates', 'room_type_total', 'peak_day', 'active_days', 'comparison', 'type_total', 'data_completeness', 'missing_rooms', 'duplicate_data', 'data_anomalies']);

export const QUESTION_SUGGESTIONS = [
  'Rincian data limbah bulan ini',
  'Timbulan limbah tanggal 8',
  'Ruangan dengan timbulan terbesar tanggal 8',
  'Rincian limbah berdasarkan jenis tanggal 8',
  'Timbulan 7 Juli sampai hari ini',
  'Berapa sisa limbah bulan ini?',
  'Bandingkan timbulan bulan ini dengan sebelumnya',
  'Apakah ada tanggal yang belum diinput bulan ini?',
  'Kapan pengangkutan terakhir?',
  'Apakah ada data yang perlu diperiksa bulan ini?',
];
