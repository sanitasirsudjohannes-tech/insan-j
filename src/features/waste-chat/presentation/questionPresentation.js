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
  room_input_count: 'Jumlah ruangan yang input', room_input_comparison: 'Perbandingan input ruangan',
  duplicate_data: 'Kemungkinan data ganda', data_anomalies: 'Pemeriksaan data',
  generated_difference: 'Rincian selisih timbulan',
  daily_review: 'Ringkasan pemeriksaan harian',
  calculation_help: 'Cara perhitungan', source_records: 'Catatan sumber',
  day_extremes: 'Timbulan tertinggi dan terendah', transport_vs_generated: 'Pengangkutan dibanding timbulan', transport_vs_available: 'Pengangkutan dibanding limbah tersedia',
  input_officers: 'Petugas input ruangan', room_input_history: 'Riwayat jumlah ruangan',
  fewest_room_inputs: 'Input ruangan paling sedikit', room_record_days: 'Hari tercatat ruangan',
  exact_duplicates: 'Kemungkinan catatan identik', negative_records: 'Nilai negatif',
  zero_rooms: 'Catatan ruangan nol', unknown_rooms: 'Nama ruangan tidak resmi',
  missing_officers: 'Nama petugas kosong', future_records: 'Tanggal masa depan',
  room_outliers: 'Pola berat ruangan', negative_balance_dates: 'Tanggal sisa negatif',
  since_transport: 'Timbulan setelah tanggal pengangkutan', transport_balance: 'Sisa pada hari pengangkutan',
  recorded_day_average: 'Rata-rata per hari tercatat', daily_details: 'Rincian harian',
};

const TRANSPORT_INTENTS = new Set(['transported', 'transport_dates', 'last_transport', 'transport_gap', 'transport_count', 'average_transport', 'transport_coverage']);
const RECAP_INTENTS = new Set(['waste_summary', 'analysis', 'remaining', 'opening_balance', 'available_total', 'comparison', 'peak_month', 'peak_week']);
const ROOM_DATA_INTENTS = new Set(['room_input_count', 'room_input_comparison', 'missing_rooms', 'duplicate_data', 'input_officers', 'room_input_history', 'fewest_room_inputs', 'room_record_days', 'exact_duplicates', 'zero_rooms', 'unknown_rooms', 'missing_officers', 'room_outliers']);

export function buildQuestionUnderstanding(parsed) {
  if (!parsed?.intent || !parsed?.period) return null;
  return {
    status: 'understood',
    intent: INTENT_LABELS[parsed.intent] || 'Data limbah',
    period: parsed.comparisonPeriod ? `${parsed.comparisonPeriod.label} dibanding ${parsed.period.label}` : parsed.period.label,
    room: parsed.roomName || (parsed.roomNames?.length > 1 ? parsed.roomNames.join(' dan ') : null),
    type: parsed.type?.label || null,
  };
}

export function buildSourceLink(parsed) {
  if (!parsed?.period) return null;
  const query = new URLSearchParams({ start: parsed.period.start, end: parsed.period.end });
  if (parsed.period.start.slice(0, 7) === parsed.period.end.slice(0, 7)) query.set('month', parsed.period.start.slice(0, 7));
  if (parsed.roomName) query.set('room', parsed.roomName);
  if (parsed.type?.key) query.set('type', parsed.type.key);
  if (TRANSPORT_INTENTS.has(parsed.intent)) return { label: 'Buka data pengangkutan', to: `/pengangkutan?${query}` };
  if (ROOM_DATA_INTENTS.has(parsed.intent)) {
    query.set('tab', 'ruangan');
    return { label: 'Buka data ruangan', to: `/limbah-dihasilkan?${query}` };
  }
  if (RECAP_INTENTS.has(parsed.intent)) return { label: 'Buka rekap data', to: `/rekap-limbah?${query}` };
  query.set('tab', parsed.roomName || parsed.type ? 'ruangan' : 'padat');
  return { label: 'Buka data limbah', to: `/limbah-dihasilkan?${query}` };
}

const MONTH_NAMES = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

const displayIsoDate = value => {
  const [year, month, day] = String(value || '').split('-').map(Number);
  return year && month && day ? `${day} ${MONTH_NAMES[month - 1]} ${year}` : value;
};

const previousIsoDate = value => {
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? null : new Date(date.getTime() - 86400000).toISOString().slice(0, 10);
};

function extractTwoRoomDates(text) {
  const year = text.match(/\b(20\d{2})\b/)?.[1] || new Intl.DateTimeFormat('en', { timeZone: 'Asia/Makassar', year: 'numeric' }).format(new Date());
  const shared = text.match(/\b([0-2]?\d|3[01])\s+(?:dan|dengan|,|&|\/|-)\s*(?:tanggal\s+|tgl\.?\s*)?([0-2]?\d|3[01])\s+(Januari|Februari|Maret|April|Mei|Juni|Juli|Agustus|September|Oktober|November|Desember)(?:\s+(20\d{2}))?\b/i);
  if (shared) {
    const usedYear = shared[4] || year;
    return [`${Number(shared[1])} ${shared[3]} ${usedYear}`, `${Number(shared[2])} ${shared[3]} ${usedYear}`];
  }
  const named = [...text.matchAll(/\b([0-2]?\d|3[01])\s+(Januari|Februari|Maret|April|Mei|Juni|Juli|Agustus|September|Oktober|November|Desember)(?:\s+(20\d{2}))?\b/gi)];
  if (named.length >= 2) return named.slice(0, 2).map(match => `${Number(match[1])} ${match[2]} ${match[3] || year}`);
  return null;
}

export function findQuestionClarification(question, parsed) {
  const text = String(question || '');
  if (parsed?.conversationClarification) return { text: parsed.conversationClarification };
  if (parsed?.intent === 'daily_review' && parsed.period?.scope !== 'day') return { text: 'Ringkasan harian memerlukan satu tanggal. Sebutkan tanggal atau pilih hari ini.', actions: [{ label: 'Hari ini', question: 'Ringkasan pemeriksaan harian hari ini' }] };
  if (parsed?.needsDifferenceSubject) {
    return { text: 'Selisih yang dimaksud timbulan, pengangkutan, atau sisa limbah? Sebutkan objek dan dua periode agar pemeriksaan sesuai.' };
  }
  if (parsed?.intent === 'generated_difference' && parsed.comparisonPeriods?.length > 2) {
    return { text: 'Penjelasan sumber selisih memerlukan dua periode. Sebutkan dua bulan atau dua tanggal yang ingin ditelusuri.' };
  }
  const period = parsed?.period?.label || 'bulan ini';
  const mentionsRoomCount = /(?:berapa\s+(?:jumlah\s+)?|jumlah\s+|banyaknya\s+|total\s+)(?:ruang|ruangan)\b/i.test(text);
  const comparisonWord = /banding|perbandingan|dibanding|beda|berbeda|selisih|mengapa|kenapa|penyebab|\bvs\.?\b/i.test(text);
  const twoRoomDates = mentionsRoomCount && !comparisonWord ? extractTwoRoomDates(text) : null;
  const ambiguousTransportAmount = /\bjumlah\s+(?:data\s+)?pengangkutan\b/i.test(text)
    && !/(?:berapa\s+kali|frekuensi|catatan|tanggal|hari|kg|kilogram|berat|ton)/i.test(text);

  if (ambiguousTransportAmount) {
    return {
      text: `“Jumlah pengangkutan” dapat berarti berat limbah atau banyaknya pengangkutan. Pilih yang Anda maksud untuk ${period}.`,
      actions: [
        { label: 'Total berat (kg)', question: `Berapa total berat limbah yang diangkut selama ${period}` },
        { label: 'Frekuensi (kali)', question: `Berapa kali pengangkutan selama ${period}` },
        { label: 'Daftar tanggal', question: `Tanggal pengangkutan selama ${period}` },
      ],
    };
  }

  if (twoRoomDates) {
    return {
      text: 'Anda menyebutkan dua tanggal. Pilih data jumlah ruangan yang ingin ditampilkan.',
      actions: [
        { label: 'Bandingkan keduanya', question: `Bandingkan jumlah ruangan tanggal ${twoRoomDates[0]} dan ${twoRoomDates[1]}` },
        { label: twoRoomDates[0], question: `Berapa jumlah ruangan yang input tanggal ${twoRoomDates[0]}` },
        { label: twoRoomDates[1], question: `Berapa jumlah ruangan yang input tanggal ${twoRoomDates[1]}` },
      ],
    };
  }

  if (parsed?.intent === 'room_input_count' && parsed.period?.scope !== 'day') {
    return {
      text: `Permintaan jumlah ruangan selama ${period} belum menyebutkan satu tanggal. Jumlah ruangan dapat berbeda setiap hari.`,
      actions: [
        { label: 'Gunakan hari ini', question: 'Berapa jumlah ruangan yang input hari ini?' },
        { label: 'Cek kelengkapan periode', question: `Ruangan mana yang belum input selama ${period}` },
      ],
    };
  }

  if (parsed?.intent === 'room_input_comparison' && (!parsed.comparisonPeriod || parsed.comparisonPeriod.scope !== 'day' || parsed.period?.scope !== 'day')) {
    const previous = parsed.period?.scope === 'day' ? previousIsoDate(parsed.period.start) : null;
    return {
      text: 'Perbandingan jumlah ruangan memerlukan dua tanggal yang jelas. Sebutkan kedua tanggal yang ingin dibandingkan.',
      actions: previous ? [
        { label: 'Bandingkan sehari sebelumnya', question: `Bandingkan jumlah ruangan tanggal ${displayIsoDate(previous)} dan ${displayIsoDate(parsed.period.start)}` },
        { label: 'Lihat tanggal ini saja', question: `Berapa jumlah ruangan yang input tanggal ${displayIsoDate(parsed.period.start)}` },
      ] : [
        { label: 'Bandingkan kemarin', question: 'Bandingkan jumlah ruangan kemarin dan hari ini' },
        { label: 'Jumlah hari ini', question: 'Berapa jumlah ruangan yang input hari ini?' },
      ],
    };
  }

  if (/(?:mengapa|kenapa|penyebab).*(?:limbah|timbulan).*(?:beda|berbeda|selisih)/i.test(text) && !parsed?.comparisonPeriod) {
    return {
      text: 'Untuk mencari penyebab perbedaan limbah, sebutkan dua tanggal yang ingin dibandingkan.',
      actions: [
        { label: 'Kemarin dan hari ini', question: 'Mengapa limbah kemarin dan hari ini berbeda?' },
        { label: 'Lihat jumlah hari ini', question: 'Berapa jumlah ruangan yang input hari ini?' },
      ],
    };
  }

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
