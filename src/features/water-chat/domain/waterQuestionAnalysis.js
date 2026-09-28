import { calculateParameterStatus } from '../../pemeriksaan-air/waterHelpers.js';

export const locationName = record => record.water_type === 'clean'
  ? record.water_clean_locations?.name || 'Lokasi tidak diketahui'
  : record.sample_point || 'Titik tidak diketahui';

export const normalizeWaterRecords = records => records.map(record => ({
  ...record,
  parameters: (record.parameters || []).map(parameter => ({
    ...parameter,
    status: calculateParameterStatus(parameter.result, parameter.standard),
  })),
}));

export function analyzeWaterRecords(records) {
  const normalized = normalizeWaterRecords(records);
  const parameters = normalized.flatMap(record => record.parameters.map(parameter => ({
    ...parameter, location: locationName(record), samplePoint: record.sample_point,
  })));
  return {
    records: normalized,
    parameters,
    failed: parameters.filter(item => item.status === 'tidak_memenuhi'),
    unassessed: parameters.filter(item => item.status === 'belum_dinilai'),
    compliant: parameters.filter(item => item.status === 'memenuhi'),
    inlet: normalized.filter(item => item.sample_point === 'Inlet'),
    outlet: normalized.filter(item => item.sample_point === 'Outlet'),
  };
}

export const normalizeParameterName = value => String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
