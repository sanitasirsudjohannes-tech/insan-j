import { useState, useEffect, useCallback } from 'react';
import AppLayout from '../components/AppLayout';
import { getCurrentUser, getSetting, setSetting } from '../lib/api';
import { supabase } from '../lib/supabase';
import Swal from 'sweetalert2';
import withReactContent from 'sweetalert2-react-content';
import { useNavigate } from 'react-router-dom';

const MySwal = withReactContent(Swal);
const DEFAULT_PASSWORD = '12345678';

export default function KelolaAdmin() {
  const user = getCurrentUser();
  const navigate = useNavigate();
  const isAdmin = user?.role?.toLowerCase() === 'admin';

  const [activeTab, setActiveTab] = useState('pengguna'); // 'pengguna' | 'ruangan' | 'pengaturan'

  // User Management State
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [resettingId, setResettingId] = useState(null);

  // Ruangan Management State
  const [ruanganList, setRuanganList] = useState([]);
  const [loadingRuangan, setLoadingRuangan] = useState(false);
  const [searchRuangan, setSearchRuangan] = useState('');
  const [newRuanganName, setNewRuanganName] = useState('');
  const [addingRuangan, setAddingRuangan] = useState(false);

  // Pengaturan State
  const [formLimbahPadatEnabled, setFormLimbahPadatEnabled] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);

  // Guard: redirect non-admin
  useEffect(() => {
    if (!isAdmin) {
      navigate('/dashboard', { replace: true });
    }
  }, [isAdmin, navigate]);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from('profiles')
        .select('id, username, nama, role')
        .order('nama', { ascending: true });

      if (err) throw new Error(err.message);
      setUsers(data || []);
    } catch (err) {
      setError('Gagal memuat data pengguna: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchRuangan = useCallback(async () => {
    setLoadingRuangan(true);
    try {
      const { data, error: err } = await supabase
        .from('ruangan')
        .select('id, nama_ruangan, created_at')
        .order('nama_ruangan', { ascending: true });

      if (err) throw err;
      setRuanganList(data || []);
    } catch (err) {
      console.warn('Gagal mengambil daftar ruangan:', err);
      setRuanganList([]);
    } finally {
      setLoadingRuangan(false);
    }
  }, []);

  useEffect(() => {
    if (isAdmin) {
      fetchUsers();
      fetchRuangan();
      // Baca setting form limbah padat
      getSetting('form_limbah_padat_enabled', true).then(val => setFormLimbahPadatEnabled(val));
    }
  }, [isAdmin, fetchUsers, fetchRuangan]);

  const handleToggleFormLimbahPadat = async (enabled) => {
    setSavingSettings(true);
    setFormLimbahPadatEnabled(enabled);
    await setSetting('form_limbah_padat_enabled', enabled);
    setSavingSettings(false);

    // Broadcast ke komponen LimbahPadat yang sedang terbuka
    window.dispatchEvent(new CustomEvent('app-setting-changed', {
      detail: { key: 'form_limbah_padat_enabled', value: enabled }
    }));

    MySwal.fire({
      icon: 'success',
      title: enabled ? 'Form Diaktifkan!' : 'Form Dinonaktifkan!',
      text: enabled
        ? 'Form input Limbah Padat kini aktif dan dapat digunakan petugas.'
        : 'Form input Limbah Padat telah dimatikan. Data tabel tetap terlihat.',
      timer: 2000,
      showConfirmButton: false,
      toast: true,
      position: 'top-end',
    });
  };

  const handleResetPassword = async (targetUser) => {
    const { isConfirmed } = await MySwal.fire({
      title: 'Reset Password?',
      html: `Password akun <strong>${targetUser.nama}</strong> akan direset ke password bawaan.<br/><br/>
             <div class="mt-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
               <i class="fas fa-key mr-2"></i>Password baru: <strong class="font-mono text-base">${DEFAULT_PASSWORD}</strong>
             </div>`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#f59e0b',
      cancelButtonColor: '#6b7280',
      confirmButtonText: '<i class="fas fa-redo mr-2"></i>Ya, Reset!',
      cancelButtonText: 'Batal',
    });

    if (!isConfirmed) return;

    setResettingId(targetUser.id);
    MySwal.fire({
      title: 'Mereset Password...',
      allowOutsideClick: false,
      didOpen: () => MySwal.showLoading(),
    });

    try {
      const { error: rpcError } = await supabase.rpc('admin_reset_user_password', {
        target_user_id: targetUser.id,
        new_password: DEFAULT_PASSWORD,
      });

      if (rpcError) throw new Error(rpcError.message);

      await MySwal.fire({
        icon: 'success',
        title: 'Password Berhasil Direset!',
        html: `Password <strong>${targetUser.nama}</strong> telah direset ke:<br/>
               <span class="font-mono text-xl font-bold text-emerald-600 mt-2 block">${DEFAULT_PASSWORD}</span>`,
        confirmButtonColor: '#10b981',
      });
    } catch (err) {
      console.error(err);
      MySwal.fire({
        icon: 'error',
        title: 'Reset Gagal',
        text: err.message || 'Terjadi kesalahan saat mereset password.',
      });
    } finally {
      setResettingId(null);
    }
  };

  const handleAddRuangan = async (e) => {
    e.preventDefault();
    if (!newRuanganName.trim()) return;

    setAddingRuangan(true);
    try {
      const { error: err } = await supabase
        .from('ruangan')
        .insert([{ nama_ruangan: newRuanganName.trim() }]);

      if (err) throw err;

      MySwal.fire({
        icon: 'success',
        title: 'Ruangan Ditambahkan!',
        text: `Ruangan "${newRuanganName.trim()}" berhasil ditambahkan ke database.`,
        timer: 2000,
        showConfirmButton: false
      });

      setNewRuanganName('');
      fetchRuangan();
    } catch (err) {
      MySwal.fire('Gagal', err.message || 'Pastikan tabel ruangan sudah dibuat di database Supabase.', 'error');
    } finally {
      setAddingRuangan(false);
    }
  };

  const handleDeleteRuangan = async (item) => {
    const { isConfirmed } = await MySwal.fire({
      title: 'Hapus Ruangan?',
      text: `Ruangan "${item.nama_ruangan}" akan dihapus dari master ruangan.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      confirmButtonText: 'Ya, Hapus!'
    });

    if (!isConfirmed) return;

    try {
      const { error: err } = await supabase.from('ruangan').delete().eq('id', item.id);
      if (err) throw err;

      MySwal.fire('Terhapus', 'Ruangan berhasil dihapus.', 'success');
      fetchRuangan();
    } catch (err) {
      MySwal.fire('Gagal Hapus', err.message, 'error');
    }
  };

  const filteredUsers = users.filter((u) => {
    const q = searchQuery.toLowerCase();
    return (
      u.nama?.toLowerCase().includes(q) ||
      u.username?.toLowerCase().includes(q) ||
      u.role?.toLowerCase().includes(q)
    );
  });

  const filteredRuangan = ruanganList.filter((r) =>
    r.nama_ruangan?.toLowerCase().includes(searchRuangan.toLowerCase())
  );

  const getRoleBadge = (role) => {
    const r = role?.toLowerCase();
    if (r === 'admin') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-purple-100 text-purple-700 border border-purple-200">
          <i className="fas fa-user-shield text-[10px]"></i> Admin
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-700 border border-blue-200">
        <i className="fas fa-user text-[10px]"></i> Petugas
      </span>
    );
  };

  if (!isAdmin) return null;

  return (
    <AppLayout title="Kelola Admin & Master Ruangan" showBackButton={false}>
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Header Card */}
        <div className="bg-linear-to-r from-indigo-600 to-purple-600 rounded-2xl p-6 mb-6 shadow-lg text-white">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight flex items-center gap-3">
                <span className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                  <i className="fas fa-sliders-h text-lg"></i>
                </span>
                Kelola Admin & Master Data
              </h1>
              <p className="text-indigo-200 text-sm mt-1">
                Kelola akun pengguna dan master data ruangan rumah sakit.
              </p>
            </div>
            <div className="flex gap-2 bg-white/10 rounded-xl p-1.5 border border-white/20 flex-wrap">
              <button
                onClick={() => setActiveTab('pengguna')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${activeTab === 'pengguna' ? 'bg-white text-indigo-700 shadow-sm' : 'text-indigo-100 hover:text-white'}`}
              >
                <i className="fas fa-users"></i> Pengguna ({users.length})
              </button>
              <button
                onClick={() => setActiveTab('ruangan')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${activeTab === 'ruangan' ? 'bg-white text-indigo-700 shadow-sm' : 'text-indigo-100 hover:text-white'}`}
              >
                <i className="fas fa-door-open"></i> Ruangan ({ruanganList.length})
              </button>
              <button
                onClick={() => setActiveTab('pengaturan')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${activeTab === 'pengaturan' ? 'bg-white text-indigo-700 shadow-sm' : 'text-indigo-100 hover:text-white'}`}
              >
                <i className="fas fa-sliders-h"></i> Pengaturan
              </button>
            </div>
          </div>
        </div>

        {/* TAB 1: KELOLA PENGGUNA */}
        {activeTab === 'pengguna' && (
          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
            {/* Search Bar */}
            <div className="p-5 border-b border-gray-100">
              <div className="relative">
                <i className="fas fa-search absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"></i>
                <input
                  type="text"
                  placeholder="Cari nama, username, atau role..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition text-sm"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <i className="fas fa-times-circle"></i>
                  </button>
                )}
              </div>
            </div>

            {error && (
              <div className="m-5 bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
                <i className="fas fa-exclamation-circle text-red-500"></i>
                <p className="text-sm text-red-700">{error}</p>
                <button
                  onClick={fetchUsers}
                  className="ml-auto text-xs bg-red-100 hover:bg-red-200 text-red-700 px-3 py-1 rounded-lg font-semibold transition"
                >
                  <i className="fas fa-sync-alt mr-1"></i>Coba Lagi
                </button>
              </div>
            )}

            {loading ? (
              <div className="flex flex-col items-center justify-center py-20">
                <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                <p className="text-gray-500 font-semibold text-sm tracking-wider">
                  MEMUAT DATA PENGGUNA...
                </p>
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="text-center py-16">
                <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <i className="fas fa-user-slash text-3xl text-gray-400"></i>
                </div>
                <p className="text-gray-500 font-semibold">
                  {searchQuery
                    ? `Tidak ada pengguna dengan kata kunci "${searchQuery}"`
                    : 'Belum ada data pengguna.'}
                </p>
              </div>
            ) : (
              <>
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-100">
                        <th className="text-left px-6 py-3.5 font-semibold text-gray-500 text-xs uppercase tracking-wider">#</th>
                        <th className="text-left px-6 py-3.5 font-semibold text-gray-500 text-xs uppercase tracking-wider">Nama</th>
                        <th className="text-left px-6 py-3.5 font-semibold text-gray-500 text-xs uppercase tracking-wider">Username</th>
                        <th className="text-left px-6 py-3.5 font-semibold text-gray-500 text-xs uppercase tracking-wider">Role</th>
                        <th className="text-center px-6 py-3.5 font-semibold text-gray-500 text-xs uppercase tracking-wider">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {filteredUsers.map((u, idx) => (
                        <tr key={u.id} className="hover:bg-indigo-50/30 transition-colors group">
                          <td className="px-6 py-4 text-gray-400 font-medium">{idx + 1}</td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-full bg-linear-to-r from-indigo-500 to-purple-500 flex items-center justify-center text-white text-sm font-bold shadow-sm shrink-0">
                                {(u.nama || 'U').charAt(0).toUpperCase()}
                              </div>
                              <span className="font-semibold text-gray-800">{u.nama}</span>
                              {u.id === user?.id && (
                                <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-bold border border-emerald-200">
                                  Anda
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span className="font-mono text-gray-600 text-xs bg-gray-100 px-2.5 py-1 rounded-lg">
                              {u.username}
                            </span>
                          </td>
                          <td className="px-6 py-4">{getRoleBadge(u.role)}</td>
                          <td className="px-6 py-4 text-center">
                            <button
                              onClick={() => handleResetPassword(u)}
                              disabled={resettingId === u.id}
                              title="Reset password ke bawaan"
                              className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-lg transition-all shadow-sm active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
                            >
                              {resettingId === u.id ? (
                                <><i className="fas fa-spinner fa-spin"></i>Mereset...</>
                              ) : (
                                <><i className="fas fa-key"></i>Reset Password</>
                              )}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="md:hidden divide-y divide-gray-100">
                  {filteredUsers.map((u) => (
                    <div key={u.id} className="p-4 hover:bg-indigo-50/20 transition-colors">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-11 h-11 rounded-full bg-linear-to-r from-indigo-500 to-purple-500 flex items-center justify-center text-white font-bold shadow-sm shrink-0">
                          {(u.nama || 'U').charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-semibold text-gray-800 truncate">{u.nama}</p>
                            {u.id === user?.id && (
                              <span className="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full font-bold border border-emerald-200">
                                Anda
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-500 font-mono mt-0.5">{u.username}</p>
                        </div>
                        {getRoleBadge(u.role)}
                      </div>
                      <button
                        onClick={() => handleResetPassword(u)}
                        disabled={resettingId === u.id}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-white text-sm font-bold rounded-xl transition-all active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed shadow-sm"
                      >
                        {resettingId === u.id ? (
                          <><i className="fas fa-spinner fa-spin"></i>Mereset Password...</>
                        ) : (
                          <><i className="fas fa-key"></i>Reset Password ke Bawaan</>
                        )}
                      </button>
                    </div>
                  ))}
                </div>

                <div className="px-6 py-3 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
                  <p className="text-xs text-gray-500">
                    Menampilkan <strong>{filteredUsers.length}</strong> dari <strong>{users.length}</strong> pengguna
                  </p>
                  <button
                    onClick={fetchUsers}
                    className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-1 transition-colors"
                  >
                    <i className="fas fa-sync-alt text-[10px]"></i>Segarkan
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* TAB 2: MASTER RUANGAN */}
        {activeTab === 'ruangan' && (
          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
            {/* Form Tambah Ruangan */}
            <div className="p-5 border-b border-gray-100 bg-slate-50">
              <form onSubmit={handleAddRuangan} className="flex flex-col sm:flex-row gap-3">
                <input
                  type="text"
                  placeholder="Tambah nama ruangan baru (contoh: Poli Mata)..."
                  value={newRuanganName}
                  onChange={(e) => setNewRuanganName(e.target.value)}
                  className="flex-1 px-4 py-2.5 bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-sm font-medium"
                />
                <button
                  type="submit"
                  disabled={addingRuangan || !newRuanganName.trim()}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl font-bold text-sm transition shadow-sm disabled:opacity-50 flex items-center justify-center gap-2 whitespace-nowrap"
                >
                  {addingRuangan ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-plus"></i>}
                  Tambah Ruangan
                </button>
              </form>
            </div>

            {/* Filter Ruangan */}
            <div className="p-4 border-b border-gray-100">
              <div className="relative">
                <i className="fas fa-search absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"></i>
                <input
                  type="text"
                  placeholder="Filter nama ruangan..."
                  value={searchRuangan}
                  onChange={(e) => setSearchRuangan(e.target.value)}
                  className="w-full pl-11 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-xs sm:text-sm"
                />
              </div>
            </div>

            {loadingRuangan ? (
              <div className="flex flex-col items-center justify-center py-16">
                <i className="fas fa-spinner fa-spin text-emerald-500 text-2xl mb-2"></i>
                <p className="text-gray-500 text-xs font-semibold">Memuat master ruangan...</p>
              </div>
            ) : filteredRuangan.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <i className="fas fa-door-closed text-3xl mb-2 block opacity-40"></i>
                Tidak ada ruangan ditemukan.
              </div>
            ) : (
              <div className="p-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 max-h-125 overflow-y-auto">
                {filteredRuangan.map((item, idx) => (
                  <div key={item.id || idx} className="bg-gray-50 border border-gray-200 hover:border-emerald-300 p-3 rounded-xl flex items-center justify-between transition group">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs font-bold shrink-0">
                        {idx + 1}
                      </span>
                      <span className="text-xs sm:text-sm font-bold text-gray-800 truncate">{item.nama_ruangan}</span>
                    </div>
                    <button
                      onClick={() => handleDeleteRuangan(item)}
                      className="text-gray-400 hover:text-red-600 p-1.5 rounded-lg hover:bg-red-50 transition"
                      title="Hapus Ruangan"
                    >
                      <i className="fas fa-trash-alt text-xs"></i>
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="px-6 py-3 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
              <p className="text-xs text-gray-500">
                Total <strong>{filteredRuangan.length}</strong> ruangan terdaftar
              </p>
              <button
                onClick={fetchRuangan}
                className="text-xs text-emerald-600 hover:text-emerald-800 font-semibold flex items-center gap-1 transition-colors"
              >
                <i className="fas fa-sync-alt text-[10px]"></i>Segarkan Data
              </button>
            </div>
          </div>
        )}
        {/* TAB 3: PENGATURAN */}
        {activeTab === 'pengaturan' && (
          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 bg-slate-50 flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-indigo-100 flex items-center justify-center">
                <i className="fas fa-sliders-h text-indigo-600"></i>
              </div>
              <div>
                <h2 className="font-bold text-gray-800 text-sm">Pengaturan Modul</h2>
                <p className="text-xs text-gray-500">Aktifkan atau nonaktifkan fitur input data untuk petugas</p>
              </div>
            </div>

            <div className="p-6 space-y-4">
              {/* Toggle Form Limbah Padat */}
              <div className={`rounded-2xl border-2 p-5 transition-all ${
                formLimbahPadatEnabled
                  ? 'border-green-200 bg-green-50'
                  : 'border-red-200 bg-red-50'
              }`}>
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
                      formLimbahPadatEnabled ? 'bg-green-100' : 'bg-red-100'
                    }`}>
                      <i className={`fas fa-trash-alt text-xl ${
                        formLimbahPadatEnabled ? 'text-green-600' : 'text-red-500'
                      }`}></i>
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-800 text-sm">Form Input Limbah Padat</h3>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Kontrol akses petugas untuk menginput data limbah padat secara manual.
                        Tabel data & export tetap bisa diakses meski form dimatikan.
                      </p>
                      <span className={`mt-2 inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full ${
                        formLimbahPadatEnabled
                          ? 'bg-green-200 text-green-800'
                          : 'bg-red-200 text-red-800'
                      }`}>
                        <i className={`fas ${ formLimbahPadatEnabled ? 'fa-check-circle' : 'fa-ban' } text-[10px]`}></i>
                        {formLimbahPadatEnabled ? 'Aktif' : 'Nonaktif'}
                      </span>
                    </div>
                  </div>

                  {/* Toggle Switch */}
                  <button
                    onClick={() => handleToggleFormLimbahPadat(!formLimbahPadatEnabled)}
                    disabled={savingSettings}
                    className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors duration-300 focus:outline-none shrink-0 ${
                      formLimbahPadatEnabled ? 'bg-green-500' : 'bg-gray-300'
                    } disabled:opacity-60`}
                    title={formLimbahPadatEnabled ? 'Klik untuk menonaktifkan' : 'Klik untuk mengaktifkan'}
                  >
                    <span className={`inline-block h-6 w-6 transform rounded-full bg-white shadow-md transition-transform duration-300 ${
                      formLimbahPadatEnabled ? 'translate-x-7' : 'translate-x-1'
                    }`} />
                  </button>
                </div>

                <div className={`mt-4 flex gap-2 ${ formLimbahPadatEnabled ? '' : '' }`}>
                  <button
                    onClick={() => handleToggleFormLimbahPadat(true)}
                    disabled={formLimbahPadatEnabled || savingSettings}
                    className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-bold bg-green-600 hover:bg-green-700 text-white transition disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <i className="fas fa-power-off"></i> Aktifkan Form
                  </button>
                  <button
                    onClick={() => handleToggleFormLimbahPadat(false)}
                    disabled={!formLimbahPadatEnabled || savingSettings}
                    className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-bold bg-red-500 hover:bg-red-600 text-white transition disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <i className="fas fa-ban"></i> Nonaktifkan Form
                  </button>
                </div>
              </div>

              <p className="text-xs text-gray-400 px-1">
                <i className="fas fa-info-circle mr-1"></i>
                Pengaturan disimpan ke database dan berlaku untuk semua petugas yang login.
              </p>
            </div>
          </div>
        )}

      </div>
    </AppLayout>
  );
}