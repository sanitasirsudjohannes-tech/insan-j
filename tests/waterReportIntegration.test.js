import test from 'node:test';
import assert from 'node:assert/strict';
import { summarizeWaterRecords } from '../src/features/report-assistant/domain/waterReportSummary.js';
import { buildWaterTableModels } from '../src/features/report-assistant/exporters/waterTableData.js';

const regulation = 'Permen LHK · 11 · 2025';
const wastewaterRecords = [
  {
    id: 'inlet-1',
    water_type: 'wastewater',
    sample_point: 'Inlet',
    sampled_at: '2026-09-20',
    parameters: [
      { parameter: 'BOD', result: '50', unit: 'mg/L', standard: '<=30', regulation },
      { parameter: 'COD', result: '70', unit: 'mg/L', standard: '<=100', regulation },
    ],
  },
  {
    id: 'outlet-1',
    water_type: 'wastewater',
    sample_point: 'Outlet',
    sampled_at: '2026-09-20',
    parameters: [
      { parameter: 'BOD', result: '20', unit: 'mg/L', standard: '<=30', regulation },
      { parameter: 'pH', result: '7', unit: '', standard: '6-9', regulation },
    ],
  },
];

test('ringkasan IPAL memakai seluruh parameter inlet dan outlet', () => {
  const recap = summarizeWaterRecords(wastewaterRecords, 'wastewater');
  assert.equal(recap.analytics.totalExaminations, 2);
  assert.equal(recap.analytics.totalParameters, 4);
  assert.equal(recap.analytics.inletCount, 1);
  assert.equal(recap.analytics.outletCount, 1);
  assert.equal(recap.analytics.compliantParameters, 3);
  assert.equal(recap.analytics.nonCompliantParameters, 1);
  assert.equal(recap.analytics.unassessedParameters, 0);
  assert.match(recap.facts.inletResult, /BOD: 50 mg\/L/);
  assert.match(recap.facts.inletResult, /COD: 70 mg\/L/);
  assert.match(recap.facts.outletResult, /BOD: 20 mg\/L/);
  assert.match(recap.facts.outletResult, /pH: 7/);
  assert.match(recap.facts.compliance, /Permen LHK/);
});

test('ringkasan air bersih memakai Total coliform dan E. coli per lokasi', () => {
  const recap = summarizeWaterRecords([{
    id: 'clean-1',
    water_type: 'clean',
    sampled_at: '2026-09-21',
    water_clean_locations: { name: 'Bak Utama' },
    parameters: [
      { parameter: 'Total coliform', result: '8', unit: '/100 mL', standard: '<=10', regulation: 'Permenkes · 2 · 2023' },
      { parameter: 'E. coli', result: '2', unit: '/100 mL', standard: '0', regulation: 'Permenkes · 2 · 2023' },
    ],
  }], 'clean_water');
  assert.equal(recap.analytics.totalParameters, 2);
  assert.equal(recap.analytics.compliantParameters, 1);
  assert.equal(recap.analytics.nonCompliantParameters, 1);
  assert.match(recap.facts.parameterResults, /Bak Utama/);
  assert.match(recap.facts.parameterResults, /Total coliform/);
  assert.match(recap.facts.parameterResults, /E\. coli/);
  assert.match(recap.facts.problemParameters, /E\. coli/);
});

test('lampiran Word membuat satu baris untuk setiap parameter IPAL', () => {
  const recap = summarizeWaterRecords(wastewaterRecords, 'wastewater');
  const [table] = buildWaterTableModels('wastewater', recap.analytics);
  assert.equal(table.rows.length, 4);
  assert.deepEqual(table.headers, ['Tanggal', 'Lokasi', 'Parameter', 'Hasil', 'Baku Mutu', 'Rujukan', 'Status']);
  assert.ok(table.rows.some(row => row[1] === 'Inlet' && row[2] === 'COD'));
  assert.ok(table.rows.some(row => row[1] === 'Outlet' && row[2] === 'pH'));
});
