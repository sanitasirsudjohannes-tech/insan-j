import test from 'node:test';
import assert from 'node:assert/strict';
import { monthRange, normalizeParameters, validateExamination } from '../src/features/pemeriksaan-air/waterHelpers.js';

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
