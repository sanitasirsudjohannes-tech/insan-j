import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildLocalReport,
  detectSensitiveData,
  formatReportPeriod,
  preservesNumericFacts,
  validateReportPayload,
} from '../src/lib/reportAssistant.js';

const validPayload = {
  reportType: 'medical_waste',
  period: { start: '2026-09-01', end: '2026-09-30' },
  facts: {
    totalGeneratedKg: 100.25,
    totalTransportedKg: 80,
    remainingKg: 20.25,
    infectiousKg: 60,
    sharpsKg: 10,
    bottleKg: 20,
    cytotoxicKg: 10.25,
  },
  constraints: 'Tidak ada kendala.',
  actions: 'Pemantauan rutin.',
  additionalNotes: '',
  privacyConfirmed: true,
};

test('validasi menerima payload laporan limbah yang lengkap', () => {
  assert.deepEqual(validateReportPayload(validPayload), {});
});

test('validasi menolak angka negatif dan periode terbalik', () => {
  const errors = validateReportPayload({
    ...validPayload,
    period: { start: '2026-09-30', end: '2026-09-01' },
    facts: { ...validPayload.facts, infectiousKg: -1 },
  });
  assert.ok(errors.periodEnd);
  assert.ok(errors.infectiousKg);
});

test('template lokal mempertahankan angka dan struktur BAB', () => {
  const report = buildLocalReport(validPayload);
  assert.match(report, /100\.25 kg/);
  assert.match(report, /BAB I/);
  assert.match(report, /BAB II/);
  assert.match(report, /BAB III/);
  assert.match(report, /draft dan wajib diperiksa/i);
});

test('periode satu hari tidak memakai kata sampai', () => {
  const period = formatReportPeriod({ start: '2026-09-09', end: '2026-09-09' });
  assert.equal(period, '9 September 2026');
});

test('deteksi data sensitif memblokir NIK dan nomor rekam medis', () => {
  assert.equal(detectSensitiveData({ ...validPayload, additionalNotes: 'NIK: 5301010101010001' }), true);
  assert.equal(detectSensitiveData({ ...validPayload, additionalNotes: 'No. RM: A12345' }), true);
  assert.equal(detectSensitiveData(validPayload), false);
});

test('verifikasi hasil AI mendeteksi angka yang berubah atau hilang', () => {
  assert.equal(preservesNumericFacts('Timbulan 100.25 kg dan diangkut 80 kg.', { total: 100.25, transported: 80 }), true);
  assert.equal(preservesNumericFacts('Timbulan 100 kg dan diangkut 80 kg.', { total: 100.25, transported: 80 }), false);
});
