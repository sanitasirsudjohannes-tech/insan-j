import { fetchMedicalWasteRecap } from './reportRecap.js';
import { parseWasteQuestion } from './wasteQuestionParser.js';
import { buildWasteAnswer } from './wasteQuestionAnswer.js';
import { fetchDaftarRuangan, getCachedRuangan } from './api.js';
import { findRoomCandidates, resolveKnownRoom } from '../features/waste-chat/parsers/roomNameResolver.js';
import { getOfflineQueue } from './offlineStorage.js';
import { findQuestionClarification } from '../features/waste-chat/presentation/questionPresentation.js';

export async function answerWasteQuestion(question, { context = null, contextPeriod = null, fetchRecap = fetchMedicalWasteRecap, fetchRooms = fetchDaftarRuangan } = {}) {
  const conversationContext = context || (contextPeriod ? { period: contextPeriod } : null);
  const preliminary = parseWasteQuestion(question, conversationContext, []);
  if (preliminary.invalidPeriod) {
    return {
      text: preliminary.invalidPeriod,
      parsed: preliminary,
      clarification: true,
      understanding: { status: 'clarification', intent: 'Tanggal tidak valid', period: null },
    };
  }
  if (preliminary.intent === 'capabilities') {
    return {
      text: 'Saya dapat membantu membaca data INSAN-J, antara lain:\n\n• Ringkasan timbulan, pengangkutan, dan sisa limbah.\n• Rincian jenis limbah dan data per ruangan.\n• Perbandingan maksimal 3 bulan.\n• Tanggal pengangkutan, pengangkutan terakhir, dan jeda pengangkutan.\n• Pemeriksaan tanggal kosong, ruangan yang belum input, data ganda, dan angka tidak wajar.\n• Analisis tren, bulan atau tanggal tertinggi, serta rata-rata.\n\nUntuk laporan dan periode yang lebih panjang, gunakan menu Rekap Limbah atau Laporan.',
      parsed: preliminary,
      actions: [
        { label: 'Ringkasan bulan ini', question: 'Rincian data limbah bulan ini' },
        { label: 'Cek data kosong', question: 'Apakah ada tanggal yang belum diinput bulan ini?' },
        { label: 'Pengangkutan terakhir', question: 'Kapan pengangkutan terakhir?' },
      ],
      understanding: { status: 'understood', intent: 'Daftar kemampuan', period: null },
      sourceLink: { label: 'Buka Rekap Limbah', to: '/rekap-limbah' },
    };
  }
  const preliminaryClarification = findQuestionClarification(question, preliminary);
  if (preliminaryClarification) {
    return {
      ...preliminaryClarification,
      clarification: true,
      understanding: { status: 'clarification', intent: 'Perlu konfirmasi', period: preliminary.period?.label },
    };
  }

  let roomNames = typeof localStorage === 'undefined' ? [] : getCachedRuangan();
  if (!roomNames.length) roomNames = await fetchRooms();
  const roomCandidates = findRoomCandidates(question, roomNames);
  const resolvedRoom = resolveKnownRoom(question, roomNames);
  if (!resolvedRoom && roomCandidates.length > 1) {
    return {
      text: 'Nama ruangan belum spesifik. Pilih ruangan yang dimaksud agar data yang dihitung tepat.',
      clarification: true,
      actions: roomCandidates.slice(0, 6).map(name => ({ label: name, question: `${question} ruangan ${name}` })),
    };
  }
  const parsed = parseWasteQuestion(question, conversationContext, roomNames);
  if (parsed.invalidPeriod) return { text: parsed.invalidPeriod, parsed, clarification: true, understanding: { status: 'clarification', intent: 'Tanggal tidak valid', period: null } };
  const clarification = findQuestionClarification(question, parsed);
  if (clarification) return { ...clarification, clarification: true, understanding: { status: 'clarification', intent: 'Perlu konfirmasi', period: parsed.period?.label } };
  if (parsed.intent === 'capabilities') {
    return {
      text: 'Saya dapat membantu membaca data INSAN-J, antara lain:\n\n• Ringkasan timbulan, pengangkutan, dan sisa limbah.\n• Rincian jenis limbah dan data per ruangan.\n• Perbandingan maksimal 3 bulan.\n• Tanggal pengangkutan, pengangkutan terakhir, dan jeda pengangkutan.\n• Pemeriksaan tanggal kosong, ruangan yang belum input, data ganda, dan angka tidak wajar.\n• Analisis tren, bulan atau tanggal tertinggi, serta rata-rata.\n\nUntuk laporan dan periode yang lebih panjang, gunakan menu Rekap Limbah atau Laporan.',
      parsed,
      actions: [
        { label: 'Ringkasan bulan ini', question: 'Rincian data limbah bulan ini' },
        { label: 'Cek data kosong', question: 'Apakah ada tanggal yang belum diinput bulan ini?' },
        { label: 'Pengangkutan terakhir', question: 'Kapan pengangkutan terakhir?' },
      ],
      understanding: { status: 'understood', intent: 'Daftar kemampuan', period: null },
      sourceLink: { label: 'Buka Rekap Limbah', to: '/rekap-limbah' },
    };
  }
  if (parsed.intent === 'unknown') {
    return {
      text: 'Pertanyaan tersebut belum tersedia dalam template Tanya INSAN-J. Coba tanyakan sisa limbah, timbulan, pengangkutan, rincian jenis, kelengkapan data, atau perbandingan maksimal 3 bulan.',
      parsed,
      actions: [
        { label: 'Ringkasan bulan ini', question: 'Rincian data limbah bulan ini' },
        { label: 'Cek data kosong', question: 'Apakah ada tanggal yang belum diinput bulan ini?' },
        { label: 'Pengangkutan terakhir', question: 'Kapan pengangkutan terakhir?' },
      ],
      understanding: { status: 'understood', intent: 'Template belum tersedia', period: null },
    };
  }
  if (['comparison', 'generated_difference'].includes(parsed.intent) && parsed.tooManyComparisonMonths) {
    return {
      text: `Perbandingan melalui Tanya INSAN-J dibatasi maksimal 3 bulan agar jawaban tetap ringkas dan mudah diperiksa. Anda meminta ${parsed.requestedComparisonCount} bulan. Untuk melihat periode yang lebih panjang dan lebih lengkap, buka menu Rekap Limbah lalu pilih periode yang diperlukan.`,
      parsed,
      limitExceeded: true,
      understanding: { status: 'understood', intent: 'Perbandingan periode', period: `${parsed.requestedComparisonCount} bulan` },
      sourceLink: { label: 'Buka Rekap Limbah', to: '/rekap-limbah' },
    };
  }

  const diagnosticIntents = new Set(['data_completeness', 'missing_rooms', 'room_input_count', 'room_input_comparison', 'duplicate_data', 'data_anomalies', 'last_transport', 'transport_gap', 'transport_count', 'average_transport', 'transport_dates']);
  const balanceIntents = new Set(['waste_summary', 'analysis', 'remaining', 'opening_balance', 'available_total', 'transport_coverage', 'transported', 'comparison', 'data_anomalies']);
  const transportIntents = new Set(['transported', 'last_transport', 'transport_gap', 'transport_count', 'average_transport', 'transport_dates', 'transport_coverage']);
  const recapOptions = {
    knownRooms: roomNames,
    includeBalance: balanceIntents.has(parsed.intent),
    includeTransport: balanceIntents.has(parsed.intent) || transportIntents.has(parsed.intent),
    includePrevious: parsed.intent === 'analysis' || (parsed.intent === 'comparison' && !parsed.comparisonPeriod && !parsed.comparisonPeriods),
    includeDiagnostics: diagnosticIntents.has(parsed.intent),
  };
  const isComparisonIntent = ['comparison', 'room_input_comparison', 'generated_difference'].includes(parsed.intent);
  const comparisonPeriods = parsed.intent === 'comparison' && parsed.comparisonPeriods?.length >= 2
    ? parsed.comparisonPeriods
    : null;
  const periodRecaps = comparisonPeriods
    ? await Promise.all(comparisonPeriods.map(period =>
      fetchRecap(period.start, period.end, { ...recapOptions, includePrevious: false })
    ))
    : null;
  const [recap, comparisonRecap] = periodRecaps
    ? [periodRecaps.at(-1), periodRecaps[0]]
    : await Promise.all([
      fetchRecap(parsed.period.start, parsed.period.end, recapOptions),
      isComparisonIntent && parsed.comparisonPeriod
        ? fetchRecap(parsed.comparisonPeriod.start, parsed.comparisonPeriod.end, { ...recapOptions, includePrevious: false })
        : null,
    ]);
  const pendingItems = typeof window === 'undefined'
    ? []
    : getOfflineQueue().filter(item => ['limbah_padat', 'limbah_ruangan', 'pengangkutan_limbah'].includes(item.table));
  const pendingCount = pendingItems.length;
  const answer = buildWasteAnswer(parsed, recap, comparisonRecap, periodRecaps);
  if (['room_input_count', 'room_input_comparison'].includes(parsed.intent)) {
    const requestedDates = new Set([parsed.period?.start, parsed.comparisonPeriod?.start].filter(Boolean));
    const pendingRoomCount = pendingItems.filter(item => {
      const itemDate = item.tanggal || item.data?.tanggal || item.payload?.tanggal;
      return item.table === 'limbah_ruangan' && requestedDates.has(itemDate);
    }).length;
    if (pendingRoomCount > 0) {
      const warning = `Terdapat ${pendingRoomCount} perubahan data ruangan pada tanggal yang diperiksa yang belum tersinkron. Jumlah pada jawaban ini hanya berasal dari data server dan dapat berubah setelah sinkronisasi selesai.`;
      answer.warnings = [...(answer.warnings || []), warning];
      answer.text = `${answer.text}\n\nCatatan sinkronisasi\n• ${warning}`;
    }
  }
  return {
    ...answer,
    dataStatus: { fetchedAt: new Date().toISOString(), pendingCount, online: typeof navigator === 'undefined' ? true : navigator.onLine },
  };
}
