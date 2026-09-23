import { useCallback, useEffect, useMemo, useState } from 'react';
import Swal from 'sweetalert2';
import AppLayout from '../components/AppLayout';
import { getCurrentUser } from '../lib/api';
import {
  deleteWaterExamination,
  getCleanWaterLocations,
  getWaterExaminations,
  getWaterStandards,
  saveWaterExamination,
} from '../features/pemeriksaan-air/waterService';
import {
  createEmptyParameter,
  parameterFromStandard,
  CLEAN_WATER_PARAMETERS,
  calculateParameterStatus,
  createCleanWaterParameters,
  toCleanWaterParameters,
  validateExamination,
  WATER_TYPES,
  WASTEWATER_POINTS,
} from '../features/pemeriksaan-air/waterHelpers';

const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Makassar' });
const currentMonth = () => today().slice(0, 7);
const emptyForm = (waterType = 'clean') => ({
  id: null,
  water_type: waterType,
  clean_water_location_id: '',
  sample_point: 'Inlet',
  sampled_at: today(),
  resulted_at: '',
  laboratory: '',
  report_number: '',
  notes: '',
  parameters: waterType === 'clean' ? createCleanWaterParameters() : [createEmptyParameter()],
});

const errorMessage = (error) => {
  if (!navigator.onLine || error?.message?.includes('Failed to fetch')) return 'Koneksi ke server terputus. Periksa internet lalu coba kembali.';
  if (error?.code === '42P01' || error?.code === 'PGRST205') return 'Pengaturan pemeriksaan air belum tersedia. Jalankan migrasi SQL baku mutu terlebih dahulu.';
  return error?.message || 'Terjadi kesalahan saat memproses data.';
};

export default function PemeriksaanAir() {
  const user = getCurrentUser();
  const [form, setForm] = useState(emptyForm());
  const [locations, setLocations] = useState([]);
  const [standards, setStandards] = useState([]);
  const [selectedStandardId, setSelectedStandardId] = useState('');
  const [records, setRecords] = useState([]);
  const [month, setMonth] = useState(currentMonth());
  const [typeFilter, setTypeFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const loadLocations = useCallback(async () => {
    setLocations(await getCleanWaterLocations());
  }, []);

  const loadStandards = useCallback(async () => {
    setStandards(await getWaterStandards());
  }, []);

  const loadRecords = useCallback(async () => {
    setLoading(true);
    try {
      setRecords(await getWaterExaminations({ month, waterType: typeFilter }));
    } catch (error) {
      Swal.fire('Data Tidak Dapat Dimuat', errorMessage(error), 'error');
    } finally {
      setLoading(false);
    }
  }, [month, typeFilter]);

  useEffect(() => {
    Promise.all([loadLocations(), loadStandards(), loadRecords()]).catch((error) => {
      Swal.fire('Data Tidak Dapat Dimuat', errorMessage(error), 'error');
    });
  }, [loadLocations, loadStandards, loadRecords]);

  const totals = useMemo(() => ({
    all: records.length,
    clean: records.filter((item) => item.water_type === 'clean').length,
    wastewater: records.filter((item) => item.water_type === 'wastewater').length,
    failed: records.filter((item) => item.parameters?.some((parameter) => parameter.status === 'tidak_memenuhi')).length,
  }), [records]);

  const standardsFor = type => standards.filter(item => item.water_type === type);
  const cleanParameters = () => CLEAN_WATER_PARAMETERS.map(name => {
    const standard = standardsFor('clean').find(item => item.parameter === name);
    return standard ? parameterFromStandard(standard) : createCleanWaterParameters().find(item => item.parameter === name);
  });
  const wastewaterParameters = () => standardsFor('wastewater').map(standard => parameterFromStandard(standard));

  const changeField = (field, value) => setForm(current => field === 'water_type'
    ? { ...current, water_type: value, clean_water_location_id: '', sample_point: 'Inlet',
        parameters: value === 'clean' ? cleanParameters() : wastewaterParameters() }
    : { ...current, [field]: value });

  const changeResult = (index, value) => setForm(current => ({
    ...current,
    parameters: current.parameters.map((item, itemIndex) => itemIndex === index
      ? { ...item, result: value, status: calculateParameterStatus(value, item.standard) }
      : item),
  }));

  const addWastewaterParameter = () => {
    const standard = standardsFor('wastewater').find(item => String(item.id) === String(selectedStandardId));
    if (!standard || form.parameters.some(item => item.standard_id === standard.id || item.parameter === standard.parameter)) return;
    changeField('parameters', [...form.parameters, parameterFromStandard(standard)]);
    setSelectedStandardId('');
  };

  const addAllWastewaterParameters = () => {
    const existingIds = new Set(form.parameters.map(item => item.standard_id).filter(Boolean));
    const existingNames = new Set(form.parameters.map(item => item.parameter));
    const missing = standardsFor('wastewater')
      .filter(item => !existingIds.has(item.id) && !existingNames.has(item.parameter))
      .map(item => parameterFromStandard(item));
    if (!missing.length) return;
    changeField('parameters', [...form.parameters, ...missing]);
    setSelectedStandardId('');
  };

  const openNew = (waterType) => {
    const available = standardsFor(waterType);
    if (waterType === 'clean' && CLEAN_WATER_PARAMETERS.some(name => !available.some(item => item.parameter === name))) {
      Swal.fire('Baku Mutu Belum Lengkap', 'Admin perlu mengatur Total coliform dan E. coli beserta rujukannya.', 'warning');
      return;
    }
    if (waterType === 'wastewater' && !available.length) {
      Swal.fire('Baku Mutu Belum Tersedia', 'Admin perlu menambah parameter dan rujukan air limbah terlebih dahulu.', 'warning');
      return;
    }
    setForm({ ...emptyForm(waterType), parameters: waterType === 'clean' ? cleanParameters() : wastewaterParameters() });
    setSelectedStandardId('');
    setShowForm(true);
  };

  const editRecord = async (record) => {
    if (record.water_type === 'clean' && record.parameters?.some(item => !['coliform', 'totalcoliform', 'ecoli'].includes(String(item.parameter || '').toLowerCase().replace(/[^a-z0-9]/g, '')))) {
      const { isConfirmed } = await Swal.fire({ icon: 'warning', title: 'Data air bersih lama',
        text: 'Data ini memuat parameter lain. Jika dilanjutkan, parameter lain tersebut tidak ikut tersimpan saat Anda mengedit. Hasil lama tetap terlihat bila dibatalkan.',
        showCancelButton: true, confirmButtonText: 'Lanjutkan Edit', cancelButtonText: 'Batal' });
      if (!isConfirmed) return;
    }
    setForm({
      ...emptyForm(record.water_type),
      ...record,
      clean_water_location_id: record.clean_water_location_id || '',
      resulted_at: record.resulted_at || '',
      laboratory: record.laboratory || '',
      report_number: record.report_number || '',
      notes: record.notes || '',
      parameters: record.water_type === 'clean'
        ? toCleanWaterParameters(record.parameters).map(item => {
          if (item.standard_id && item.regulation) return item;
          const standard = standardsFor('clean').find(entry => entry.parameter === item.parameter);
          return standard ? parameterFromStandard(standard, item.result) : item;
        })
        : (record.parameters || []).map(item => {
          if (item.standard_id && item.regulation) return item;
          const standard = standardsFor('wastewater').find(entry => entry.parameter === item.parameter);
          return standard ? parameterFromStandard(standard, item.result) : item;
        }),
    });
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const submit = async (event) => {
    event.preventDefault();
    const invalid = validateExamination(form);
    if (invalid) return Swal.fire('Data Belum Lengkap', invalid, 'warning');
    setSaving(true);
    try {
      await saveWaterExamination(form, user?.id);
      await loadRecords();
      setShowForm(false);
      setForm(emptyForm(form.water_type));
      Swal.fire({ icon: 'success', title: 'Data Tersimpan', timer: 1400, showConfirmButton: false });
    } catch (error) {
      Swal.fire('Gagal Menyimpan', errorMessage(error), 'error');
    } finally {
      setSaving(false);
    }
  };

  const removeRecord = async (record) => {
    const location = record.water_type === 'clean' ? record.water_clean_locations?.name : record.sample_point;
    const confirmation = await Swal.fire({
      icon: 'warning', title: 'Hapus hasil pemeriksaan?',
      text: `${location} • ${record.sampled_at}`, showCancelButton: true,
      confirmButtonText: 'Hapus', cancelButtonText: 'Batal', confirmButtonColor: '#dc2626',
    });
    if (!confirmation.isConfirmed) return;
    try {
      await deleteWaterExamination(record.id);
      await loadRecords();
    } catch (error) {
      Swal.fire('Gagal Menghapus', errorMessage(error), 'error');
    }
  };

  return (
    <AppLayout title="Pemeriksaan Air">
      <div className="mx-auto max-w-7xl space-y-5 p-4 sm:p-6">
        <section className="overflow-hidden rounded-3xl bg-linear-to-br from-cyan-600 via-blue-600 to-indigo-700 p-5 text-white shadow-xl">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-100">Pemantauan Kualitas Lingkungan</p>
              <h2 className="mt-1 text-2xl font-black">Air Bersih & Air Limbah</h2>
              <p className="mt-1 text-sm text-blue-100">Simpan hasil laboratorium per lokasi, inlet, dan outlet.</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => openNew('clean')} className="rounded-xl bg-white px-3 py-2 text-xs font-bold text-blue-700 shadow">+ Air Bersih</button>
              <button onClick={() => openNew('wastewater')} className="rounded-xl border border-white/40 bg-white/15 px-3 py-2 text-xs font-bold text-white backdrop-blur">+ Air Limbah</button>
            </div>
          </div>
        </section>

        {showForm && (
          <form onSubmit={submit} className="space-y-5 rounded-3xl border border-blue-100 bg-white p-4 shadow-lg sm:p-6">
            <div className="flex items-center justify-between">
              <h3 className="font-black text-slate-800">{form.id ? 'Edit' : 'Tambah'} {WATER_TYPES[form.water_type]}</h3>
              <button type="button" onClick={() => setShowForm(false)} className="h-9 w-9 rounded-xl bg-slate-100 text-slate-500"><i className="fas fa-xmark" /></button>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <label className="text-xs font-bold text-slate-600">Jenis Pemeriksaan
                <select value={form.water_type} onChange={(event) => changeField('water_type', event.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-sm">
                  <option value="clean">Air Bersih</option><option value="wastewater">Air Limbah</option>
                </select>
              </label>
              {form.water_type === 'clean' ? (
                <label className="text-xs font-bold text-slate-600">Ruangan / Lokasi Bak
                  <select value={form.clean_water_location_id} onChange={(event) => changeField('clean_water_location_id', event.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-sm">
                    <option value="">Pilih lokasi</option>
                    {form.id && form.clean_water_location_id && !locations.some(item => item.id === form.clean_water_location_id) && (
                      <option value={form.clean_water_location_id}>{form.water_clean_locations?.name || 'Lokasi nonaktif'} (nonaktif, untuk riwayat)</option>
                    )}
                    {locations.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                  </select>
                </label>
              ) : (
                <label className="text-xs font-bold text-slate-600">Titik Sampel
                  <select value={form.sample_point} onChange={(event) => changeField('sample_point', event.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-sm">
                    {WASTEWATER_POINTS.map((point) => <option key={point}>{point}</option>)}
                  </select>
                </label>
              )}
              <label className="text-xs font-bold text-slate-600">Tanggal Sampling
                <input type="date" value={form.sampled_at} onChange={(event) => changeField('sampled_at', event.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-sm" />
              </label>
              <label className="text-xs font-bold text-slate-600">Tanggal Hasil
                <input type="date" value={form.resulted_at} onChange={(event) => changeField('resulted_at', event.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-sm" />
              </label>
              <label className="text-xs font-bold text-slate-600">Laboratorium
                <input value={form.laboratory} onChange={(event) => changeField('laboratory', event.target.value)} placeholder="Contoh: Labkes Provinsi NTT" className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-sm" />
              </label>
              <label className="text-xs font-bold text-slate-600">Nomor Laporan
                <input value={form.report_number} onChange={(event) => changeField('report_number', event.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-sm" />
              </label>
            </div>

            <div>
              <h4 className="text-sm font-black text-slate-700">{form.water_type === 'clean' ? 'Mikrobiologi per Bak' : 'Parameter Laboratorium'}</h4>
              <p className="mt-1 text-xs text-slate-500">Baku mutu, satuan, dan rujukan peraturan diatur admin. Isi hasil sesuai laporan laboratorium; status dihitung otomatis.</p>
              {form.water_type === 'wastewater' && (
                <div className="mt-3 rounded-2xl border border-blue-100 bg-blue-50/60 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs font-bold text-blue-800">
                      {form.parameters.length} parameter ditambahkan untuk {form.sample_point}
                    </p>
                    <button type="button" onClick={addAllWastewaterParameters}
                      disabled={standardsFor('wastewater').every(item => form.parameters.some(row => row.standard_id === item.id || row.parameter === item.parameter))}
                      className="rounded-lg bg-white px-3 py-2 text-xs font-bold text-blue-700 shadow-sm disabled:opacity-50">
                      Tambahkan Semua
                    </button>
                  </div>
                  <div className="mt-2 flex gap-2">
                    <select value={selectedStandardId} onChange={event => setSelectedStandardId(event.target.value)}
                      className="min-w-0 flex-1 rounded-xl border border-blue-200 bg-white p-2.5 text-sm" aria-label="Pilih parameter air limbah">
                      <option value="">Pilih parameter tambahan</option>
                      {standardsFor('wastewater').filter(item => !form.parameters.some(row => row.standard_id === item.id || row.parameter === item.parameter))
                        .map(item => <option key={item.id} value={item.id}>{item.parameter} ({item.unit})</option>)}
                    </select>
                    <button type="button" onClick={addWastewaterParameter} disabled={!selectedStandardId}
                      className="rounded-xl bg-blue-600 px-3 text-xs font-bold text-white disabled:opacity-50">+ Tambah</button>
                  </div>
                </div>
              )}
              <div className="mt-3 space-y-3">
                {form.parameters.map((parameter, index) => (
                  <div key={parameter.standard_id || index} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-bold text-slate-800">{parameter.parameter}</p>
                        <p className="text-xs text-slate-500">Baku mutu: {parameter.standard || 'Belum tersedia'} {parameter.unit}</p>
                        <p className="text-xs text-slate-500">Rujukan: {parameter.regulation || 'Belum tersedia'}</p>
                      </div>
                      {form.water_type === 'wastewater' && <button type="button" onClick={() => changeField('parameters', form.parameters.filter((_, i) => i !== index))}
                        className="text-xs font-bold text-red-600">Hapus</button>}
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <input value={parameter.result} onChange={event => changeResult(index, event.target.value)}
                        placeholder="Hasil pemeriksaan" aria-label={`Hasil ${parameter.parameter}`}
                        className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white p-2.5 text-sm" />
                      <span className="text-xs font-bold text-slate-500">{parameter.unit}</span>
                      <span role="status" className={`rounded-lg px-3 py-2 text-xs font-bold ${parameter.status === 'memenuhi' ? 'bg-emerald-100 text-emerald-800' : parameter.status === 'tidak_memenuhi' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'}`}>
                        {parameter.status === 'memenuhi' ? 'Memenuhi' : parameter.status === 'tidak_memenuhi' ? 'Tidak memenuhi' : 'Belum dinilai'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <label className="block text-xs font-bold text-slate-600">Catatan
              <textarea value={form.notes} onChange={(event) => changeField('notes', event.target.value)} rows="2" className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-sm" />
            </label>
            <button disabled={saving} className="w-full rounded-xl bg-blue-600 py-3 text-sm font-black text-white disabled:opacity-60">{saving ? 'Menyimpan...' : 'Simpan Hasil Pemeriksaan'}</button>
          </form>
        )}

        <section className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[['Semua', totals.all, 'bg-blue-50 text-blue-700'], ['Air Bersih', totals.clean, 'bg-cyan-50 text-cyan-700'], ['Air Limbah', totals.wastewater, 'bg-indigo-50 text-indigo-700'], ['Perlu Tindak Lanjut', totals.failed, 'bg-red-50 text-red-700']].map(([label, value, color]) => <div key={label} className={`rounded-2xl p-4 ${color}`}><p className="text-2xl font-black">{value}</p><p className="text-xs font-bold">{label}</p></div>)}
          </div>
          <div className="flex flex-col gap-2 rounded-2xl bg-white p-3 shadow-sm sm:flex-row">
            <input type="month" value={month} onChange={(event) => setMonth(event.target.value)} className="rounded-xl border border-slate-200 px-3 py-2 text-sm" />
            <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)} className="rounded-xl border border-slate-200 px-3 py-2 text-sm"><option value="all">Semua jenis</option><option value="clean">Air Bersih</option><option value="wastewater">Air Limbah</option></select>
            <button onClick={loadRecords} className="rounded-xl bg-slate-800 px-4 py-2 text-sm font-bold text-white">Segarkan</button>
          </div>
          {loading ? <div className="py-12 text-center text-slate-400"><i className="fas fa-spinner fa-spin mr-2" />Memuat data...</div> : records.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-300 bg-white py-12 text-center text-sm text-slate-400">Belum ada hasil pemeriksaan pada periode ini.</div> : (
            <div className="grid gap-3 lg:grid-cols-2">
              {records.map((record) => {
                const failed = record.parameters?.some((item) => item.status === 'tidak_memenuhi');
                const unassessed = record.parameters?.some((item) => !['memenuhi', 'tidak_memenuhi'].includes(item.status));
                return <article key={record.id} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3"><div><span className={`rounded-full px-2 py-1 text-[10px] font-black ${record.water_type === 'clean' ? 'bg-cyan-100 text-cyan-700' : 'bg-indigo-100 text-indigo-700'}`}>{WATER_TYPES[record.water_type]}</span><h3 className="mt-2 font-black text-slate-800">{record.water_type === 'clean' ? record.water_clean_locations?.name : record.sample_point}</h3><p className="text-xs text-slate-400">Sampling {record.sampled_at}{record.laboratory ? ` • ${record.laboratory}` : ''}</p></div><span className={`rounded-lg px-2 py-1 text-[10px] font-bold ${failed ? 'bg-red-100 text-red-700' : unassessed ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>{failed ? 'Perlu tindak lanjut' : unassessed ? 'Belum dinilai' : 'Memenuhi'}</span></div>
                  <div className="mt-3 overflow-x-auto"><table className="w-full text-left text-xs"><thead className="text-slate-400"><tr><th className="py-1">Parameter</th><th>Hasil</th><th>Baku Mutu</th></tr></thead><tbody>{record.parameters?.map((item, index) => <tr key={`${item.parameter}-${index}`} className="border-t border-slate-100"><td className="py-1.5 font-bold text-slate-700">{item.parameter}</td><td className={item.status === 'tidak_memenuhi' ? 'font-bold text-red-600' : 'text-slate-600'}>{item.result} {item.unit}</td><td className="text-slate-500">{item.standard || '-'}</td></tr>)}</tbody></table></div>
                  <div className="mt-3 flex justify-end gap-2"><button onClick={() => editRecord(record)} className="rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-600">Edit</button><button onClick={() => removeRecord(record)} className="rounded-lg bg-red-50 px-3 py-1.5 text-xs font-bold text-red-600">Hapus</button></div>
                </article>;
              })}
            </div>
          )}
        </section>
      </div>
    </AppLayout>
  );
}
