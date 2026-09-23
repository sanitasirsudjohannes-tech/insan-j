export const WATER_TYPES = {
  clean: 'Air Bersih',
  wastewater: 'Air Limbah',
};

export const WASTEWATER_POINTS = ['Inlet', 'Outlet'];
export const CLEAN_WATER_PARAMETERS = ['Coliform', 'E. coli'];
export const CLEAN_WATER_UNIT = '/100 mL';

export const createEmptyParameter = () => ({
  parameter: '',
  result: '',
  unit: '',
  standard: '',
  status: 'belum_dinilai',
});

export const createCleanWaterParameters = () => CLEAN_WATER_PARAMETERS.map(parameter => ({
  parameter, result: '', unit: CLEAN_WATER_UNIT, standard: '', status: 'belum_dinilai',
}));

const cleanParameterKey = value => String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');

export function toCleanWaterParameters(parameters = []) {
  return createCleanWaterParameters().map(defaultParameter => {
    const existing = parameters.find(item => cleanParameterKey(item.parameter) === cleanParameterKey(defaultParameter.parameter));
    return existing
      ? { ...defaultParameter, ...existing, parameter: defaultParameter.parameter, unit: CLEAN_WATER_UNIT }
      : defaultParameter;
  });
}

export function normalizeParameters(parameters = []) {
  return parameters
    .map((item) => ({
      parameter: String(item.parameter || '').trim(),
      result: String(item.result ?? '').trim(),
      unit: String(item.unit || '').trim(),
      standard: String(item.standard || '').trim(),
      status: ['memenuhi', 'tidak_memenuhi'].includes(item.status) ? item.status : 'belum_dinilai',
    }))
    .filter((item) => item.parameter && item.result);
}

export function validateExamination(form) {
  if (!form.sampled_at) return 'Tanggal pengambilan sampel wajib diisi.';
  if (form.water_type === 'clean' && !form.clean_water_location_id) {
    return 'Pilih lokasi pemeriksaan air bersih.';
  }
  if (form.water_type === 'wastewater' && !WASTEWATER_POINTS.includes(form.sample_point)) {
    return 'Pilih titik sampel Inlet atau Outlet.';
  }
  if (form.water_type === 'clean') {
    const normalized = normalizeParameters(form.parameters);
    if (normalized.length !== CLEAN_WATER_PARAMETERS.length
      || CLEAN_WATER_PARAMETERS.some(name => normalized.filter(item => item.parameter === name && item.unit === CLEAN_WATER_UNIT).length !== 1)) {
      return 'Hasil Coliform dan E. coli wajib diisi untuk setiap bak dengan satuan /100 mL.';
    }
  }
  if (normalizeParameters(form.parameters).length === 0) {
    return 'Isi minimal satu parameter beserta hasil pemeriksaannya.';
  }
  return null;
}

export function monthRange(month) {
  const [year, monthNumber] = month.split('-').map(Number);
  const start = `${year}-${String(monthNumber).padStart(2, '0')}-01`;
  const next = new Date(Date.UTC(year, monthNumber, 1));
  const end = next.toISOString().slice(0, 10);
  return { start, end };
}
