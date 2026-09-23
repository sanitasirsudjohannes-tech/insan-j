import { useCallback, useEffect, useMemo, useState } from 'react';
import Swal from 'sweetalert2';
import AppLayout from '../components/AppLayout';
import { getCurrentUser } from '../lib/api';
import {
  addCleanWaterLocation,
  deleteCleanWaterLocation,
  deleteWaterExamination,
  getCleanWaterLocations,
  getWaterExaminations,
  saveWaterExamination,
} from '../features/pemeriksaan-air/waterService';
import {
  createEmptyParameter,
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
  parameters: [createEmptyParameter()],
});

const errorMessage = (error) => {
  if (!navigator.onLine || error?.message?.includes('Failed to fetch')) return 'Koneksi ke server terputus. Periksa internet lalu coba kembali.';
  if (error?.code === '42P01') return 'Tabel pemeriksaan air belum tersedia. Jalankan SQL migrasi terlebih dahulu.';
  return error?.message || 'Terjadi kesalahan saat memproses data.';
};

export default function PemeriksaanAir() {
  const user = getCurrentUser();
  const isAdmin = user?.role?.trim().toLowerCase() === 'admin';
  const [form, setForm] = useState(emptyForm());
  const [locations, setLocations] = useState([]);
  const [records, setRecords] = useState([]);
  const [month, setMonth] = useState(currentMonth());
  const [typeFilter, setTypeFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [newLocation, setNewLocation] = useState('');

  const loadLocations = useCallback(async () => {
    setLocations(await getCleanWaterLocations());
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
    Promise.all([loadLocations(), loadRecords()]).catch((error) => {
      Swal.fire('Data Tidak Dapat Dimuat', errorMessage(error), 'error');
    });
  }, [loadLocations, loadRecords]);

  const totals = useMemo(() => ({
    all: records.length,
    clean: records.filter((item) => item.water_type === 'clean').length,
    wastewater: records.filter((item) => item.water_type === 'wastewater').length,
    failed: records.filter((item) => item.parameters?.some((parameter) => parameter.status === 'tidak_memenuhi')).length,
  }), [records]);

  const changeField = (field, value) => setForm((current) => ({ ...current, [field]: value }));
  const changeParameter = (index, field, value) => setForm((current) => ({
    ...current,
    parameters: current.parameters.map((item, itemIndex) => itemIndex === index ? { ...item, [field]: value } : item),
  }));

  const openNew = (waterType) => {
    setForm(emptyForm(waterType));
    setShowForm(true);
  };

  const editRecord = (record) => {
    setForm({
      ...emptyForm(record.water_type),
      ...record,
      clean_water_location_id: record.clean_water_location_id || '',
      resulted_at: record.resulted_at || '',
      laboratory: record.laboratory || '',
      report_number: record.report_number || '',
      notes: record.notes || '',
      parameters: record.parameters?.length ? record.parameters : [createEmptyParameter()],
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

  const submitLocation = async (event) => {
    event.preventDefault();
    if (!newLocation.trim()) return;
    try {
      await addCleanWaterLocation(newLocation);
      setNewLocation('');
      await loadLocations();
    } catch (error) {
      Swal.fire('Lokasi Gagal Ditambahkan', errorMessage(error), 'error');
    }
  };

  const removeLocation = async (location) => {
    const confirmation = await Swal.fire({
      icon: 'warning', title: `Nonaktifkan ${location.name}?`,
      text: 'Data pemeriksaan lama tetap tersimpan.', showCancelButton: true,
      confirmButtonText: 'Nonaktifkan', cancelButtonText: 'Batal', confirmButtonColor: '#dc2626',
    });
    if (!confirmation.isConfirmed) return;
    try {
      await deleteCleanWaterLocation(location.id);
      await loadLocations();
    } catch (error) {
      Swal.fire('Gagal Menonaktifkan', errorMessage(error), 'error');
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

        {isAdmin && (
          <details className="rounded-2xl border border-cyan-100 bg-white p-4 shadow-sm">
            <summary className="cursor-pointer text-sm font-black text-slate-800">Kelola Lokasi Air Bersih <span className="ml-2 text-xs font-medium text-slate-400">khusus admin</span></summary>
            <form onSubmit={submitLocation} className="mt-4 flex gap-2">
              <input value={newLocation} onChange={(event) => setNewLocation(event.target.value)} placeholder="Nama ruangan / lokasi bak" className="min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-cyan-500" />
              <button className="rounded-xl bg-cyan-600 px-4 py-2 text-sm font-bold text-white">Tambah</button>
            </form>
            <div className="mt-3 flex flex-wrap gap-2">
              {locations.map((location) => (
                <span key={location.id} className="inline-flex items-center gap-2 rounded-full bg-cyan-50 px-3 py-1.5 text-xs font-bold text-cyan-800">
                  {location.name}
                  <button type="button" onClick={() => removeLocation(location)} aria-label={`Nonaktifkan ${location.name}`} className="text-red-500"><i className="fas fa-xmark" /></button>
                </span>
              ))}
              {!locations.length && <p className="text-xs text-slate-400">Belum ada lokasi. Tambahkan lokasi sebelum mengisi hasil air bersih.</p>}
            </div>
          </details>
        )}

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
                    <option value="">Pilih lokasi</option>{locations.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
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
              <div className="mb-2 flex items-center justify-between"><h4 className="text-sm font-black text-slate-700">Parameter Laboratorium</h4><button type="button" onClick={() => changeField('parameters', [...form.parameters, createEmptyParameter()])} className="text-xs font-bold text-blue-600">+ Tambah Parameter</button></div>
              <div className="space-y-3">
                {form.parameters.map((parameter, index) => (
                  <div key={index} className="grid gap-2 rounded-2xl bg-slate-50 p-3 sm:grid-cols-2 lg:grid-cols-[1.3fr_1fr_0.8fr_1fr_1fr_auto]">
                    <input value={parameter.parameter} onChange={(event) => changeParameter(index, 'parameter', event.target.value)} placeholder="Parameter (pH, BOD...)" className="rounded-lg border border-slate-200 p-2 text-xs" />
                    <input value={parameter.result} onChange={(event) => changeParameter(index, 'result', event.target.value)} placeholder="Hasil" className="rounded-lg border border-slate-200 p-2 text-xs" />
                    <input value={parameter.unit} onChange={(event) => changeParameter(index, 'unit', event.target.value)} placeholder="Satuan" className="rounded-lg border border-slate-200 p-2 text-xs" />
                    <input value={parameter.standard} onChange={(event) => changeParameter(index, 'standard', event.target.value)} placeholder="Baku mutu" className="rounded-lg border border-slate-200 p-2 text-xs" />
                    <select value={parameter.status} onChange={(event) => changeParameter(index, 'status', event.target.value)} className="rounded-lg border border-slate-200 p-2 text-xs"><option value="memenuhi">Memenuhi</option><option value="tidak_memenuhi">Tidak memenuhi</option></select>
                    <button type="button" disabled={form.parameters.length === 1} onClick={() => changeField('parameters', form.parameters.filter((_, itemIndex) => itemIndex !== index))} className="rounded-lg px-2 text-red-500 disabled:opacity-30"><i className="fas fa-trash" /></button>
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
                return <article key={record.id} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3"><div><span className={`rounded-full px-2 py-1 text-[10px] font-black ${record.water_type === 'clean' ? 'bg-cyan-100 text-cyan-700' : 'bg-indigo-100 text-indigo-700'}`}>{WATER_TYPES[record.water_type]}</span><h3 className="mt-2 font-black text-slate-800">{record.water_type === 'clean' ? record.water_clean_locations?.name : record.sample_point}</h3><p className="text-xs text-slate-400">Sampling {record.sampled_at}{record.laboratory ? ` • ${record.laboratory}` : ''}</p></div><span className={`rounded-lg px-2 py-1 text-[10px] font-bold ${failed ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>{failed ? 'Perlu tindak lanjut' : 'Memenuhi'}</span></div>
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
