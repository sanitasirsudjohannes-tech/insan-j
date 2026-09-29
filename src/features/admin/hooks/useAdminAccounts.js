import { useState } from 'react';
import * as adminService from '../services/adminService';
import MySwal from '../presentation/adminAlert';
import { escapeAdminHTML, generateSecureTemporaryPassword } from '../../../lib/adminSecurity';
export default function useAdminAccounts({ user, fetchUsers, setActiveTab }) {
  const [resettingId, setResettingId] = useState(null);
  const [deletingUserId, setDeletingUserId] = useState(null);
  const [creatingUser, setCreatingUser] = useState(false);
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
      const { error: rpcError } = await adminService.resetUserPassword(targetUser.id, temporaryPassword);

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
      const { data, error: functionError } = await adminService.deleteUser(targetUser.id);
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
      const { data, error: functionError } = await adminService.createUser({ nama, username, password, role });

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

  return { resettingId, deletingUserId, creatingUser, handleResetPassword, handleDeleteUser, handleCreateUser };
}
