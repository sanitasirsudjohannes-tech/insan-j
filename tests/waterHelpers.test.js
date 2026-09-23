import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateParameterStatus, createCleanWaterParameters, monthRange, normalizeParameters, toCleanWaterParameters, validateExamination } from '../src/features/pemeriksaan-air/waterHelpers.js';

test('monthRange handles December without timezone drift', () => {
  assert.deepEqual(monthRange('2026-12'), { start: '2026-12-01', end: '2027-01-01' });
});

test('normalizeParameters removes empty rows and trims values', () => {
  assert.deepEqual(normalizeParameters([
    { parameter: ' pH ', result: ' 7.1 ', unit: '', standard: '6-9', status: 'belum_dinilai' },
    { parameter: '', result: '', status: 'memenuhi' },
  ]), [{ parameter: 'pH', result: '7.1', unit: '', standard: '6-9', status: 'memenuhi' }]);
});

test('clean water examination requires a managed location', () => {
  const message = validateExamination({
    water_type: 'clean', sampled_at: '2026-09-23', clean_water_location_id: '', parameters: [{ parameter: 'pH', result: '7' }],
  });
  assert.equal(message, 'Pilih lokasi pemeriksaan air bersih.');
});

test('air bersih starts with Total coliform and E. coli per 100 mL', () => {
  assert.deepEqual(createCleanWaterParameters().map(item => [item.parameter, item.unit]), [
    ['Total coliform', '/100 mL'], ['E. coli', '/100 mL'],
  ]);
});

test('air bersih requires both test results', () => {
  const parameters = createCleanWaterParameters();
  parameters[0].result = '10';
  assert.match(validateExamination({
    water_type: 'clean', sampled_at: '2026-09-23', clean_water_location_id: 'bak-a', parameters,
  }), /Total coliform dan E. coli/);
  parameters[1].result = '0';
  assert.equal(validateExamination({
    water_type: 'clean', sampled_at: '2026-09-23', clean_water_location_id: 'bak-a', parameters,
  }), null);
});

test('old E. coli naming maps to fixed row without losing its result', () => {
  const rows = toCleanWaterParameters([{ parameter: 'E.coli', result: '0', unit: 'CFU/100 mL', status: 'memenuhi' }]);
  assert.deepEqual(rows[1], { parameter: 'E. coli', result: '0', unit: '/100 mL', standard: '', status: 'belum_dinilai' });
});

test('old Coliform row maps to Total coliform', () => {
  const rows = toCleanWaterParameters([{ parameter: 'Coliform', result: '12', standard: '50' }]);
  assert.deepEqual([rows[0].parameter, rows[0].result, rows[0].status], ['Total coliform', '12', 'memenuhi']);
});

test('numeric standards calculate maximum, minimum and inclusive range', () => {
  assert.equal(calculateParameterStatus('51', '≤50'), 'tidak_memenuhi');
  assert.equal(calculateParameterStatus('50', '50 /100 mL'), 'memenuhi');
  assert.equal(calculateParameterStatus('6', '6-9'), 'memenuhi');
  assert.equal(calculateParameterStatus('5,5', '≥6'), 'tidak_memenuhi');
  assert.equal(calculateParameterStatus('0', '0'), 'memenuhi');
});

test('unparseable values remain unassessed', () => {
  assert.equal(calculateParameterStatus('tidak terdeteksi', '0'), 'belum_dinilai');
  assert.equal(calculateParameterStatus('5', 'sesuai ketentuan'), 'belum_dinilai');
  assert.equal(calculateParameterStatus('5', '9-6'), 'belum_dinilai');
});
