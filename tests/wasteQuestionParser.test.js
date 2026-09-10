import test from 'node:test';
import assert from 'node:assert/strict';
import { parseWasteQuestion } from '../src/lib/wasteQuestionParser.js';

test('pertanyaan sisa dengan bulan angka diterjemahkan menjadi periode penuh', () => {
  const result = parseWasteQuestion('Sisa limbah bulan 7 tahun 2026 berapa?');
  assert.equal(result.intent, 'remaining');
  assert.equal(result.period.start, '2026-07-01');
  assert.equal(result.period.end, '2026-07-31');
});

test('parser mengenali jenis, ruangan, dan perbandingan', () => {
  assert.equal(parseWasteQuestion('Berapa infeksius Agustus 2026?').type.key, 'infectiousKg');
  assert.equal(parseWasteQuestion('Ruangan mana penghasil terbesar Juli 2026?').intent, 'top_rooms');
  assert.equal(parseWasteQuestion('Bandingkan Juli 2026 dengan sebelumnya').intent, 'comparison');
});

test('pertanyaan yang hanya menyebut tahun menggunakan satu tahun penuh', () => {
  const result = parseWasteQuestion('Berapa data timbulan limbah tahun 2026?');
  assert.equal(result.intent, 'generated');
  assert.equal(result.period.scope, 'year');
  assert.equal(result.period.month, null);
  assert.equal(result.period.start, '2026-01-01');
  assert.equal(result.period.end, '2026-12-31');
  assert.equal(result.period.label, 'tahun 2026');
});

test('bulan ini tetap menggunakan bulan berjalan meskipun tahun disebutkan', () => {
  const result = parseWasteQuestion('Berapa timbulan bulan ini tahun 2026?');
  assert.equal(result.period.scope, 'month');
  assert.equal(result.period.year, 2026);
  assert.notEqual(result.period.month, null);
});

test('tahun ini diterjemahkan sebagai tahun berjalan penuh', () => {
  const result = parseWasteQuestion('Berapa timbulan limbah tahun ini?');
  assert.equal(result.period.scope, 'year');
  assert.match(result.period.start, /^20\d{2}-01-01$/);
  assert.match(result.period.end, /^20\d{2}-12-31$/);
});
