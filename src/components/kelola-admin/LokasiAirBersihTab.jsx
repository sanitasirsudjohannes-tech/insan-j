import { useCallback, useEffect, useMemo, useState } from 'react';
import Swal from 'sweetalert2';
import {
  addCleanWaterLocation,
  deleteCleanWaterLocation,
  getCleanWaterLocations,
  updateCleanWaterLocation,
} from '../../features/pemeriksaan-air/waterService';

const errorText = error => error?.code === '23505'
  ? 'Nama lokasi ini sudah digunakan. Cari di daftar aktif maupun nonaktif.'
  : error?.message || 'Periksa koneksi lalu coba lagi.';

export default function LokasiAirBersihTab() {
  const [locations, setLocations] = useState([]);
  const [newLocation, setNewLocation] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setLocations(await getCleanWaterLocations({ includeInactive: true }));
    } catch (err) {
      setError(errorText(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const run = async (operation, success) => {
    if (busy) return;
    setBusy(true);
    try {
      await operation();
      await refresh();
      if (success) Swal.fire({ icon: 'success', title: success, timer: 1400, showConfirmButton: false });
    } catch (err) {
      Swal.fire('Perubahan Gagal', errorText(err), 'error');
    } finally {
      setBusy(false);
    }
  };

  const addLocation = async event => {
    event.preventDefault();
    const name = newLocation.trim();
    if (!name || busy) return;
    await run(async () => {
      await addCleanWaterLocation(name);
      setNewLocation('');
    }, 'Lokasi berhasil ditambahkan');
  };

  const saveEdit = async event => {
    event.preventDefault();
    const name = editName.trim();
    if (!name || busy) return;
    const location = locations.find(item => item.id === editingId);
    if (location?.name !== name) {
      const { isConfirmed } = await Swal.fire({
        icon: 'question',
        title: 'Ubah nama lokasi?',
        text: 'Nama pada hasil pemeriksaan lama yang merujuk lokasi ini juga akan mengikuti nama baru.',
        showCancelButton: true, confirmButtonText: 'Simpan Nama', cancelButtonText: 'Batal',
      });
      if (!isConfirmed) return;
    }
    await run(async () => {
      await updateCleanWaterLocation(editingId, { name });
      setEditingId(null);
    }, 'Nama lokasi diperbarui');
  };

  const toggleLocation = async location => {
    const nextActive = !location.is_active;
    const { isConfirmed } = await Swal.fire({
      icon: nextActive ? 'question' : 'warning',
      title: nextActive ? 'Aktifkan kembali lokasi?' : 'Nonaktifkan lokasi?',
      text: nextActive
        ? `"${location.name}" akan tersedia lagi untuk pemeriksaan baru.`
        : `"${location.name}" tidak muncul untuk pemeriksaan baru. Data lama tetap tersimpan.`,
      showCancelButton: true,
      confirmButtonText: nextActive ? 'Aktifkan' : 'Nonaktifkan',
      cancelButtonText: 'Batal',
    });
    if (!isConfirmed) return;
    await run(() => updateCleanWaterLocation(location.id, { is_active: nextActive }), nextActive ? 'Lokasi diaktifkan' : 'Lokasi dinonaktifkan');
  };

  const removeLocation = async location => {
    const { isConfirmed } = await Swal.fire({
      icon: 'warning',
      title: 'Hapus lokasi permanen?',
      text: `Hanya "${location.name}" yang belum pernah dipakai pada pemeriksaan yang dapat dihapus. Tindakan ini tidak dapat dibatalkan.`,
      showCancelButton: true,
      confirmButtonText: 'Hapus Permanen',
      confirmButtonColor: '#dc2626',
      cancelButtonText: 'Batal',
    });
    if (!isConfirmed) return;
    await run(() => deleteCleanWaterLocation(location.id), 'Lokasi dihapus');
  };

  const activeCount = locations.filter(item => item.is_active).length;
  const filtered = useMemo(() => locations.filter(item =>
    (filter === 'all' || (filter === 'active') === item.is_active)
    && item.name.toLowerCase().includes(search.trim().toLowerCase())
  ), [locations, filter, search]);

  return (
    <section className="overflow-hidden rounded-2xl border border-cyan-100 bg-white shadow-xl">
      <div className="border-b border-cyan-100 bg-cyan-50 p-5">
        <h2 className="text-lg font-black text-slate-800">Lokasi Pemeriksaan Air Bersih</h2>
        <p className="mt-1 text-xs text-slate-600">Admin mengelola master lokasi. Hanya lokasi aktif yang muncul pada input hasil pemeriksaan.</p>
        <form onSubmit={addLocation} className="mt-4 flex flex-col gap-2 sm:flex-row">
          <input value={newLocation} onChange={event => setNewLocation(event.target.value)}
            maxLength={150} placeholder="Contoh: Bak Penampung Utama"
            className="min-w-0 flex-1 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm"
            aria-label="Nama lokasi baru" />
          <button type="submit" disabled={!newLocation.trim() || busy}
            className="rounded-xl bg-cyan-600 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50">Tambah Lokasi</button>
        </form>
      </div>
      <div className="p-4">
        <div className="flex flex-col gap-2 sm:flex-row">
          <input value={search} onChange={event => setSearch(event.target.value)}
            placeholder="Cari lokasi aktif atau nonaktif..." aria-label="Cari lokasi"
            className="min-w-0 flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm" />
          <select value={filter} onChange={event => setFilter(event.target.value)}
            aria-label="Filter status lokasi" className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm">
            <option value="all">Semua status</option>
            <option value="active">Aktif</option>
            <option value="inactive">Nonaktif</option>
          </select>
        </div>
        {error && <div role="alert" className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">
          {error} <button onClick={refresh} className="font-bold underline">Coba lagi</button>
        </div>}
        {loading ? <p className="py-8 text-center text-sm text-slate-500">Memuat lokasi...</p>
          : filtered.length === 0 ? <p className="py-8 text-center text-sm text-slate-500">Tidak ada lokasi yang cocok.</p>
            : <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {filtered.map(item => <div key={item.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                {editingId === item.id
                  ? <form onSubmit={saveEdit} className="flex flex-wrap gap-2">
                    <input value={editName} onChange={event => setEditName(event.target.value)}
                      maxLength={150} aria-label={`Ubah nama ${item.name}`}
                      className="min-w-0 flex-1 rounded-lg border border-slate-300 px-2 py-1.5 text-sm" />
                    <button disabled={!editName.trim() || busy} className="text-xs font-bold text-cyan-700 disabled:opacity-50">Simpan</button>
                    <button type="button" onClick={() => setEditingId(null)} className="text-xs text-slate-500">Batal</button>
                  </form>
                  : <div className="flex items-center justify-between gap-2">
                    <span className="min-w-0 break-words text-sm font-bold text-slate-800">{item.name}</span>
                    <span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-bold ${item.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}>
                      {item.is_active ? 'Aktif' : 'Nonaktif'}
                    </span>
                  </div>}
                <div className="mt-3 flex flex-wrap gap-3 text-xs font-bold">
                  <button type="button" disabled={busy} onClick={() => { setEditingId(item.id); setEditName(item.name); }}
                    className="text-blue-700 disabled:opacity-50">Edit</button>
                  <button type="button" disabled={busy} onClick={() => toggleLocation(item)}
                    className="text-amber-700 disabled:opacity-50">{item.is_active ? 'Nonaktifkan' : 'Aktifkan'}</button>
                  <button type="button" disabled={busy} onClick={() => removeLocation(item)}
                    className="text-red-600 disabled:opacity-50">Hapus</button>
                </div>
              </div>)}
            </div>}
        <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-500">
          <span>{activeCount} aktif · {locations.length - activeCount} nonaktif</span>
          <button onClick={refresh} disabled={loading || busy} className="font-bold text-cyan-700 disabled:opacity-50">Segarkan</button>
        </div>
      </div>
    </section>
  );
}
