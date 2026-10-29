import test from 'node:test';
import assert from 'node:assert/strict';
import { groupExaminationsByDate, groupExaminationsByMonth } from '../src/features/pemeriksaan-air/domain/waterRecordIndex.js';

const entries = [
  { id: '1', water_type: 'clean', sampled_at: '2026-02-25' },
  { id: '2', water_type: 'clean', sampled_at: '2026-02-25' },
  { id: '3', water_type: 'wastewater', sampled_at: '2026-02-20' },
  { id: '4', water_type: 'clean', sampled_at: '2026-01-10' },
];

test('indeks pemeriksaan mengelompokkan bulan terbaru dan jumlah tiap jenis', () => {
  assert.deepEqual(groupExaminationsByMonth(entries), [
    { month: '2026-02', total: 3, clean: 2, wastewater: 1 },
    { month: '2026-01', total: 1, clean: 1, wastewater: 0 },
  ]);
});

test('indeks tanggal hanya menampilkan jenis dan bulan yang dipilih', () => {
  assert.deepEqual(groupExaminationsByDate(entries, '2026-02', 'clean'), [
    { date: '2026-02-25', total: 2 },
  ]);
  assert.deepEqual(groupExaminationsByDate(entries, '2026-02', 'wastewater'), [
    { date: '2026-02-20', total: 1 },
  ]);
});

test('indeks menerima ringkasan jumlah dari database tanpa baris berulang', () => {
  const summary = [
    { water_type: 'clean', sampled_at: '2026-02-25', total: 14 },
    { water_type: 'wastewater', sampled_at: '2026-02-20', total: 2 },
  ];
  assert.deepEqual(groupExaminationsByMonth(summary), [
    { month: '2026-02', total: 16, clean: 14, wastewater: 2 },
  ]);
  assert.deepEqual(groupExaminationsByDate(summary, '2026-02', 'clean'), [
    { date: '2026-02-25', total: 14 },
  ]);
});
