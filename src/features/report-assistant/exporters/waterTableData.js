const locationName = record => record.water_type === 'clean' ? record.water_clean_locations?.name : record.sample_point;

export function buildWaterTableModels(reportType, analytics = {}) {
  const rows = (analytics.records || []).flatMap(record => (record.parameters || []).map(parameter => [
    record.sampled_at || '-',
    locationName(record) || '-',
    parameter.parameter || '-',
    `${parameter.result ?? '-'}${parameter.unit ? ` ${parameter.unit}` : ''}`,
    parameter.standard || '-',
    parameter.status === 'tidak_memenuhi' ? 'Tidak memenuhi' : parameter.status === 'memenuhi' ? 'Memenuhi (input petugas)' : 'Belum dinilai',
  ]));
  if (!rows.length) return [];
  return [{
    title: reportType === 'wastewater' ? 'Hasil Pemeriksaan Air Limbah' : 'Hasil Pemeriksaan Air Bersih',
    headers: ['Tanggal', 'Lokasi', 'Parameter', 'Hasil', 'Baku Mutu', 'Status'],
    rows,
  }];
}
