import { REPORT_TYPES } from '../constants/reportTypes.js';

export function validateReportPayload(payload = {}) {
  const errors = {};
  const config = REPORT_TYPES[payload.reportType];
  if (!config) errors.reportType = 'Pilih jenis laporan yang valid.';
  if (!payload.period?.start) errors.periodStart = 'Tanggal awal wajib diisi.';
  if (!payload.period?.end) errors.periodEnd = 'Tanggal akhir wajib diisi.';
  if (payload.period?.start && payload.period?.end && payload.period.start > payload.period.end) {
    errors.periodEnd = 'Tanggal akhir tidak boleh sebelum tanggal awal.';
  }
  config?.fields.forEach(field => {
    const value = payload.facts?.[field.key];
    if (field.required && String(value ?? '').trim() === '') errors[field.key] = `${field.label} wajib diisi.`;
    if (field.type === 'number' && value !== '' && value !== undefined && (!Number.isFinite(Number(value)) || (!field.allowNegative && Number(value) < 0))) {
      errors[field.key] = `${field.label} harus berupa angka ${field.allowNegative ? 'yang valid' : 'nol atau lebih'}.`;
    }
  });
  return errors;
}

