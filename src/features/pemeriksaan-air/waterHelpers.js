export const WATER_TYPES = {
  clean: 'Air Bersih',
  wastewater: 'Air Limbah',
};

export const WASTEWATER_POINTS = ['Inlet', 'Outlet'];
export const CLEAN_WATER_PARAMETERS = ['Total coliform', 'E. coli'];
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

const readNumber = value => {
  const text = String(value ?? '').trim().replace(',', '.');
  return /^(?:\d+(?:\.\d+)?|\.\d+)$/.test(text) ? Number(text) : null;
};

// Baku mutu tanpa operator adalah batas maksimum. Teks yang tak dapat dihitung belum dinilai.
export function calculateParameterStatus(result, standard) {
  const value = readNumber(result);
  if (value === null) return 'belum_dinilai';
  const limit = String(standard ?? '').trim()
    .replace(/\s*\/\s*100\s*m[lL]\s*$/i, '')
    .replaceAll(',', '.');
  const number = '(?:\\d+(?:\\.\\d+)?|\\.\\d+)';
  const range = limit.match(new RegExp(`^(${number})\\s*[-–]\\s*(${number})$`));
  if (range) {
    const minimum = Number(range[1]);
    const maximum = Number(range[2]);
    if (minimum > maximum) return 'belum_dinilai';
    return value >= minimum && value <= maximum ? 'memenuhi' : 'tidak_memenuhi';
  }
  const comparison = limit.match(new RegExp(`^(<=|>=|<|>|≤|≥)?\\s*(${number})$`));
  if (!comparison) return 'belum_dinilai';
  const [, operator = '', raw] = comparison;
  const boundary = Number(raw);
  const meets = operator === '>=' || operator === '≥' ? value >= boundary
    : operator === '>' ? value > boundary
      : operator === '<' ? value < boundary
        : value <= boundary;
  return meets ? 'memenuhi' : 'tidak_memenuhi';
}

export function toCleanWaterParameters(parameters = []) {
  return createCleanWaterParameters().map(defaultParameter => {
    const existing = parameters.find(item => {
      const key = cleanParameterKey(item.parameter);
      return key === cleanParameterKey(defaultParameter.parameter)
        || (defaultParameter.parameter === 'Total coliform' && key === 'coliform');
    });
    return existing
      ? { ...defaultParameter, ...existing, parameter: defaultParameter.parameter, unit: CLEAN_WATER_UNIT,
          status: calculateParameterStatus(existing.result, existing.standard) }
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
      status: calculateParameterStatus(item.result, item.standard),
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
      return 'Hasil Total coliform dan E. coli wajib diisi untuk setiap bak dengan satuan /100 mL.';
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
