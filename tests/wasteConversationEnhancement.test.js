import test from 'node:test';
import assert from 'node:assert/strict';
import { parseWasteQuestion } from '../src/lib/wasteQuestionParser.js';
import { buildGeneratedDifferenceAnswer } from '../src/features/waste-chat/answers/generatedDifferenceAnswer.js';
import { findQuestionClarification } from '../src/features/waste-chat/presentation/questionPresentation.js';

test('pertanyaan lanjutan mewarisi periode, tanggal eksplisit menggantikannya', () => {
  const context = parseWasteQuestion('Timbulan Agustus 2026');
  const next = parseWasteQuestion('Ruangan mana paling besar?', context);
  assert.equal(next.intent, 'top_rooms');
  assert.equal(next.period.start, '2026-08-01');
  assert.equal(parseWasteQuestion('Timbulan Juli 2026', context).period.start, '2026-07-01');
  assert.equal(parseWasteQuestion('Timbulan hari ini', context).inheritedPeriod, false);
});

test('kenapa turun membandingkan bulan sebelumnya termasuk lintas tahun', () => {
  const parsed = parseWasteQuestion('Kenapa turun?', parseWasteQuestion('Timbulan Januari 2026'));
  assert.equal(parsed.intent, 'generated_difference');
  assert.equal(parsed.comparisonPeriod.start, '2025-12-01');
  assert.equal(parsed.comparisonPeriod.end, '2025-12-31');
});

test('penjelasan lanjutan mempertahankan dua tanggal pembanding', () => {
  const previous = parseWasteQuestion('Bandingkan limbah tanggal 13 dan 15 September 2026');
  const next = parseWasteQuestion('Jelaskan selisihnya', previous);
  assert.equal(next.comparisonPeriod.start, '2026-09-13');
  assert.equal(next.period.start, '2026-09-15');
});

test('selisih memisahkan manual dan ruangan tanpa mengarang penyebab', () => {
  const parsed = parseWasteQuestion('Mengapa timbulan 13 dan 14 September 2026 berbeda?');
  const before = { facts: { totalGeneratedKg: 100, manualGeneratedKg: 20 }, charts: { roomDetails: [{ name: 'ICU', totalKg: 80 }] } };
  const after = { facts: { totalGeneratedKg: 70, manualGeneratedKg: 10 }, charts: { roomDetails: [{ name: 'ICU', totalKg: 60 }] } };
  const answer = buildGeneratedDifferenceAnswer(parsed, after, before);
  assert.match(answer, /Selisih: turun 30 kg/);
  assert.match(answer, /Catatan manual: turun 10 kg/);
  assert.match(answer, /ICU: 80 → 60 kg \(turun 20 kg\)/);
  assert.match(answer, /penyebab operasional belum dapat ditentukan/i);
});

test('penjelasan tiga bulan meminta pilihan dua periode', () => {
  const question = 'Mengapa timbulan Juli Agustus September 2026 berbeda?';
  const parsed = parseWasteQuestion(question);
  assert.ok(findQuestionClarification(question, parsed));
});

test('kenapa turun tanpa objek atau setelah pengangkutan dikonfirmasi', () => {
  assert.ok(findQuestionClarification('Kenapa turun?', parseWasteQuestion('Kenapa turun?')));
  const previous = parseWasteQuestion('Berat limbah diangkut Agustus 2026');
  assert.ok(findQuestionClarification('Kenapa turun?', parseWasteQuestion('Kenapa turun?', previous)));
});
