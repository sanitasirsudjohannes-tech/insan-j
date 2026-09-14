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


test('jumlah ruangan dengan dua tanggal meminta pilihan sebelum menghitung', () => {
  const parsed = parseWasteQuestion('Berapa jumlah ruangan tanggal 13 dan 14 September 2026?');
  const clarification = findQuestionClarification(parsed.question, parsed);
  assert.match(clarification.text, /dua tanggal/i);
  assert.equal(clarification.actions.length, 3);
  assert.match(clarification.actions[0].question, /Bandingkan jumlah ruangan tanggal 13 September 2026 dan 14 September 2026/);
});

test('jumlah ruangan bulanan meminta satu tanggal atau pemeriksaan kelengkapan', () => {
  const parsed = parseWasteQuestion('Berapa jumlah ruangan bulan Agustus 2026?');
  const clarification = findQuestionClarification(parsed.question, parsed);
  assert.match(clarification.text, /belum menyebutkan satu tanggal/i);
  assert.equal(clarification.actions.length, 2);
  assert.match(clarification.actions[1].question, /belum input selama Agustus 2026/);
});

test('perbandingan ruangan tanpa dua tanggal tidak langsung dihitung', () => {
  const parsed = parseWasteQuestion('Bandingkan jumlah ruangan tanggal 14 September 2026 dengan sebelumnya');
  const clarification = findQuestionClarification(parsed.question, parsed);
  assert.match(clarification.text, /memerlukan dua tanggal/i);
  assert.match(clarification.actions[0].question, /13 September 2026 dan 14 September 2026/);
});

test('pertanyaan jumlah ruangan yang jelas tidak meminta konfirmasi', () => {
  const parsed = parseWasteQuestion('Berapa jumlah ruangan yang input hari ini?');
  assert.equal(findQuestionClarification(parsed.question, parsed), null);
});


test('tautan jumlah ruangan membuka data ruangan dengan filter tanggal', () => {
  const source = buildSourceLink(parseWasteQuestion('Berapa jumlah ruangan yang input tanggal 14 September 2026'));
  assert.match(source.to, /^\/limbah-ruangan\?/);
  assert.match(source.to, /start=2026-09-14/);
  assert.match(source.to, /end=2026-09-14/);
});
