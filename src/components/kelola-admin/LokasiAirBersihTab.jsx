import { useCallback, useEffect, useState } from 'react';
import Swal from 'sweetalert2';
import {
  addCleanWaterLocation,
  deleteCleanWaterLocation,
  getCleanWaterLocations,
} from '../../features/pemeriksaan-air/waterService';

export default function LokasiAirBersihTab() {
  const [locations, setLocations] = useState([]);
  const [newLocation, setNewLocation] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [removingId, setRemovingId] = useState(null);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setLocations(await getCleanWaterLocations());
    } catch (err) {
      setError(err?.message || 'Daftar lokasi tidak dapat dimuat.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const handleAdd = async event => {
    event.preventDefault();
    const name = newLocation.trim();
    if (!name || saving) return;
    setSaving(true);
    try {
      await addCleanWaterLocation(name);
      setNewLocation('');
      await refresh();
      Swal.fire({ icon: 'success', title: 'Lokasi berhasil ditambahkan', timer: 1400, showConfirmButton: false });
    } catch (err) {
      Swal.fire('Gagal Menambah Lokasi', err?.code === '23505'
        ? 'Nama lokasi tersebut sudah terdaftar.'
        : err?.message || 'Periksa koneksi lalu coba lagi.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = async location => {
    const { isConfirmed } = await Swal.fire({
      icon: 'warning',
      title: 'Nonaktifkan lokasi?',
      text: `Lokasi "${location.name}" tidak muncul lagi untuk pemeriksaan baru. Hasil lama tetap tersimpan.`,
      showCancelButton: true,
      confirmButtonText: 'Nonaktifkan',
      cancelButtonText: 'Batal',
      confirmButtonColor: '#dc2626',
    });
    if (!isConfirmed) return;
    setRemovingId(location.id);
    try {
      await deleteCleanWaterLocation(location.id);
      await refresh();
    } catch (err) {
      Swal.fire('Gagal Menonaktifkan', err?.message || 'Periksa koneksi lalu coba lagi.', 'error');
    } finally {
      setRemovingId(null);
    }
  };

  const filtered = locations.filter(item => item.name.toLowerCase().includes(search.trim().toLowerCase()));

  return (
    <section className="overflow-hidden rounded-2xl border border-cyan-100 bg-white shadow-xl">
      <div className="border-b border-cyan-100 bg-cyan-50 p-5">
        <h2 className="text-lg font-black text-slate-800">Lokasi Pemeriksaan Air Bersih</h2>
        <p className="mt-1 text-xs text-slate-600">Nama ruangan atau lokasi bak yang dapat dipilih petugas saat mengisi hasil pemeriksaan.</p>
        <form onSubmit={handleAdd} className="mt-4 flex flex-col gap-2 sm:flex-row">
          <input value={newLocation} onChange={event => setNewLocation(event.target.value)}
            maxLength={150} placeholder="Contoh: Bak Penampung Utama"
            className="min-w-0 flex-1 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-cyan-500"
            aria-label="Nama ruangan atau lokasi bak" />
          <button type="submit" disabled={!newLocation.trim() || saving}
            className="rounded-xl bg-cyan-600 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50">
            {saving ? 'Menyimpan...' : 'Tambah Lokasi'}
          </button>
        </form>
      </div>
      <div className="p-4">
        <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Cari lokasi..."
          className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-cyan-500"
          aria-label="Cari lokasi pemeriksaan air bersih" />
        {error && <div role="alert" className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error} <button onClick={refresh} className="font-bold underline">Coba lagi</button></div>}
        {loading ? <p className="py-8 text-center text-sm text-slate-500">Memuat lokasi...</p>
          : filtered.length === 0 ? <p className="py-8 text-center text-sm text-slate-500">Belum ada lokasi yang cocok.</p>
            : <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {filtered.map(item => <div key={item.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                <span className="min-w-0 truncate text-sm font-bold text-slate-800">{item.name}</span>
                <button type="button" onClick={() => handleDeactivate(item)} disabled={removingId === item.id}
                  className="shrink-0 rounded-lg px-2 py-1 text-xs font-bold text-red-600 hover:bg-red-50 disabled:opacity-50"
                  aria-label={`Nonaktifkan ${item.name}`}>Nonaktifkan</button>
              </div>)}
            </div>}
        <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-500">
          <span>{locations.length} lokasi aktif</span>
          <button onClick={refresh} disabled={loading} className="font-bold text-cyan-700 disabled:opacity-50">Segarkan</button>
        </div>
      </div>
    </section>
  );
}
