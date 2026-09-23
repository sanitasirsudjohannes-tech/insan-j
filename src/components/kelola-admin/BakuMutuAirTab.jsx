import { useCallback, useEffect, useState } from 'react';
import Swal from 'sweetalert2';
import {
  getWaterRegulations, getWaterStandards,
  saveWaterRegulation, saveWaterStandard,
  setWaterRegulationActive, setWaterStandardActive,
} from '../../features/pemeriksaan-air/waterService';
import { calculateParameterStatus, CLEAN_WATER_PARAMETERS, CLEAN_WATER_UNIT } from '../../features/pemeriksaan-air/waterHelpers';

const blankRegulation = { id: null, title: '', number: '', year: '' };
const blankStandard = { id: null, water_type: 'clean', parameter: 'Total coliform', unit: CLEAN_WATER_UNIT, standard: '', regulation_id: '' };
const citation = item => [item.title, item.number, item.year].filter(Boolean).join(' · ');

export default function BakuMutuAirTab() {
  const [regulations, setRegulations] = useState([]);
  const [standards, setStandards] = useState([]);
  const [regulation, setRegulation] = useState(blankRegulation);
  const [standard, setStandard] = useState(blankStandard);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [rules, limits] = await Promise.all([
        getWaterRegulations({ includeInactive: true }),
        getWaterStandards({ includeInactive: true }),
      ]);
      setRegulations(rules);
      setStandards(limits);
    } catch (err) {
      setError(err?.message || 'Pengaturan baku mutu tidak dapat dimuat.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const run = async (action, message) => {
    if (saving) return;
    setSaving(true);
    try {
      await action();
      await refresh();
      Swal.fire({ icon: 'success', title: message, timer: 1300, showConfirmButton: false });
    } catch (err) {
      Swal.fire('Gagal Menyimpan', err?.code === '23505'
        ? 'Parameter tersebut sudah terdaftar. Edit baris yang ada atau aktifkan kembali.'
        : err?.message || 'Periksa koneksi dan izin admin.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const submitRegulation = async event => {
    event.preventDefault();
    if (!regulation.title.trim()) return;
    await run(async () => {
      await saveWaterRegulation(regulation);
      setRegulation(blankRegulation);
    }, 'Rujukan peraturan tersimpan');
  };

  const submitStandard = async event => {
    event.preventDefault();
    const parameter = standard.parameter.trim();
    if (!parameter || !standard.regulation_id) {
      Swal.fire('Data Belum Lengkap', 'Isi parameter dan pilih rujukan peraturan.', 'warning');
      return;
    }
    if (calculateParameterStatus('0', standard.standard) === 'belum_dinilai') {
      Swal.fire('Format Baku Mutu', 'Gunakan angka batas maksimum, ≤50, ≥6, atau rentang 6-9. Satuan diisi terpisah.', 'warning');
      return;
    }
    await run(async () => {
      await saveWaterStandard({
        ...standard, parameter,
        unit: standard.water_type === 'clean' ? CLEAN_WATER_UNIT : standard.unit,
      });
      setStandard(blankStandard);
    }, 'Baku mutu tersimpan');
  };

  const toggle = async (item, kind) => {
    const next = !item.is_active;
    const { isConfirmed } = await Swal.fire({
      icon: 'question', title: next ? 'Aktifkan kembali?' : 'Nonaktifkan?',
      text: next ? 'Pengaturan ini tersedia lagi untuk pemeriksaan baru.'
        : 'Pengaturan tidak dipakai untuk pemeriksaan baru. Rujukan pada data lama tetap tersimpan.',
      showCancelButton: true, confirmButtonText: next ? 'Aktifkan' : 'Nonaktifkan', cancelButtonText: 'Batal',
    });
    if (!isConfirmed) return;
    await run(
      () => kind === 'regulation' ? setWaterRegulationActive(item.id, next) : setWaterStandardActive(item.id, next),
      next ? 'Pengaturan diaktifkan' : 'Pengaturan dinonaktifkan',
    );
  };

  return <div className="space-y-5">
    <section className="rounded-2xl border border-indigo-100 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-black text-slate-800">Rujukan Peraturan</h2>
      <p className="mb-4 text-xs text-slate-500">Tambahkan peraturan yang menjadi dasar baku mutu. Teks rujukan tersimpan bersama hasil pemeriksaan.</p>
      <form onSubmit={submitRegulation} className="grid gap-2 sm:grid-cols-[2fr_1fr_0.7fr_auto]">
        <input value={regulation.title} onChange={event => setRegulation({ ...regulation, title: event.target.value })} placeholder="Nama peraturan" aria-label="Nama peraturan" required className="rounded-xl border border-slate-300 p-2.5 text-sm" />
        <input value={regulation.number || ''} onChange={event => setRegulation({ ...regulation, number: event.target.value })} placeholder="Nomor peraturan" aria-label="Nomor peraturan" className="rounded-xl border border-slate-300 p-2.5 text-sm" />
        <input type="number" min="1900" max="2200" value={regulation.year || ''} onChange={event => setRegulation({ ...regulation, year: event.target.value })} placeholder="Tahun" aria-label="Tahun" className="rounded-xl border border-slate-300 p-2.5 text-sm" />
        <button disabled={saving} className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{regulation.id ? 'Simpan' : 'Tambah'}</button>
      </form>
      {regulation.id && <button type="button" onClick={() => setRegulation(blankRegulation)} className="mt-2 text-xs text-slate-500">Batal edit</button>}
      <div className="mt-4 space-y-2">
        {regulations.map(item => <div key={item.id} className="flex flex-wrap items-center gap-2 rounded-xl bg-slate-50 p-3 text-sm">
          <span className="min-w-0 flex-1 font-medium text-slate-800">{citation(item)} {!item.is_active && <span className="text-amber-700">(nonaktif)</span>}</span>
          <button type="button" onClick={() => setRegulation({ id: item.id, title: item.title, number: item.number || '', year: item.year || '' })} className="text-xs font-bold text-blue-700">Edit</button>
          <button type="button" disabled={saving} onClick={() => toggle(item, 'regulation')} className="text-xs font-bold text-amber-700 disabled:opacity-50">{item.is_active ? 'Nonaktifkan' : 'Aktifkan'}</button>
        </div>)}
      </div>
    </section>

    <section className="rounded-2xl border border-cyan-100 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-black text-slate-800">Baku Mutu Pemeriksaan Air</h2>
      <p className="mb-4 text-xs text-slate-500">Air bersih memakai Total coliform dan E. coli. Parameter air limbah ditentukan di sini. Angka tanpa operator adalah batas maksimum.</p>
      <form onSubmit={submitStandard} className="grid gap-2 sm:grid-cols-2">
        <select value={standard.water_type} onChange={event => setStandard({
          ...standard, water_type: event.target.value,
          parameter: event.target.value === 'clean' ? 'Total coliform' : '',
          unit: event.target.value === 'clean' ? CLEAN_WATER_UNIT : '',
        })} disabled={Boolean(standard.id)} className="rounded-xl border border-slate-300 p-2.5 text-sm">
          <option value="clean">Air Bersih</option><option value="wastewater">Air Limbah</option>
        </select>
        {standard.water_type === 'clean'
          ? <select value={standard.parameter} onChange={event => setStandard({ ...standard, parameter: event.target.value })} disabled={Boolean(standard.id)} className="rounded-xl border border-slate-300 p-2.5 text-sm">
            {CLEAN_WATER_PARAMETERS.map(name => <option key={name}>{name}</option>)}
          </select>
          : <input value={standard.parameter} onChange={event => setStandard({ ...standard, parameter: event.target.value })} placeholder="Nama parameter (mis. pH atau BOD)" aria-label="Nama parameter air limbah" disabled={Boolean(standard.id)} required className="rounded-xl border border-slate-300 p-2.5 text-sm" />}
        <input value={standard.unit} onChange={event => setStandard({ ...standard, unit: event.target.value })} placeholder="Satuan (mis. mg/L)" aria-label="Satuan" readOnly={standard.water_type === 'clean'} className="rounded-xl border border-slate-300 p-2.5 text-sm read-only:bg-slate-100" />
        <input value={standard.standard} onChange={event => setStandard({ ...standard, standard: event.target.value })} placeholder="Baku mutu: 50, ≤50, ≥6, 6-9" aria-label="Baku mutu" required className="rounded-xl border border-slate-300 p-2.5 text-sm" />
        <select value={standard.regulation_id || ''} onChange={event => setStandard({ ...standard, regulation_id: event.target.value })} aria-label="Rujukan peraturan" required className="rounded-xl border border-slate-300 p-2.5 text-sm">
          <option value="">Pilih rujukan peraturan</option>
          {regulations.filter(item => item.is_active || item.id === standard.regulation_id).map(item => <option key={item.id} value={item.id}>{citation(item)}</option>)}
        </select>
        <div className="flex gap-2">
          <button disabled={saving || !regulations.some(item => item.is_active)} className="flex-1 rounded-xl bg-cyan-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{standard.id ? 'Simpan Perubahan' : 'Tambah Baku Mutu'}</button>
          {standard.id && <button type="button" onClick={() => setStandard(blankStandard)} className="rounded-xl bg-slate-100 px-4 py-2 text-sm text-slate-700">Batal</button>}
        </div>
      </form>
      {loading ? <p className="mt-4 text-sm text-slate-500">Memuat pengaturan...</p> : <div className="mt-4 space-y-2">
        {standards.map(item => <div key={item.id} className="rounded-xl bg-slate-50 p-3 text-sm">
          <div className="font-bold text-slate-800">{item.water_type === 'clean' ? 'Air Bersih' : 'Air Limbah'} · {item.parameter} · {item.standard} {item.unit} {!item.is_active && <span className="text-amber-700">(nonaktif)</span>}</div>
          <div className="text-xs text-slate-500">{item.water_regulations ? citation(item.water_regulations) : 'Tanpa rujukan'}</div>
          <div className="mt-2 flex gap-3 text-xs font-bold">
            <button type="button" onClick={() => setStandard({ id: item.id, water_type: item.water_type, parameter: item.parameter, unit: item.unit, standard: item.standard, regulation_id: item.regulation_id || '' })} className="text-blue-700">Edit</button>
            <button type="button" disabled={saving} onClick={() => toggle(item, 'standard')} className="text-amber-700 disabled:opacity-50">{item.is_active ? 'Nonaktifkan' : 'Aktifkan'}</button>
          </div>
        </div>)}
      </div>}
      {error && <p role="alert" className="mt-4 text-sm text-red-700">{error} <button type="button" onClick={refresh} className="underline">Coba lagi</button></p>}
    </section>
  </div>;
}
