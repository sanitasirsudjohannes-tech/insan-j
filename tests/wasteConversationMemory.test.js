import test from 'node:test';
import assert from 'node:assert/strict';
import { parseWasteQuestion as parse } from '../src/lib/wasteQuestionParser.js';
import { normalizeConversationQuestion } from '../src/features/waste-chat/parsers/conversationMemory.js';
import { buildWasteAnswer } from '../src/lib/wasteQuestionAnswer.js';

const rooms = ['ICU', 'OK', 'Bugenvil 2'];
const recap = { facts: { openingBalanceKg: 10, totalGeneratedKg: 20, totalTransportedKg: 5, remainingKg: 25, infectiousKg: 20, sharpsKg: 0, bottleKg: 0, cytotoxicKg: 0 }, charts: { roomTotals: [], rooms: [], roomDetails: [{ name: 'ICU', totalKg: 20, infectiousKg: 20 }], timeline: [] }, analytics: { performance: {}, changes: {} }, diagnostics: {} };

test('ingatan dua periode tetap dibawa melalui konteks jawaban', () => {
  const first = buildWasteAnswer(parse('Berapa infeksius ICU September 2025?', null, rooms), recap);
  const secondParsed = parse('Kalau Agustus?', first.context, rooms);
  assert.equal(secondParsed.period.start, '2025-08-01');
  const second = buildWasteAnswer(secondParsed, recap);
  const compared = parse('Bandingkan keduanya.', second.context, rooms);
  assert.equal(compared.intent, 'comparison');
  assert.equal(compared.comparisonPeriod.start, '2025-08-01');
  assert.equal(compared.period.start, '2025-09-01');
  assert.equal(compared.roomName, 'ICU');
  assert.equal(compared.type.key, 'infectiousKg');
});

test('koreksi ruangan mempertahankan dua periode dan jenis', () => {
  const before = parse('Bandingkan infeksius ICU Agustus dan September 2025', null, rooms);
  const corrected = parse('Bukan ICU, maksud saya OK.', before, rooms);
  assert.equal(corrected.intent, 'comparison');
  assert.equal(corrected.roomName, 'OK');
  assert.equal(corrected.type.key, 'infectiousKg');
  assert.deepEqual(corrected.comparisonPeriod, before.comparisonPeriod);
  assert.deepEqual(corrected.period, before.period);
});

test('koreksi salah satu bulan pembanding tidak mengganti bulan lainnya', () => {
  const before = parse('Bandingkan infeksius ICU Agustus dan September 2025', null, rooms);
  const corrected = parse('Bukan Agustus, maksud saya Juli.', before, rooms);
  assert.equal(corrected.comparisonPeriod.start, '2025-07-01');
  assert.equal(corrected.period.start, '2025-09-01');
});

test('koreksi dan perbandingan tanpa ingatan meminta klarifikasi', () => {
  assert.ok(parse('Bukan ICU, maksud saya OK.', null, rooms).conversationClarification);
  assert.ok(parse('Bandingkan keduanya.').conversationClarification);
  assert.ok(parse('Bandingkan keduanya.', parse('Timbulan September 2026')).conversationClarification);
});

test('pertanyaan baru tentang ruangan lain tidak memakai dua periode objek lama', () => {
  const a = parse('Infeksius ICU September 2026', null, rooms);
  const b = parse('Kalau Agustus?', a, rooms);
  const next = parse('Berapa timbulan OK Juli 2026?', b, rooms);
  assert.equal(next.periodHistory.length, 1);
});

test('kamus singkatan memakai batas kata dan tidak mengubah nama', () => {
  assert.equal(normalizeConversationQuestion('Brp timbulan kmrn?').text, 'berapa timbulan kemarin?');
  assert.equal(parse('Brp limbah kmren?').intent, 'generated');
  assert.equal(normalizeConversationQuestion('ICU Bugenvil 2').text, 'ICU Bugenvil 2');
});

test('penjelasan perhitungan dan favorit relatif disertakan tanpa query tambahan', () => {
  const answer = buildWasteAnswer(parse('Berapa sisa limbah hari ini?'), recap);
  assert.match(answer.context.calculation, /10 kg \+ timbulan 20 kg − pengangkutan 5 kg = sisa akhir 25 kg/);
  assert.equal(answer.favoriteQuestion, 'Berapa sisa limbah hari ini');
  assert.equal(parse('Angka ini dari mana?', answer.context).intent, 'calculation_help');
});

test('tindak lanjut mendahulukan temuan konkret', () => {
  const answer = buildWasteAnswer(parse('Apakah ada data yang perlu diperiksa Januari 2026?'), { ...recap, diagnostics: { duplicateRoomDates: [{ date: '2026-01-01', roomName: 'ICU', count: 2 }] } });
  assert.match(answer.followUps[0].label, /catatan ganda/);
});

test('cek harian tanpa konteks memakai satu tanggal', () => {
  const parsed = parse('Cek harian');
  assert.equal(parsed.intent, 'daily_review');
  assert.equal(parsed.period.scope, 'day');
});

test('grafik perbandingan mengikuti ruangan dan jenis yang diingat', () => {
  const parsed = parse('Bandingkan infeksius ICU Agustus dan September 2025', null, rooms);
  const answer = buildWasteAnswer(parsed, { ...recap, facts: { ...recap.facts, totalGeneratedKg: 999 } }, recap);
  assert.deepEqual(answer.cards, []);
  assert.deepEqual(answer.visualization.items.map(item => item.value), [20, 20]);
});
