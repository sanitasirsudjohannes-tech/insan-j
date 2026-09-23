import test from 'node:test';
import assert from 'node:assert/strict';
import { createCleanWaterParameters, monthRange, normalizeParameters, toCleanWaterParameters, validateExamination } from '../src/features/pemeriksaan-air/waterHelpers.js';

test('monthRange handles December without timezone drift', () => {
  assert.deepEqual(monthRange('2026-12'), { start: '2026-12-01', end: '2027-01-01' });
});

test('normalizeParameters removes empty rows and trims values', () => {
  assert.deepEqual(normalizeParameters([
    { parameter: ' pH ', result: ' 7.1 ', unit: '', standard: '6-9', status: 'memenuhi' },
    { parameter: '', result: '', status: 'memenuhi' },
  ]), [{ parameter: 'pH', result: '7.1', unit: '', standard: '6-9', status: 'memenuhi' }]);
});

test('clean water examination requires a managed location', () => {
  const message = validateExamination({
    water_type: 'clean', sampled_at: '2026-09-23', clean_water_location_id: '', parameters: [{ parameter: 'pH', result: '7' }],
  });
  assert.equal(message, 'Pilih lokasi pemeriksaan air bersih.');
});

test('air bersih starts with Coliform and E. coli per 100 mL', () => {
  assert.deepEqual(createCleanWaterParameters().map(item => [item.parameter, item.unit]), [
    ['Coliform', '/100 mL'], ['E. coli', '/100 mL'],
  ]);
});

test('air bersih requires both test results', () => {
  const parameters = createCleanWaterParameters();
  parameters[0].result = '10';
  assert.match(validateExamination({
    water_type: 'clean', sampled_at: '2026-09-23', clean_water_location_id: 'bak-a', parameters,
  }), /Coliform dan E. coli/);
  parameters[1].result = '0';
  assert.equal(validateExamination({
    water_type: 'clean', sampled_at: '2026-09-23', clean_water_location_id: 'bak-a', parameters,
  }), null);
});

test('old E. coli naming maps to fixed row without losing its result', () => {
  const rows = toCleanWaterParameters([{ parameter: 'E.coli', result: '0', unit: 'CFU/100 mL', status: 'memenuhi' }]);
  assert.deepEqual(rows[1], { parameter: 'E. coli', result: '0', unit: '/100 mL', standard: '', status: 'memenuhi' });
});
