import { fetchMedicalWasteRecap } from './reportRecap.js';
import { normalizeAiWasteQuestion, parseWasteQuestion } from './wasteQuestionParser.js';
import { buildWasteAnswer } from './wasteQuestionAnswer.js';
import { interpretWasteQuestionWithAi } from './wasteQuestionAiApi.js';
import { fetchDaftarRuangan, getCachedRuangan } from './api.js';
import { findRoomCandidates, resolveKnownRoom } from '../features/waste-chat/parsers/roomNameResolver.js';
import { getOfflineQueue } from './offlineStorage.js';
import { findQuestionClarification } from '../features/waste-chat/presentation/questionPresentation.js';

export async function answerWasteQuestion(question, { signal, context = null, contextPeriod = null, interpretWithAi = interpretWasteQuestionWithAi, fetchRecap = fetchMedicalWasteRecap, fetchRooms = fetchDaftarRuangan } = {}) {
  const conversationContext = context || (contextPeriod ? { period: contextPeriod } : null);
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
  let parsed = parseWasteQuestion(question, conversationContext, roomNames);
  const clarification = findQuestionClarification(question, parsed);
  if (clarification) return { ...clarification, clarification: true, understanding: { status: 'clarification', intent: 'Perlu konfirmasi', period: parsed.period?.label } };
  if (parsed.intent === 'unknown') {
    try {
      const interpretation = await interpretWithAi(question, signal, conversationContext?.period || null);
      parsed = normalizeAiWasteQuestion(question, interpretation);
    } catch (error) {
      return { text: `${error.message || 'AI belum dapat memahami pertanyaan.'} Coba tanyakan sisa limbah, timbulan, pengangkutan, kelengkapan data, pengangkutan terakhir, data ganda, atau data yang perlu diperiksa.`, parsed, aiUnavailable: true };
    }
  }
  if (parsed.intent === 'unknown') return { text: 'Pertanyaan tersebut belum dapat dijawab dari data INSAN-J. Coba tanyakan sisa limbah, timbulan, pengangkutan, kelengkapan data, pengangkutan terakhir, data ganda, atau data yang perlu diperiksa.', parsed, assistedByAi: true };
  if (parsed.intent === 'comparison' && parsed.tooManyComparisonMonths) {
    return {
      text: `Perbandingan melalui Tanya INSAN-J dibatasi maksimal 3 bulan agar jawaban tetap ringkas dan mudah diperiksa. Anda meminta ${parsed.requestedComparisonCount} bulan. Untuk melihat periode yang lebih panjang dan lebih lengkap, buka menu Rekap Limbah lalu pilih periode yang diperlukan.`,
      parsed,
      limitExceeded: true,
      understanding: { status: 'understood', intent: 'Perbandingan periode', period: `${parsed.requestedComparisonCount} bulan` },
      sourceLink: { label: 'Buka Rekap Limbah', to: '/rekap-limbah' },
    };
  }

  const comparisonPeriods = parsed.intent === 'comparison' && parsed.comparisonPeriods?.length >= 2
    ? parsed.comparisonPeriods
    : null;
  const periodRecaps = comparisonPeriods
    ? await Promise.all(comparisonPeriods.map(period =>
      fetchRecap(period.start, period.end, { knownRooms: roomNames })
    ))
    : null;
  const [recap, comparisonRecap] = periodRecaps
    ? [periodRecaps.at(-1), periodRecaps[0]]
    : await Promise.all([
      fetchRecap(parsed.period.start, parsed.period.end, { knownRooms: roomNames }),
      parsed.intent === 'comparison' && parsed.comparisonPeriod
        ? fetchRecap(parsed.comparisonPeriod.start, parsed.comparisonPeriod.end, { knownRooms: roomNames })
        : null,
    ]);
  const pendingCount = typeof window === 'undefined' ? 0 : getOfflineQueue().filter(item => ['limbah_padat', 'limbah_ruangan', 'pengangkutan_limbah'].includes(item.table)).length;
  return {
    ...buildWasteAnswer(parsed, recap, comparisonRecap, periodRecaps),
    assistedByAi: Boolean(parsed.assistedByAi),
    dataStatus: { fetchedAt: new Date().toISOString(), pendingCount, online: typeof navigator === 'undefined' ? true : navigator.onLine },
  };
}
