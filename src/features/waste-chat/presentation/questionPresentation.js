const INTENT_LABELS = {
  waste_summary: 'Ringkasan limbah', analysis: 'Analisis limbah', remaining: 'Sisa limbah', opening_balance: 'Sisa awal',
  available_total: 'Limbah tersedia', generated: 'Timbulan', transported: 'Pengangkutan', transport_dates: 'Tanggal pengangkutan',
  last_transport: 'Pengangkutan terakhir', transport_gap: 'Jeda pengangkutan', transport_count: 'Frekuensi pengangkutan',
  average_transport: 'Rata-rata pengangkutan', type_dates: 'Tanggal berdasarkan jenis', transport_coverage: 'Cakupan pengangkutan',
  average: 'Rata-rata timbulan', dominant_type: 'Jenis terbanyak', least_type: 'Jenis paling sedikit', type_breakdown: 'Rincian jenis',
  type_percentages: 'Persentase jenis', top_rooms: 'Ruangan terbesar', bottom_room: 'Ruangan terkecil', type_rooms: 'Jenis per ruangan',
  never_type_rooms: 'Ruangan tanpa catatan jenis', room_total: 'Timbulan ruangan', room_contribution: 'Kontribusi ruangan',
  room_type_dates: 'Tanggal jenis per ruangan', room_type_total: 'Jenis per ruangan', peak_day: 'Hari tertinggi', trough_day: 'Hari terendah',
  peak_month: 'Bulan tertinggi', peak_week: 'Minggu tertinggi', active_days: 'Hari dengan timbulan', comparison: 'Perbandingan',
  type_total: 'Total berdasarkan jenis', data_completeness: 'Kelengkapan tanggal', missing_rooms: 'Kelengkapan ruangan',
  duplicate_data: 'Kemungkinan data ganda', data_anomalies: 'Pemeriksaan data',
};

const TRANSPORT_INTENTS = new Set(['transported', 'transport_dates', 'last_transport', 'transport_gap', 'transport_count', 'average_transport', 'transport_coverage']);
const RECAP_INTENTS = new Set(['waste_summary', 'analysis', 'remaining', 'opening_balance', 'available_total', 'comparison', 'peak_month', 'peak_week']);

export function buildQuestionUnderstanding(parsed) {
  if (!parsed?.intent || !parsed?.period) return null;
  return {
    status: 'understood',
    intent: INTENT_LABELS[parsed.intent] || 'Data limbah',
    period: parsed.period.label,
    room: parsed.roomName || (parsed.roomNames?.length > 1 ? parsed.roomNames.join(' dan ') : null),
    type: parsed.type?.label || null,
  };
}

export function buildSourceLink(parsed) {
  if (!parsed?.period) return null;
  const query = new URLSearchParams({ start: parsed.period.start, end: parsed.period.end });
  if (parsed.roomName) query.set('room', parsed.roomName);
  if (parsed.type?.key) query.set('type', parsed.type.key);
  if (TRANSPORT_INTENTS.has(parsed.intent)) return { label: 'Buka data pengangkutan', to: `/pengangkutan?${query}` };
  if (RECAP_INTENTS.has(parsed.intent)) return { label: 'Buka rekap data', to: `/rekap-limbah?${query}` };
  return { label: 'Buka data limbah', to: `/limbah-dihasilkan?${query}` };
}

export function findQuestionClarification(question, parsed) {
  const text = String(question || '');
  const period = parsed?.period?.label || 'bulan ini';
  const hasSpecificDimension = /tanggal|tgl|hari|ruang|unit|bangsal|jenis|infeksius|jarum|botol|sitotoksik|bulan\s+(?:mana|apa)|minggu|pekan/i.test(text);
  if (!hasSpecificDimension && /limbah.*(?:tertinggi|terbesar|terbanyak|paling\s+(?:tinggi|banyak))/i.test(text)) {
    return {
      text: 'Maksud “limbah tertinggi” belum spesifik. Pilih data yang ingin dibandingkan.',
      actions: [
        { label: 'Tanggal tertinggi', question: `Tanggal berapa timbulan paling tinggi ${period}` },
        { label: 'Ruangan terbesar', question: `Ruangan dengan timbulan terbesar ${period}` },
        { label: 'Jenis terbanyak', question: `Jenis limbah terbanyak ${period}` },
      ],
    };
  }
  if (/data\s+(?:kosong|belum\s+lengkap)/i.test(text) && !/tanggal|hari|ruang|unit|bangsal/i.test(text)) {
    return {
      text: 'Pemeriksaan data kosong dapat dilakukan berdasarkan tanggal atau ruangan. Pilih pemeriksaan yang dimaksud.',
      actions: [
        { label: 'Tanggal kosong', question: `Tanggal berapa data belum diinput ${period}` },
        { label: 'Ruangan belum input', question: `Ruangan mana yang belum input ${period}` },
      ],
    };
  }
  return null;
}
