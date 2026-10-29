import test from 'node:test';
import assert from 'node:assert/strict';
import { buildMedicalWasteTableModels } from '../src/lib/reportTableData.js';

test('model ekspor memuat empat tabel tanpa mengubah data sumber', () => {
  const facts = { openingBalanceKg: 10, totalGeneratedKg: 40, totalTransportedKg: 35, remainingKg: 15 };
  const chartData = {
    composition: [{ name: 'Infeksius', value: 30 }, { name: 'Jarum', value: 10 }],
    timeline: [{ date: '2026-09-01', generated: 40, transported: 35, balance: 15 }],
    rooms: [{ name: 'Ruang A', value: 20 }],
  };
  const snapshot = structuredClone(chartData);
  const tables = buildMedicalWasteTableModels(facts, chartData);
  assert.equal(tables.length, 4);
  assert.deepEqual(tables[0].rows.map(row => row[1]), ['10,00', '40,00', '50,00', '35,00', '15,00']);
  assert.equal(tables[1].rows.at(-1)[3], '100,00%');
  assert.deepEqual(chartData, snapshot);
});
