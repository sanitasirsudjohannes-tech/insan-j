import test from 'node:test';
import assert from 'node:assert/strict';
import { buildQuestionUnderstanding, buildSourceLink, findQuestionClarification } from '../src/features/waste-chat/presentation/questionPresentation.js';
import { parseWasteQuestion } from '../src/lib/wasteQuestionParser.js';

test('pemahaman jawaban menampilkan intent, periode, ruangan, dan jenis', () => {
  const parsed = parseWasteQuestion('Berapa limbah infeksius ICU Agustus 2026?', null, ['ICU']);
  const understanding = buildQuestionUnderstanding(parsed);
  assert.equal(understanding.intent, 'Jenis per ruangan');
  assert.equal(understanding.period, 'Agustus 2026');
  assert.equal(understanding.room, 'ICU');
  assert.equal(understanding.type, 'limbah infeksius');
});

test('pertanyaan ambigu meminta klarifikasi daripada menebak', () => {
  const highest = parseWasteQuestion('Limbah paling tinggi Agustus 2026');
  const highestClarification = findQuestionClarification(highest.question, highest);
  assert.match(highestClarification.text, /belum spesifik/);
  assert.equal(highestClarification.actions.length, 3);
  const missing = parseWasteQuestion('Cek data kosong Agustus 2026');
  assert.equal(findQuestionClarification(missing.question, missing).actions.length, 2);
});

test('tautan sumber diarahkan sesuai kelompok data', () => {
  const transport = buildSourceLink(parseWasteQuestion('Tanggal pengangkutan Agustus 2026'));
  const room = buildSourceLink(parseWasteQuestion('Berapa limbah infeksius ICU Agustus 2026?', null, ['ICU']));
  assert.match(transport.to, /^\/pengangkutan\?/);
  assert.match(room.to, /^\/limbah-dihasilkan\?/);
  assert.match(room.to, /room=ICU/);
});
