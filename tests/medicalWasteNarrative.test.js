import test from 'node:test';
import assert from 'node:assert/strict';
import { buildMedicalWasteAnalysis, buildMedicalWasteConclusion, buildMedicalWasteRecommendations } from '../src/lib/medicalWasteNarrative.js';

const facts = { openingBalanceKg: 10, totalGeneratedKg: 40, totalTransportedKg: 30, remainingKg: 20 };
const analytics = {
  previous: { generatedKg: 20, transportedKg: 15 },
  changes: { generatedPercent: 100, transportedPercent: 100, remainingKg: 10 },
  performance: { averageDailyKg: 4, transportedCoveragePercent: 60, accumulationIncreased: true, negativeBalance: false },
  dominantType: { name: 'limbah infeksius', current: 30 },
  highestTypeIncrease: { name: 'limbah infeksius', changePercent: 50 },
  topRoom: { name: 'Ruang A', current: 25 },
  highestRoomIncrease: { name: 'Ruang A', change: 10 },
  unusualDays: [{ date: '2026-09-03', value: 9 }],
  comparisonPeriod: { start: '2026-08-22', end: '2026-08-31' },
};

test('narasi lokal memuat perbandingan dan temuan prioritas', () => {
  const result = buildMedicalWasteAnalysis(facts, analytics);
  assert.match(result, /meningkat sebesar 20 kg atau 100%/);
  assert.match(result, /Ruang A/);
  assert.match(result, /2026-09-03/);
});

test('rekomendasi dan kesimpulan berubah mengikuti hasil kalkulasi', () => {
  assert.match(buildMedicalWasteRecommendations(facts, analytics), /Evaluasi jadwal dan kapasitas pengangkutan/);
  assert.match(buildMedicalWasteConclusion(facts, analytics), /meningkat 100%/);
});
