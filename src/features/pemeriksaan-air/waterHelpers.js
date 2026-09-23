export const WATER_TYPES = {
  clean: 'Air Bersih',
  wastewater: 'Air Limbah',
};

export const WASTEWATER_POINTS = ['Inlet', 'Outlet'];

export const createEmptyParameter = () => ({
  parameter: '',
  result: '',
  unit: '',
  standard: '',
  status: 'memenuhi',
});

export function normalizeParameters(parameters = []) {
  return parameters
    .map((item) => ({
      parameter: String(item.parameter || '').trim(),
      result: String(item.result ?? '').trim(),
      unit: String(item.unit || '').trim(),
      standard: String(item.standard || '').trim(),
      status: item.status === 'tidak_memenuhi' ? 'tidak_memenuhi' : 'memenuhi',
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
