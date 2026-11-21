import { REPORT_TYPES } from '../constants/reportTypes.js';

export function validateReportPayload(payload = {}) {
  const errors = {};
  const config = REPORT_TYPES[payload.reportType];
  if (!config) errors.reportType = 'Pilih jenis laporan yang valid.';
  const singleSamplingDate = ['clean_water', 'wastewater'].includes(payload.reportType);
  if (!payload.period?.start) errors.periodStart = singleSamplingDate ? 'Tanggal pengambilan sampel wajib diisi.' : 'Tanggal awal wajib diisi.';
  if (!singleSamplingDate && !payload.period?.end) errors.periodEnd = 'Tanggal akhir wajib diisi.';
  if (!singleSamplingDate && payload.period?.start && payload.period?.end && payload.period.start > payload.period.end) {
    errors.periodEnd = 'Tanggal akhir tidak boleh sebelum tanggal awal.';
  }
  if (payload.reportType === 'wastewater' && payload.analytics) {
    if (!payload.analytics.inletCount) errors.inletResult = 'Data pemeriksaan inlet belum tersedia pada tanggal ini.';
    if (!payload.analytics.outletCount) errors.outletResult = 'Data pemeriksaan outlet belum tersedia pada tanggal ini.';
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
