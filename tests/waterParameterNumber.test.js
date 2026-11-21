import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateParameterStatus, normalizeParameters } from '../src/features/pemeriksaan-air/waterHelpers.js';

test('hasil pemeriksaan berformat ribuan id-ID tetap dihitung terhadap baku mutu', () => {
  assert.equal(calculateParameterStatus('1.234,5', '≤ 10'), 'tidak_memenuhi');
  assert.equal(calculateParameterStatus('1.234.567', '10'), 'tidak_memenuhi');
  assert.equal(calculateParameterStatus('12.500', '≤ 20,5'), 'memenuhi');
  assert.equal(calculateParameterStatus('0,5', '≤ 1'), 'memenuhi');
  assert.equal(calculateParameterStatus(' 1.234,5 ', '≤ 10'), 'tidak_memenuhi');
});

test('koma dibaca sebagai pemisah desimal sesuai format id-ID', () => {
  assert.equal(calculateParameterStatus('1,000', '≤ 10'), 'memenuhi');
  assert.equal(calculateParameterStatus('1,000', '0,5'), 'tidak_memenuhi');
});

test('nilai desimal sah tidak diperlakukan sebagai pemisah ribuan', () => {
  assert.equal(calculateParameterStatus('0.500', '≤ 1'), 'memenuhi');
  assert.equal(calculateParameterStatus('0.500', '0,4'), 'tidak_memenuhi');
  assert.equal(calculateParameterStatus('7.4', '6,5-8,5'), 'memenuhi');
  assert.equal(calculateParameterStatus('7,4', '6,5-8,5'), 'memenuhi');
  assert.equal(calculateParameterStatus('1.234', '≤ 1'), 'tidak_memenuhi');
});

test('teks yang tetap tidak dapat dihitung tetap berstatus belum dinilai', () => {
  assert.equal(calculateParameterStatus('Tidak terdeteksi', '≤ 10'), 'belum_dinilai');
  assert.equal(calculateParameterStatus('-3', '≤ 10'), 'belum_dinilai');
  assert.equal(calculateParameterStatus('', '≤ 10'), 'belum_dinilai');
});

test('normalizeParameters memakai status hasil perhitungan yang sama', () => {
  const [parameter] = normalizeParameters([{ parameter: 'Total coliform', result: '1.234,5', unit: '/100 mL', standard: '≤ 10', regulation: 'Permenkes 23/2013' }]);
  assert.equal(parameter.result, '1.234,5');
  assert.equal(parameter.status, 'tidak_memenuhi');
});
