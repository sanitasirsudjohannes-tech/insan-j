const locationName = record => record.water_type === 'clean' ? record.water_clean_locations?.name : record.sample_point;

const statusLabel = status => status === 'tidak_memenuhi'
  ? 'Tidak memenuhi'
  : status === 'memenuhi' ? 'Memenuhi' : 'Belum dinilai';

const formatResult = parameter => `${parameter?.result ?? '-'}${parameter?.unit ? ` ${parameter.unit}` : ''}`;

const formatDateId = value => {
  if (!value) return '-';
  const [year, month, day] = value.split('-').map(Number);
  return new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Makassar' })
    .format(new Date(Date.UTC(year, month - 1, day)));
};

const cleanParameter = (record, name) => (record.parameters || []).find(parameter => (
  String(parameter.parameter || '').toLowerCase().replace(/[^a-z0-9]/g, '')
  === name.toLowerCase().replace(/[^a-z0-9]/g, '')
));

function buildCleanWaterTables(records) {
  const summaryRows = records.map(record => {
    const coliform = cleanParameter(record, 'Total coliform');
    const ecoli = cleanParameter(record, 'E. coli');
    return [
      formatDateId(record.sampled_at),
      locationName(record) || '-',
      formatResult(coliform),
      statusLabel(coliform?.status),
      formatResult(ecoli),
      statusLabel(ecoli?.status),
    ];
  });

  const parameters = records.flatMap(record => record.parameters || []);
  const standards = [...new Set(parameters.map(parameter => `${parameter.parameter}: ${parameter.standard || '-'} ${parameter.unit || ''}`))];
  const regulations = [...new Set(parameters.map(parameter => parameter.regulation).filter(Boolean))];

  return [{
    placement: 'results',
    title: 'Ringkasan Hasil Pemeriksaan Air Bersih',
    headers: ['Tanggal', 'Lokasi/Bak', 'Total coliform', 'Status', 'E. coli', 'Status'],
    rows: summaryRows,
    notes: [
      `Baku mutu: ${standards.join('; ') || '-'}`,
      `Rujukan: ${regulations.join('; ') || '-'}`,
    ],
  }];
}

export function buildWaterTableModels(reportType, analytics = {}) {
  const records = analytics.records || [];
  if (!records.length) return [];
  if (reportType === 'clean_water') return buildCleanWaterTables(records);

  const rows = records.flatMap(record => (record.parameters || []).map(parameter => [
    record.sampled_at || '-',
    locationName(record) || '-',
    parameter.parameter || '-',
    `${parameter.result ?? '-'}${parameter.unit ? ` ${parameter.unit}` : ''}`,
    parameter.standard || '-',
    parameter.regulation || '-',
    statusLabel(parameter.status),
  ]));
  return [{
    placement: 'appendix',
    title: reportType === 'wastewater' ? 'Hasil Pemeriksaan Air Limbah' : 'Hasil Pemeriksaan Air Bersih',
    headers: ['Tanggal', 'Lokasi', 'Parameter', 'Hasil', 'Baku Mutu', 'Rujukan', 'Status'],
    rows,
  }];
}
