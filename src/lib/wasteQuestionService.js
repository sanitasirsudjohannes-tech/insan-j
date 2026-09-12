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
  if (parsed.intent === 'comparison' && parsed.tooManyComparisonMonths) {
    return {
      text: `Perbandingan melalui Tanya INSAN-J dibatasi maksimal 3 bulan agar jawaban tetap ringkas dan mudah diperiksa. Anda meminta ${parsed.requestedComparisonCount} bulan. Untuk melihat periode yang lebih panjang dan lebih lengkap, buka menu Rekap Limbah lalu pilih periode yang diperlukan.`,
      parsed,
      limitExceeded: true,
      understanding: { status: 'understood', intent: 'Perbandingan periode', period: `${parsed.requestedComparisonCount} bulan` },
      sourceLink: { label: 'Buka Rekap Limbah', to: '/rekap-limbah' },
    };
  }

  const diagnosticIntents = new Set(['data_completeness', 'missing_rooms', 'duplicate_data', 'data_anomalies', 'last_transport', 'transport_gap', 'transport_count', 'average_transport', 'transport_dates']);
  const balanceIntents = new Set(['waste_summary', 'analysis', 'remaining', 'opening_balance', 'available_total', 'transport_coverage', 'comparison']);
  const transportIntents = new Set(['transported', 'last_transport', 'transport_gap', 'transport_count', 'average_transport', 'transport_dates', 'transport_coverage']);
  const recapOptions = {
    knownRooms: roomNames,
    includeBalance: balanceIntents.has(parsed.intent),
    includeTransport: balanceIntents.has(parsed.intent) || transportIntents.has(parsed.intent),
    includePrevious: parsed.intent === 'analysis' || (parsed.intent === 'comparison' && !parsed.comparisonPeriod && !parsed.comparisonPeriods),
    includeDiagnostics: diagnosticIntents.has(parsed.intent),
  };
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
      parsed.intent === 'comparison' && parsed.comparisonPeriod
        ? fetchRecap(parsed.comparisonPeriod.start, parsed.comparisonPeriod.end, { ...recapOptions, includePrevious: false })
        : null,
    ]);
  const pendingCount = typeof window === 'undefined' ? 0 : getOfflineQueue().filter(item => ['limbah_padat', 'limbah_ruangan', 'pengangkutan_limbah'].includes(item.table)).length;
  return {
    ...buildWasteAnswer(parsed, recap, comparisonRecap, periodRecaps),
    dataStatus: { fetchedAt: new Date().toISOString(), pendingCount, online: typeof navigator === 'undefined' ? true : navigator.onLine },
  };
}
