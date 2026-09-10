import { fetchMedicalWasteRecap } from './reportRecap';
import { normalizeAiWasteQuestion, parseWasteQuestion } from './wasteQuestionParser.js';
import { buildWasteAnswer } from './wasteQuestionAnswer.js';
import { interpretWasteQuestionWithAi } from './wasteQuestionAiApi.js';

export async function answerWasteQuestion(question, { signal, contextPeriod = null, interpretWithAi = interpretWasteQuestionWithAi, fetchRecap = fetchMedicalWasteRecap } = {}) {
  let parsed = parseWasteQuestion(question, contextPeriod);
  if (parsed.intent === 'unknown') {
    try {
      const interpretation = await interpretWithAi(question, signal, contextPeriod);
      parsed = normalizeAiWasteQuestion(question, interpretation);
    } catch (error) {
      return { text: `${error.message || 'AI belum dapat memahami pertanyaan.'} Coba tanyakan sisa limbah, timbulan, pengangkutan, jenis limbah, ruangan terbesar, rata-rata, atau perbandingan periode.`, parsed, aiUnavailable: true };
    }
  }
  if (parsed.intent === 'unknown') return { text: 'Pertanyaan tersebut belum dapat dijawab dari data INSAN-J. Coba tanyakan sisa limbah, timbulan, pengangkutan, jenis limbah, ruangan terbesar, rata-rata, atau perbandingan periode.', parsed, assistedByAi: true };
  const recap = await fetchRecap(parsed.period.start, parsed.period.end);
  return { ...buildWasteAnswer(parsed, recap), assistedByAi: Boolean(parsed.assistedByAi) };
}
