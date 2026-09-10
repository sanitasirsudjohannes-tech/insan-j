import test from 'node:test';
import assert from 'node:assert/strict';
import { buildWasteAnswer } from '../src/lib/wasteQuestionAnswer.js';
import { normalizeAiWasteQuestion, parseWasteQuestion } from '../src/lib/wasteQuestionParser.js';

const recap = {
  facts: { openingBalanceKg: 10, totalGeneratedKg: 40, totalTransportedKg: 35, remainingKg: 15, infectiousKg: 30, sharpsKg: 5, bottleKg: 3, cytotoxicKg: 2 },
  charts: { rooms: [{ name: 'Ruang A', value: 20 }], roomDetails: [{ name: 'ICU', infectiousKg: 12, sharpsKg: 3, bottleKg: 2, cytotoxicKg: 1, totalKg: 18 }] },
  analytics: { performance: { averageDailyKg: 1.29, transportedCoveragePercent: 70 }, changes: { generatedPercent: 10, transportedPercent: -5, remainingKg: 5 }, dominantType: { name: 'limbah infeksius', current: 30 } },
};

test('jawaban sisa menjelaskan sumber perhitungan', () => {
  const answer = buildWasteAnswer(parseWasteQuestion('Sisa limbah Juli 2026?'), recap);
  assert.match(answer.text, /15 kg/);
  assert.match(answer.text, /sisa awal 10 kg/);
  assert.match(answer.text, /pengangkutan 35 kg/);
});

test('jawaban rincian jenis menampilkan seluruh jenis dan total', () => {
  const answer = buildWasteAnswer(parseWasteQuestion('Rincian limbah berdasarkan jenis tanggal 5 September 2026'), recap);
  assert.match(answer.text, /limbah infeksius 30 kg/);
  assert.match(answer.text, /limbah jarum suntik 5 kg/);
  assert.match(answer.text, /limbah botol obat 3 kg/);
  assert.match(answer.text, /limbah sitotoksik 2 kg/);
  assert.match(answer.text, /Totalnya 40 kg/);
});

test('jawaban dapat menampilkan total jenis dari ruangan tertentu per tanggal', () => {
  const answer = buildWasteAnswer(parseWasteQuestion('Berapa infeksius ruangan ICU tanggal 5 September 2026?'), recap);
  assert.match(answer.text, /limbah infeksius dari ICU/);
  assert.match(answer.text, /12 kg/);
  assert.match(answer.text, /5 September 2026/);
});

test('ringkasan data limbah memuat alur dan komposisi utama', () => {
  const answer = buildWasteAnswer(parseWasteQuestion('Rincian data limbah Juli 2026'), recap);
  assert.match(answer.text, /sisa awal 10 kg/);
  assert.match(answer.text, /timbulan 40 kg/);
  assert.match(answer.text, /diangkut 35 kg/);
  assert.match(answer.text, /sisa akhir 15 kg/);
  assert.match(answer.text, /limbah infeksius 30 kg/);
});

test('jawaban ruangan berasal dari data rekap terurut', () => {
  const answer = buildWasteAnswer(parseWasteQuestion('Ruangan terbesar Juli 2026?'), recap);
  assert.match(answer.text, /Ruang A/);
  assert.match(answer.text, /20 kg/);
});

test('jawaban timbulan tahunan menyebut cakupan tahun penuh', () => {
  const answer = buildWasteAnswer(parseWasteQuestion('Timbulan limbah tahun 2026?'), recap);
  assert.match(answer.text, /selama tahun 2026/);
  assert.match(answer.text, /40 kg/);
});

test('hasil pemahaman AI divalidasi lalu dijawab dari data rekap', () => {
  const parsed = normalizeAiWasteQuestion('Berapa yang belum sempat dibawa pada tanggal lima September?', {
    intent: 'remaining', year: 2026, month: 9, day: 5, typeKey: null, inferredYear: true,
  });
  const answer = buildWasteAnswer(parsed, recap);
  assert.equal(parsed.period.start, '2026-09-05');
  assert.equal(parsed.period.end, '2026-09-05');
  assert.equal(parsed.assistedByAi, true);
  assert.match(answer.text, /15 kg/);
});

test('angka pecahan pada jawaban dibulatkan tanpa desimal', () => {
  const fractionalRecap = {
    ...recap,
    facts: { ...recap.facts, totalGeneratedKg: 40.6 },
  };
  const answer = buildWasteAnswer(parseWasteQuestion('Timbulan Juli 2026?'), fractionalRecap);
  assert.match(answer.text, /41 kg/);
  assert.doesNotMatch(answer.text, /40[,.]6/);
});
