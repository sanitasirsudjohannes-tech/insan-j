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
