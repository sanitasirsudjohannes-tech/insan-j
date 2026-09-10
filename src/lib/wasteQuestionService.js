import { fetchMedicalWasteRecap } from './reportRecap';
import { normalizeAiWasteQuestion, parseWasteQuestion } from './wasteQuestionParser.js';
import { buildWasteAnswer } from './wasteQuestionAnswer.js';
import { interpretWasteQuestionWithAi } from './wasteQuestionAiApi.js';
import { fetchDaftarRuangan, getCachedRuangan } from './api.js';

export async function answerWasteQuestion(question, { signal, context = null, contextPeriod = null, interpretWithAi = interpretWasteQuestionWithAi, fetchRecap = fetchMedicalWasteRecap, fetchRooms = fetchDaftarRuangan } = {}) {
  const conversationContext = context || (contextPeriod ? { period: contextPeriod } : null);
  let roomNames = typeof localStorage === 'undefined' ? [] : getCachedRuangan();
  if (!roomNames.length) roomNames = await fetchRooms();
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
