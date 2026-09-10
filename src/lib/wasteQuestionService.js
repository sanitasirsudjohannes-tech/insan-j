import { fetchMedicalWasteRecap } from './reportRecap';
import { parseWasteQuestion } from './wasteQuestionParser.js';
import { buildWasteAnswer } from './wasteQuestionAnswer.js';

export async function answerWasteQuestion(question) {
  const parsed = parseWasteQuestion(question);
  if (parsed.intent === 'unknown') return { text: 'Saya belum memahami pertanyaan tersebut. Coba tanyakan sisa limbah, timbulan, pengangkutan, jenis limbah, ruangan terbesar, rata-rata, atau perbandingan periode.', parsed };
  const recap = await fetchMedicalWasteRecap(parsed.period.start, parsed.period.end);
  return buildWasteAnswer(parsed, recap);
}
