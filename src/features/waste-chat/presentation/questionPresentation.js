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
  const period = parsed?.period?.label || 'bulan ini';
  const mentionsRoomCount = /(?:berapa\s+(?:jumlah\s+)?|jumlah\s+|banyaknya\s+|total\s+)(?:ruang|ruangan)\b/i.test(text);
  const comparisonWord = /banding|perbandingan|dibanding|beda|berbeda|selisih|mengapa|kenapa|penyebab|\bvs\.?\b/i.test(text);
  const twoRoomDates = mentionsRoomCount && !comparisonWord ? extractTwoRoomDates(text) : null;

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
