import { useState, useEffect, useCallback } from 'react';
import AppLayout from '../components/AppLayout';
import { getCurrentUser, getSetting, setSetting } from '../lib/api';
import { supabase } from '../lib/supabase';
import Swal from 'sweetalert2';
import withReactContent from 'sweetalert2-react-content';
import { useNavigate } from 'react-router-dom';
import PenggunaTab from '../components/kelola-admin/PenggunaTab';
import TambahPenggunaTab from '../components/kelola-admin/TambahPenggunaTab';
import RuanganTab from '../components/kelola-admin/RuanganTab';
import PengaturanTab from '../components/kelola-admin/PengaturanTab';
import AdminHeader from '../components/kelola-admin/AdminHeader';
import {
  escapeAdminHTML,
  generateSecureTemporaryPassword,
  isVerifiedAdminProfile,
} from '../lib/adminSecurity';
import {
  buildUserNipState,
  createUserNipSettingValue,
  findActiveKepalaUnit,
  findDuplicateNipUserId,
  getUpdatedKepalaUnit,
  getUserNipSettingKey,
  getUserNipSettingKeys,
  KEPALA_UNIT_SETTING_KEY,
  parseUserNipSetting,
} from '../lib/userNipSettings';

const MySwal = withReactContent(Swal);

export default function KelolaAdmin() {
  const user = getCurrentUser();
  const navigate = useNavigate();
  const claimsAdmin = user?.role?.toLowerCase() === 'admin';
  const [adminVerified, setAdminVerified] = useState(null);
  const isAdmin = claimsAdmin && adminVerified === true;

  const [activeTab, setActiveTab] = useState('pengguna'); // 'pengguna' | 'tambah-pengguna' | 'ruangan' | 'pengaturan'

  // User Management State
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [resettingId, setResettingId] = useState(null);
  const [deletingUserId, setDeletingUserId] = useState(null);
  const [kepalaUnit, setKepalaUnit] = useState(null);
  const [savingKepalaUnit, setSavingKepalaUnit] = useState(false);
  const [userNips, setUserNips] = useState({});
  const [verifiedNips, setVerifiedNips] = useState({});
  const [savingNipId, setSavingNipId] = useState(null);
  const [settingsReady, setSettingsReady] = useState(false);
  const [creatingUser, setCreatingUser] = useState(false);

  // Ruangan Management State
  const [ruanganList, setRuanganList] = useState([]);
  const [loadingRuangan, setLoadingRuangan] = useState(false);
  const [searchRuangan, setSearchRuangan] = useState('');
  const [newRuanganName, setNewRuanganName] = useState('');
  const [addingRuangan, setAddingRuangan] = useState(false);

  // Pengaturan State
  const [formLimbahPadatEnabled, setFormLimbahPadatEnabled] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);

  // Verifikasi sesi dan role dari Supabase; jangan percaya role pada localStorage saja.
  useEffect(() => {
    let active = true;

    if (!claimsAdmin || !user?.id) {
      setAdminVerified(false);
      navigate('/dashboard', { replace: true });
      return undefined;
    }

    const verifyAdmin = async () => {
      try {
        const { data: authData, error: authError } = await supabase.auth.getUser();

        if (authError || !authData?.user?.id) {
          throw new Error('Sesi administrator tidak valid.');
        }

        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('id, role')
          .eq('id', authData.user.id)
          .single();

        if (profileError || !isVerifiedAdminProfile(profile, authData.user.id, user.id)) {
          throw new Error('Akun ini tidak memiliki hak administrator.');
        }

        if (active) setAdminVerified(true);
      } catch (err) {
        if (!active) return;
        console.warn('Verifikasi administrator gagal:', err.message);
        setAdminVerified(false);
        navigate('/dashboard', { replace: true });
      }
    };

    verifyAdmin();

    return () => {
      active = false;
    };
  }, [claimsAdmin, navigate, user?.id]);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    setSettingsReady(false);
    try {
      const { data, error: err } = await supabase
        .from('profiles')
        .select('id, username, nama, role')
        .order('nama', { ascending: true });

      if (err) throw new Error(`Gagal memuat daftar pengguna: ${err.message}`);

      const profiles = data || [];
      setUsers(profiles);

      const settingKeys = getUserNipSettingKeys(profiles);
      const { data: storedSettings, error: readError } = await supabase
        .from('app_settings')
        .select('key, value')
        .in('key', settingKeys);

      if (readError) {
        throw new Error(`Pengaturan NIP gagal dibaca dari database: ${readError.message}`);
      }

      let currentState = buildUserNipState(profiles, storedSettings || []);

      if (currentState.migrationSettings.length > 0) {
        const { error: migrationError } = await supabase
          .from('app_settings')
          .upsert(currentState.migrationSettings, {
            onConflict: 'key',
            ignoreDuplicates: true,
          });

        if (migrationError) {
          throw new Error(`Migrasi NIP lama gagal disimpan: ${migrationError.message}`);
        }

        const { data: migratedSettings, error: rereadError } = await supabase
          .from('app_settings')
          .select('key, value')
          .in('key', settingKeys);

        if (rereadError) {
          throw new Error(`Pengaturan NIP gagal diverifikasi: ${rereadError.message}`);
        }

        currentState = buildUserNipState(profiles, migratedSettings || []);
      }

      const activeKepalaProfile = findActiveKepalaUnit(currentState.kepalaUnit, profiles);
      const updatedKepalaUnit = activeKepalaProfile
        ? getUpdatedKepalaUnit(
            { ...currentState.kepalaUnit, nama: activeKepalaProfile.nama },
            currentState.nips,
            currentState.verifiedNips
          )
        : null;
      const kepalaChanged = JSON.stringify(updatedKepalaUnit)
        !== JSON.stringify(currentState.kepalaUnit || null);

      if (kepalaChanged) {
        const { error: settingError } = await supabase
          .from('app_settings')
          .upsert({ key: KEPALA_UNIT_SETTING_KEY, value: updatedKepalaUnit }, { onConflict: 'key' });

        if (settingError) {
          throw new Error(`Validasi Kepala Unit gagal disimpan: ${settingError.message}`);
        }
      }

      Object.entries(currentState.nips).forEach(([userId, nip]) => {
        localStorage.setItem(
          `insan_j_setting_${getUserNipSettingKey(userId)}`,
          JSON.stringify(createUserNipSettingValue(nip, currentState.verifiedNips[userId]))
        );
      });
      localStorage.setItem(
        `insan_j_setting_${KEPALA_UNIT_SETTING_KEY}`,
        JSON.stringify(updatedKepalaUnit)
      );
      setUserNips(currentState.nips);
      setVerifiedNips(currentState.verifiedNips);
      setKepalaUnit(updatedKepalaUnit);
      setSettingsReady(true);
    } catch (err) {
      setError(err.message || 'Gagal memuat data pengguna dan pengaturan NIP.');
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

  const handleSetKepalaUnit = async (userId) => {
    if (!settingsReady || savingNipId) return;

    const selectedUser = users.find((item) => item.id === userId);
    setSavingKepalaUnit(true);

    try {
      let nextKepalaUnit = null;

      if (selectedUser) {
        const { data: nipSetting, error: nipReadError } = await supabase
          .from('app_settings')
          .select('value')
          .eq('key', getUserNipSettingKey(selectedUser.id))
          .maybeSingle();

        if (nipReadError) {
          throw new Error(`NIP Kepala Unit gagal dibaca: ${nipReadError.message}`);
        }

        const nipData = parseUserNipSetting(nipSetting?.value);
        nextKepalaUnit = {
          userId: selectedUser.id,
          nama: selectedUser.nama,
          nip: nipData.nip || '',
          nipVerified: nipData.verified,
        };
      }

      const { error: settingError } = await supabase
        .from('app_settings')
        .upsert({ key: KEPALA_UNIT_SETTING_KEY, value: nextKepalaUnit }, { onConflict: 'key' });

      if (settingError) throw settingError;

      localStorage.setItem(`insan_j_setting_${KEPALA_UNIT_SETTING_KEY}`, JSON.stringify(nextKepalaUnit));
      setKepalaUnit(nextKepalaUnit);

      window.dispatchEvent(new CustomEvent('app-setting-changed', {
        detail: { key: KEPALA_UNIT_SETTING_KEY, value: nextKepalaUnit },
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

  const persistUserNip = async (targetUser, nip, verified = Boolean(nip)) => {
    if (!settingsReady || savingNipId || savingKepalaUnit) return;

    setSavingNipId(targetUser.id);

    try {
      const { data: currentSettings, error: readError } = await supabase
        .from('app_settings')
        .select('key, value')
        .in('key', getUserNipSettingKeys(users));

      if (readError) {
        throw new Error(`NIP terbaru gagal dibaca dari database: ${readError.message}`);
      }

      const currentState = buildUserNipState(users, currentSettings || []);
      const duplicateUserId = findDuplicateNipUserId(currentState.nips, targetUser.id, nip);

      if (duplicateUserId) {
        const duplicateUser = users.find((item) => item.id === duplicateUserId);
        throw new Error(`NIP tersebut sudah digunakan oleh ${duplicateUser?.nama || 'petugas lain'}.`);
      }

      const nextNips = { ...currentState.nips, [targetUser.id]: nip || null };
      const nextVerifiedNips = {
        ...currentState.verifiedNips,
        [targetUser.id]: Boolean(nip && verified),
      };
      const isKepalaUnit = currentState.kepalaUnit?.userId === targetUser.id;
      const nextKepalaUnit = isKepalaUnit
        ? getUpdatedKepalaUnit(currentState.kepalaUnit, nextNips, nextVerifiedNips)
        : currentState.kepalaUnit;
      const nextNipValue = createUserNipSettingValue(nip, verified);
      const settings = [{ key: getUserNipSettingKey(targetUser.id), value: nextNipValue }];

      if (isKepalaUnit) {
        settings.push({ key: KEPALA_UNIT_SETTING_KEY, value: nextKepalaUnit });
      }

      const { error: settingError } = await supabase
        .from('app_settings')
        .upsert(settings, { onConflict: 'key' });

      if (settingError) throw settingError;

      localStorage.setItem(
        `insan_j_setting_${getUserNipSettingKey(targetUser.id)}`,
        JSON.stringify(nextNipValue)
      );
      setUserNips(nextNips);
      setVerifiedNips(nextVerifiedNips);

      if (isKepalaUnit) {
        localStorage.setItem(
          `insan_j_setting_${KEPALA_UNIT_SETTING_KEY}`,
          JSON.stringify(nextKepalaUnit)
        );
        setKepalaUnit(nextKepalaUnit);
        window.dispatchEvent(new CustomEvent('app-setting-changed', {
          detail: { key: KEPALA_UNIT_SETTING_KEY, value: nextKepalaUnit },
        }));
      }

      MySwal.fire({
        icon: 'success',
        title: nip ? 'NIP Berhasil Diverifikasi!' : 'NIP Berhasil Dihapus!',
        text: nip
          ? `NIP ${targetUser.nama} telah diperbarui.`
          : `NIP ${targetUser.nama} telah dikosongkan.`,
        timer: 1800,
        showConfirmButton: false,
        toast: true,
        position: 'top-end',
      });
    } catch (err) {
      MySwal.fire({
        icon: 'error',
        title: 'Gagal Menyimpan NIP',
        text: err.message || 'NIP belum berhasil disimpan ke pengaturan aplikasi.',
      });
    } finally {
      setSavingNipId(null);
    }
  };

  const handleVerifyNip = async (targetUser) => {
    const nip = userNips[targetUser.id];
    if (!nip || verifiedNips[targetUser.id]) return;

    const { isConfirmed } = await MySwal.fire({
      title: 'Verifikasi NIP Petugas?',
      text: `Pastikan NIP ${nip} benar-benar milik ${targetUser.nama}.`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Ya, NIP Sudah Benar',
      cancelButtonText: 'Periksa Lagi',
      confirmButtonColor: '#16a34a',
    });

    if (!isConfirmed) return;
    await persistUserNip(targetUser, nip, true);
  };

  const handleEditNip = async (targetUser) => {
    const currentNip = userNips[targetUser.id] || '';
    const { isConfirmed, value } = await MySwal.fire({
      title: currentNip ? 'Ubah NIP Petugas' : 'Tambah NIP Petugas',
      text: targetUser.nama,
      input: 'text',
      inputValue: currentNip,
      inputPlaceholder: 'Masukkan NIP 18 digit',
      inputAttributes: {
        maxlength: '18',
        inputmode: 'numeric',
        autocomplete: 'off',
      },
      showCancelButton: true,
      confirmButtonText: '<i class="fas fa-save mr-2"></i>Simpan NIP',
      cancelButtonText: 'Batal',
      confirmButtonColor: '#4f46e5',
      inputValidator: (input) => {
        const normalizedNip = String(input || '').trim();

        if (!/^\d{18}$/.test(normalizedNip)) {
          return 'NIP harus terdiri dari tepat 18 angka.';
        }

        const duplicateUserId = findDuplicateNipUserId(userNips, targetUser.id, normalizedNip);

        if (duplicateUserId) {
          const duplicateUser = users.find((item) => item.id === duplicateUserId);
          return `NIP sudah digunakan oleh ${duplicateUser?.nama || 'petugas lain'}.`;
        }

        return undefined;
      },
    });

    if (!isConfirmed) return;
    await persistUserNip(targetUser, String(value).trim());
  };

  const handleDeleteNip = async (targetUser) => {
    const { isConfirmed } = await MySwal.fire({
      title: 'Hapus NIP Petugas?',
      text: `NIP ${targetUser.nama} akan dikosongkan dan dapat ditambahkan kembali.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Ya, Hapus NIP',
      cancelButtonText: 'Batal',
      confirmButtonColor: '#dc2626',
    });

    if (!isConfirmed) return;
    await persistUserNip(targetUser, null);
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
    if (targetUser.id === user?.id) {
      MySwal.fire({
        icon: 'info',
        title: 'Gunakan Menu Akun',
        text: 'Untuk mengubah password Anda sendiri, gunakan fitur Ganti Password pada menu Akun.',
      });
      return;
    }

    const { isConfirmed } = await MySwal.fire({
      title: 'Reset Password?',
      text: `Password ${targetUser.nama} akan diganti dengan password sementara yang unik dan aman.`,
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
      const temporaryPassword = generateSecureTemporaryPassword();
      const { error: rpcError } = await supabase.rpc('admin_reset_user_password', {
        target_user_id: targetUser.id,
        new_password: temporaryPassword,
      });

      if (rpcError) throw new Error(rpcError.message);

      await MySwal.fire({
        icon: 'success',
        title: 'Password Berhasil Direset!',
        html: `Password sementara untuk <strong>${escapeAdminHTML(targetUser.nama)}</strong>:<br/>
               <span class="font-mono text-xl font-bold text-emerald-600 mt-2 block">${escapeAdminHTML(temporaryPassword)}</span>
               <p class="mt-3 text-xs text-gray-500">Sampaikan secara aman dan minta petugas menggantinya melalui menu Akun.</p>`,
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

  const handleDeleteUser = async (targetUser) => {
    if (targetUser.id === user?.id || targetUser.role?.toLowerCase() === 'admin') {
      MySwal.fire('Akun Dilindungi', 'Akun administrator tidak dapat dihapus melalui fitur ini.', 'info');
      return;
    }

    const { isConfirmed } = await MySwal.fire({
      icon: 'warning',
      title: 'Hapus Pengguna?',
      html: `Akun <strong>${escapeAdminHTML(targetUser.nama)}</strong> akan dihapus permanen dan tidak dapat login lagi.<br/><span class="mt-2 block text-sm text-gray-500">Data limbah yang pernah dibuat tetap dipertahankan.</span>`,
      showCancelButton: true,
      confirmButtonColor: '#dc2626',
      cancelButtonColor: '#6b7280',
      confirmButtonText: '<i class="fas fa-trash-alt mr-2"></i>Ya, Hapus Akun',
      cancelButtonText: 'Batal',
    });
    if (!isConfirmed) return;

    setDeletingUserId(targetUser.id);
    try {
      const { data, error: functionError } = await supabase.functions.invoke('admin-delete-user', {
        body: { userId: targetUser.id },
      });
      if (functionError) throw functionError;
      if (!data?.success) throw new Error(data?.error || 'Akun tidak berhasil dihapus.');

      await fetchUsers();
      MySwal.fire('Akun Dihapus', `Akun ${targetUser.nama} berhasil dihapus.`, 'success');
    } catch (err) {
      let errorMessage = err.message || 'Terjadi kesalahan saat menghapus akun.';
      if (err.context instanceof Response) {
        try {
          const responseBody = await err.context.clone().json();
          errorMessage = responseBody?.error || errorMessage;
        } catch {
          // Pertahankan pesan bawaan jika respons bukan JSON.
        }
      }
      MySwal.fire('Gagal Menghapus Akun', errorMessage, 'error');
    } finally {
      setDeletingUserId(null);
    }
  };

  const handleCreateUser = async (form) => {
    const username = form.username.trim().toLowerCase();
    const nama = form.nama.trim();
    const password = form.password;
    const role = form.role?.toLowerCase();

    if (!/^[a-z0-9._-]{3,32}$/.test(username)) {
      MySwal.fire('Data Belum Valid', 'Username harus terdiri dari 3–32 karakter: huruf kecil, angka, titik, garis bawah, atau tanda hubung.', 'warning');
      return false;
    }

    if (!['user', 'mahasiswa'].includes(role)) {
      MySwal.fire('Data Belum Valid', 'Role pengguna tidak dikenali.', 'warning');
      return false;
    }

    if (
      password.length < 12
      || !/[A-Z]/.test(password)
      || !/[a-z]/.test(password)
      || !/[0-9]/.test(password)
      || !/[^a-zA-Z0-9]/.test(password)
    ) {
      MySwal.fire('Password Belum Aman', 'Gunakan minimal 12 karakter yang berisi huruf besar, huruf kecil, angka, dan simbol.', 'warning');
      return false;
    }

    setCreatingUser(true);
    try {
      const { data, error: functionError } = await supabase.functions.invoke('admin-create-user', {
        body: { nama, username, password, role },
      });

      if (functionError) throw functionError;
      if (!data?.success) throw new Error(data?.error || 'Akun tidak berhasil dibuat.');

      await fetchUsers();
      await MySwal.fire({
        icon: 'success',
        title: 'Akun Berhasil Dibuat',
        html: `Akun <strong>${escapeAdminHTML(nama)}</strong> dibuat sebagai <strong>${role === 'mahasiswa' ? 'Mahasiswa Praktik' : 'Petugas'}</strong>.<br/><span class="mt-2 block text-sm text-gray-500">Sampaikan password sementara secara langsung kepada pengguna.</span>`,
        confirmButtonColor: '#4f46e5',
      });
      setActiveTab('pengguna');
      return true;
    } catch (err) {
      let errorMessage = err.message || 'Terjadi kesalahan saat membuat akun.';

      if (err.context instanceof Response) {
        try {
          const responseBody = await err.context.clone().json();
          errorMessage = responseBody?.error || errorMessage;
        } catch {
          // Pertahankan pesan bawaan jika respons bukan JSON.
        }
      }

      MySwal.fire({
        icon: 'error',
        title: 'Gagal Membuat Akun',
        text: errorMessage,
        confirmButtonColor: '#dc2626',
      });
      return false;
    } finally {
      setCreatingUser(false);
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
      u.role?.toLowerCase().includes(q) ||
      userNips[u.id]?.includes(q)
    );
  });

  const filteredRuangan = ruanganList.filter((r) =>
    r.nama_ruangan?.toLowerCase().includes(searchRuangan.toLowerCase())
  );

  if (!isAdmin) return null;

  return (
    <AppLayout title="Kelola Admin & Master Ruangan" showBackButton={false}>
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <AdminHeader
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          userCount={users.length}
          roomCount={ruanganList.length}
        />

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
            deletingUserId={deletingUserId}
            user={user}
            fetchUsers={fetchUsers}
            handleResetPassword={handleResetPassword}
            handleDeleteUser={handleDeleteUser}
            kepalaUnit={kepalaUnit}
            savingKepalaUnit={savingKepalaUnit}
            handleSetKepalaUnit={handleSetKepalaUnit}
            userNips={userNips}
            verifiedNips={verifiedNips}
            savingNipId={savingNipId}
            settingsReady={settingsReady}
            handleEditNip={handleEditNip}
            handleDeleteNip={handleDeleteNip}
            handleVerifyNip={handleVerifyNip}
          />
        )}

        {/* TAB 2: TAMBAH PENGGUNA */}
        {activeTab === 'tambah-pengguna' && (
          <TambahPenggunaTab
            onSubmit={handleCreateUser}
            submitting={creatingUser}
          />
        )}

        {/* TAB 3: MASTER RUANGAN */}
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

        {/* TAB 4: PENGATURAN */}
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
