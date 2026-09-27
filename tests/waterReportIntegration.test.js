import test from 'node:test';
import assert from 'node:assert/strict';
import { summarizeWaterRecords } from '../src/features/report-assistant/domain/waterReportSummary.js';
import { buildWaterTableModels } from '../src/features/report-assistant/exporters/waterTableData.js';
import { buildLocalReport } from '../src/features/report-assistant/domain/reportBuilder.js';

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

test('Word air bersih membuat tabel hasil tanpa mengulang tabel pada lampiran', () => {
  const records = [{
    id: 'clean-1', water_type: 'clean', sampled_at: '2026-09-21',
    water_clean_locations: { name: 'Bak Utama' },
    parameters: [
      { parameter: 'Total coliform', result: '8', unit: '/100 mL', standard: '<=10', regulation: 'Permenkes · 2 · 2023', status: 'memenuhi' },
      { parameter: 'E. coli', result: '2', unit: '/100 mL', standard: '0', regulation: 'Permenkes · 2 · 2023', status: 'tidak_memenuhi' },
    ],
  }];
  const tables = buildWaterTableModels('clean_water', { records });
  const [summary] = tables;
  assert.equal(tables.length, 1);
  assert.equal(summary.placement, 'results');
  assert.deepEqual(summary.headers, ['Tanggal', 'Lokasi/Bak', 'Total coliform', 'Status', 'E. coli', 'Status']);
  assert.deepEqual(summary.rows[0], ['21 Sep 2026', 'Bak Utama', '8 /100 mL', 'Memenuhi', '2 /100 mL', 'Tidak memenuhi']);
  assert.deepEqual(summary.notes, [
    'Baku mutu: Total coliform: <=10 /100 mL; E. coli: 0 /100 mL',
    'Rujukan: Permenkes · 2 · 2023',
  ]);
});

test('narasi hasil air bersih tidak mengulang daftar parameter panjang ketika rekap tersedia', () => {
  const report = buildLocalReport({
    reportType: 'clean_water',
    period: { start: '2026-02-01', end: '2026-02-28' },
    facts: {
      samplingLocation: 'Bak Teratai',
      parameterResults: '25 Feb 2026 — Bak Teratai: Total coliform: 0; E. coli: 15',
      problemParameters: 'E. coli', evaluation: 'Perlu tindak lanjut', remonitoring: 'Uji ulang',
    },
    analytics: { records: [{ id: 'clean-1' }], totalExaminations: 1, totalParameters: 2 },
    constraints: '', actions: '', additionalNotes: '',
  });
  assert.doesNotMatch(report, /25 Feb 2026 — Bak Teratai/);
  assert.doesNotMatch(report, /berdasarkan kegiatan dan data yang tersedia/);
  assert.doesNotMatch(report, /Data bersumber dari catatan petugas/);
  assert.match(report, /pengambilan sampel air bersih dan hasil pemeriksaan sampel di laboratorium/);
  assert.match(report, /catatan lokasi dan waktu pengambilan sampel/);
  assert.match(report, /Rincian hasil pemeriksaan setiap lokasi disajikan pada tabel berikut/);
  assert.match(report, /hasil laboratorium asli dilampirkan/);
});

test('lampiran Word membuat satu baris untuk setiap parameter IPAL', () => {
  const recap = summarizeWaterRecords(wastewaterRecords, 'wastewater');
  const [table] = buildWaterTableModels('wastewater', recap.analytics);
  assert.equal(table.placement, 'results');
  assert.equal(table.rows.length, 4);
  assert.deepEqual(table.headers, ['Tanggal', 'Lokasi', 'Parameter', 'Hasil', 'Baku Mutu', 'Rujukan', 'Status']);
  assert.ok(table.rows.some(row => row[1] === 'Inlet' && row[2] === 'COD'));
  assert.ok(table.rows.some(row => row[1] === 'Outlet' && row[2] === 'pH'));
});
