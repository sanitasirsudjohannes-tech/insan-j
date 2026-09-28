import { buildWaterAnswer, presentWaterAnswer } from '../answers/waterAnswerBuilder.js';
import { parseWaterQuestion } from '../parsers/waterQuestionParser.js';

export async function answerWaterQuestion(question, { context = null, repository } = {}) {
  const parsed = parseWaterQuestion(question, context);
  if (!parsed.waterType) {
    return {
      text: 'Pilih jenis pemeriksaan yang dimaksud: Air Bersih atau IPAL.',
      clarification: true,
      actions: [
        { label: 'Air Bersih', question: `${question} air bersih` },
        { label: 'IPAL', question: `${question} IPAL` },
      ],
    };
  }

  const source = repository || (await import('./waterQuestionRepository.js')).waterQuestionRepository;
  const index = await source.fetchDateIndex();
  const dates = index.filter(item => item.water_type === parsed.waterType).sort((a, b) => b.sampled_at.localeCompare(a.sampled_at));
  if (parsed.intent === 'dates') return presentWaterAnswer(parsed, buildWaterAnswer(parsed, [], index));
  const sampledAt = parsed.sampledAt || context?.sampledAt || dates[0]?.sampled_at || null;
  const resolved = { ...parsed, sampledAt };
  if (!sampledAt) return presentWaterAnswer(resolved, { text: `Belum ada pemeriksaan ${parsed.waterType === 'clean' ? 'Air Bersih' : 'IPAL'} yang tersimpan.` });
  const records = await source.fetchRecords(parsed.waterType, sampledAt);
  return {
    ...presentWaterAnswer(resolved, buildWaterAnswer(resolved, records, index)),
    dataStatus: { fetchedAt: new Date().toISOString(), pendingCount: 0, online: typeof navigator === 'undefined' ? true : navigator.onLine },
  };
}
