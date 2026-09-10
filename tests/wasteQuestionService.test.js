import test from 'node:test';
import assert from 'node:assert/strict';
import { buildWasteAnswer } from '../src/lib/wasteQuestionAnswer.js';
import { normalizeAiWasteQuestion, parseWasteQuestion } from '../src/lib/wasteQuestionParser.js';

const recap = {
  facts: { openingBalanceKg: 10, totalGeneratedKg: 40, totalTransportedKg: 35, remainingKg: 15, infectiousKg: 30 },
  charts: { rooms: [{ name: 'Ruang A', value: 20 }] },
  analytics: { performance: { averageDailyKg: 1.29, transportedCoveragePercent: 70 }, changes: { generatedPercent: 10, transportedPercent: -5, remainingKg: 5 }, dominantType: { name: 'limbah infeksius', current: 30 } },
};

test('jawaban sisa menjelaskan sumber perhitungan', () => {
  const answer = buildWasteAnswer(parseWasteQuestion('Sisa limbah Juli 2026?'), recap);
  assert.match(answer.text, /15,00 kg/);
  assert.match(answer.text, /sisa awal 10,00 kg/);
  assert.match(answer.text, /pengangkutan 35,00 kg/);
});

test('jawaban ruangan berasal dari data rekap terurut', () => {
  const answer = buildWasteAnswer(parseWasteQuestion('Ruangan terbesar Juli 2026?'), recap);
  assert.match(answer.text, /Ruang A/);
  assert.match(answer.text, /20,00 kg/);
});

test('jawaban timbulan tahunan menyebut cakupan tahun penuh', () => {
  const answer = buildWasteAnswer(parseWasteQuestion('Timbulan limbah tahun 2026?'), recap);
  assert.match(answer.text, /selama tahun 2026/);
  assert.match(answer.text, /40,00 kg/);
});

test('hasil pemahaman AI divalidasi lalu dijawab dari data rekap', () => {
  const parsed = normalizeAiWasteQuestion('Berapa yang belum sempat dibawa pada tanggal lima September?', {
    intent: 'remaining', year: 2026, month: 9, day: 5, typeKey: null, inferredYear: true,
  });
  const answer = buildWasteAnswer(parsed, recap);
  assert.equal(parsed.period.start, '2026-09-05');
  assert.equal(parsed.period.end, '2026-09-05');
  assert.equal(parsed.assistedByAi, true);
  assert.match(answer.text, /15,00 kg/);
});
