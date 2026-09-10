import { fetchMedicalWasteRecap } from './reportRecap.js';
import { normalizeAiWasteQuestion, parseWasteQuestion } from './wasteQuestionParser.js';
import { buildWasteAnswer } from './wasteQuestionAnswer.js';
import { interpretWasteQuestionWithAi } from './wasteQuestionAiApi.js';
import { fetchDaftarRuangan, getCachedRuangan } from './api.js';
import { findRoomCandidates, resolveKnownRoom } from '../features/waste-chat/parsers/roomNameResolver.js';

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
  if (parsed.intent === 'unknown') {
    try {
      const interpretation = await interpretWithAi(question, signal, conversationContext?.period || null);
      parsed = normalizeAiWasteQuestion(question, interpretation);
    } catch (error) {
      return { text: `${error.message || 'AI belum dapat memahami pertanyaan.'} Coba tanyakan sisa limbah, timbulan, pengangkutan, jenis limbah, ruangan terbesar, rata-rata, atau perbandingan periode.`, parsed, aiUnavailable: true };
    }
  }
  if (parsed.intent === 'unknown') return { text: 'Pertanyaan tersebut belum dapat dijawab dari data INSAN-J. Coba tanyakan sisa limbah, timbulan, pengangkutan, jenis limbah, ruangan terbesar, rata-rata, atau perbandingan periode.', parsed, assistedByAi: true };
  const [recap, comparisonRecap] = await Promise.all([
    fetchRecap(parsed.period.start, parsed.period.end),
    parsed.intent === 'comparison' && parsed.comparisonPeriod
      ? fetchRecap(parsed.comparisonPeriod.start, parsed.comparisonPeriod.end)
      : null,
  ]);
  return { ...buildWasteAnswer(parsed, recap, comparisonRecap), assistedByAi: Boolean(parsed.assistedByAi) };
}
