const AI_INTENTS = [
  'waste_summary', 'analysis', 'remaining', 'opening_balance', 'available_total', 'generated', 'transported',
  'transport_dates', 'last_transport', 'transport_gap', 'transport_count', 'average_transport', 'type_dates',
  'transport_coverage', 'average', 'dominant_type', 'least_type', 'type_breakdown', 'type_percentages',
  'top_rooms', 'bottom_room', 'type_rooms', 'never_type_rooms', 'room_total', 'room_contribution',
  'room_type_dates', 'room_type_total', 'peak_day', 'trough_day', 'peak_month', 'peak_week', 'active_days',
  'comparison', 'type_total', 'data_completeness', 'missing_rooms', 'duplicate_data', 'data_anomalies', 'unknown',
];

const witaNow = () => {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en', { timeZone: 'Asia/Makassar', year: 'numeric', month: '2-digit' }).formatToParts(new Date()).map(part => [part.type, part.value]));
  return { year: Number(parts.year), month: Number(parts.month) };
};

export function buildWasteQuestionPrompt(question, contextPeriod) {
  const now = witaNow();
  return `Tanggal acuan WITA: tahun ${now.year}, bulan ${now.month}. Pahami pertanyaan pengguna tentang data limbah medis INSAN-J, termasuk bahasa sehari-hari, singkatan, dan salah ketik ringan. Kembalikan JSON saja dengan properti: intent, year, month, day, startDate, endDate, typeKey, typeKeys, roomName, inferredYear. intent hanya boleh ${AI_INTENTS.join(', ')}. Gunakan data_completeness untuk tanggal kosong, data belum lengkap, atau seluruh nilai nol; missing_rooms untuk ruangan yang belum mengisi; duplicate_data untuk data ganda; data_anomalies untuk data janggal, negatif, lonjakan, atau data yang perlu diperiksa; last_transport untuk pengangkutan terakhir; transport_gap untuk jeda pengangkutan; transport_count untuk jumlah kegiatan pengangkutan; average_transport untuk rata-rata setiap pengangkutan; peak_month atau peak_week untuk periode dengan nilai tertinggi. Gunakan analysis untuk permintaan analisis atau evaluasi pengelolaan secara umum. Gunakan room_type_dates jika pengguna meminta tanggal suatu jenis limbah pada ruangan tertentu; isi roomName hanya dengan nama ruangnya. Gunakan transport_dates jika pengguna menanyakan tanggal atau hari apa saja pengangkutan dilakukan. Gunakan type_dates jika pengguna menanyakan tanggal atau hari apa saja suatu jenis limbah tercatat. Gunakan type_rooms jika pengguna meminta daftar ruangan yang memiliki atau menghasilkan jenis limbah tertentu; jangan salin frasa seperti “yang ada limbah” sebagai roomName. Gunakan waste_summary untuk permintaan umum seperti rincian limbah, data limbah, ringkasan, rekap, atau gambaran keseluruhan. Gunakan room_total untuk jumlah seluruh jenis dari satu ruangan dan room_type_total untuk satu jenis limbah dari satu ruangan; salin nama ruang ke roomName tanpa mengarang nama. Untuk rentang tanggal isi startDate dan endDate dalam YYYY-MM-DD. Untuk satu tanggal isi year, month, day. Untuk bulan isi year dan month dengan day null. Untuk satu tahun isi year dengan month dan day null. typeKey hanya infectiousKg, sharpsKg, bottleKg, cytotoxicKg, atau null; typeKeys boleh memuat beberapa jenis untuk type_breakdown atau comparison. Jika pengguna merujuk “tanggal tersebut” atau “periode itu”, gunakan konteks periode sebelumnya berikut: ${JSON.stringify(contextPeriod)}. Jika periode tidak disebutkan, gunakan bulan dan tahun acuan serta inferredYear true. Jangan menjawab angka dan jangan menambah fakta. Pertanyaan: ${JSON.stringify(question)}`;
}
