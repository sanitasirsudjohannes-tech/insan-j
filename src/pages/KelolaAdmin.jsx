import { useState, useEffect, useCallback } from 'react';
import AppLayout from '../components/AppLayout';
import { getCurrentUser, getSetting, setSetting } from '../lib/api';
import { supabase } from '../lib/supabase';
import Swal from 'sweetalert2';
import withReactContent from 'sweetalert2-react-content';
import { useNavigate } from 'react-router-dom';
import PenggunaTab from '../components/kelola-admin/PenggunaTab';
import RuanganTab from '../components/kelola-admin/RuanganTab';
import PengaturanTab from '../components/kelola-admin/PengaturanTab';

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
  const [kepalaUnit, setKepalaUnit] = useState(null);
  const [savingKepalaUnit, setSavingKepalaUnit] = useState(false);

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
      getSetting('kepala_unit_sanitasi', null).then(setKepalaUnit);
    }
  }, [isAdmin, fetchUsers, fetchRuangan]);

  const handleSetKepalaUnit = async (userId) => {
    const selectedUser = users.find((item) => item.id === userId);
    const nextKepalaUnit = selectedUser
      ? {
          userId: selectedUser.id,
          nama: selectedUser.nama,
          nip: selectedUser.nip || '',
        }
      : null;

    setSavingKepalaUnit(true);

    try {
      const { error: settingError } = await supabase
        .from('app_settings')
        .upsert({ key: 'kepala_unit_sanitasi', value: nextKepalaUnit }, { onConflict: 'key' });

      if (settingError) throw settingError;

      localStorage.setItem('insan_j_setting_kepala_unit_sanitasi', JSON.stringify(nextKepalaUnit));
      setKepalaUnit(nextKepalaUnit);

      window.dispatchEvent(new CustomEvent('app-setting-changed', {
        detail: { key: 'kepala_unit_sanitasi', value: nextKepalaUnit },
      }));

      MySwal.fire({
        icon: 'success',
        title: nextKepalaUnit ? 'Kepala Unit Diperbarui!' : 'Kepala Unit Dikosongkan!',
        text: nextKepalaUnit
          ? `${nextKepalaUnit.nama} akan tercantum pada tanda tangan seluruh laporan.`
          : 'Nama penandatangan tidak akan ditampilkan sampai Kepala Unit dipilih kembali.',
        timer: 2200,
        showConfirmButton: false,
        toast: true,
        position: 'top-end',
      });
    } catch (err) {
      MySwal.fire({
        icon: 'error',
        title: 'Gagal Menyimpan Kepala Unit',
        text: err.message || 'Pengaturan Kepala Unit belum berhasil disimpan ke database.',
      });
    } finally {
      setSavingKepalaUnit(false);
    }
  };

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
          <PenggunaTab
            users={users}
            filteredUsers={filteredUsers}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            loading={loading}
            error={error}
            resettingId={resettingId}
            user={user}
            fetchUsers={fetchUsers}
            handleResetPassword={handleResetPassword}
            kepalaUnit={kepalaUnit}
            savingKepalaUnit={savingKepalaUnit}
            handleSetKepalaUnit={handleSetKepalaUnit}
          />
        )}

        {/* TAB 2: MASTER RUANGAN */}
        {activeTab === 'ruangan' && (
          <RuanganTab
            filteredRuangan={filteredRuangan}
            searchRuangan={searchRuangan}
            setSearchRuangan={setSearchRuangan}
            newRuanganName={newRuanganName}
            setNewRuanganName={setNewRuanganName}
            addingRuangan={addingRuangan}
            loadingRuangan={loadingRuangan}
            handleAddRuangan={handleAddRuangan}
            handleDeleteRuangan={handleDeleteRuangan}
            fetchRuangan={fetchRuangan}
          />
        )}

        {/* TAB 3: PENGATURAN */}
        {activeTab === 'pengaturan' && (
          <PengaturanTab
            formLimbahPadatEnabled={formLimbahPadatEnabled}
            savingSettings={savingSettings}
            handleToggleFormLimbahPadat={handleToggleFormLimbahPadat}
          />
        )}
      </div>
    </AppLayout>
  );
}
