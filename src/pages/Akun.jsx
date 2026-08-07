import { useState } from 'react';
import AppLayout from '../components/AppLayout';
import Swal from 'sweetalert2';
import withReactContent from 'sweetalert2-react-content';
import { getCurrentUser } from '../lib/api';
import { supabase } from '../lib/supabase';

const MySwal = withReactContent(Swal);

export default function Akun() {
  const user = getCurrentUser();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  
  const [loadingPass, setLoadingPass] = useState(false);

  const handlePasswordChange = async (e) => {
    e.preventDefault();

    if (newPassword !== confirmPassword) {
      MySwal.fire('Error', 'Password baru dan konfirmasi tidak cocok.', 'error');
      return;
    }

    if (newPassword.length < 6) {
      MySwal.fire('Error', 'Password minimal 6 karakter.', 'error');
      return;
    }

    const { isConfirmed } = await MySwal.fire({
      title: 'Yakin Ganti Password?',
      text: 'Anda akan mengganti password akun ini.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#d33',
      confirmButtonText: 'Ya, Ganti!'
    });

    if (!isConfirmed) return;

    setLoadingPass(true);
    MySwal.fire({
      title: 'Memproses...',
      allowOutsideClick: false,
      didOpen: () => {
        MySwal.showLoading();
      }
    });

    try {
      // 1. Dapatkan email asli pengguna dari session Auth Supabase
      const { data: { user: authUser } } = await supabase.auth.getUser();
      let loginEmail = authUser?.email;

      // Fallback 1: Cari email via RPC jika belum ada di session local
      if (!loginEmail && user?.username) {
        const { data: emailRpc } = await supabase.rpc('get_user_email_by_username', {
          p_username: user.username
        });
        if (emailRpc) loginEmail = emailRpc;
      }

      // Fallback 2: Format email default
      if (!loginEmail && user?.username) {
        loginEmail = user.username.includes('@') ? user.username : `${user.username}@rs.com`;
      }

      if (!loginEmail) {
        throw new Error('Email pengguna tidak ditemukan di sistem.');
      }
      
      // Verifikasi password lama dengan mencoba login ulang ke Supabase
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: loginEmail,
        password: currentPassword
      });

      if (signInError) {
        throw new Error('Password saat ini salah!');
      }

      // Update password
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (updateError) {
        throw new Error(updateError.message);
      }

      MySwal.fire({
        icon: 'success',
        title: 'Berhasil!',
        text: 'Password berhasil diganti.',
        timer: 1500,
        showConfirmButton: false
      });

      // Reset form
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');

    } catch (err) {
      console.error(err);
      MySwal.fire('Error', err.message || 'Terjadi kesalahan saat menyimpan password baru.', 'error');
    } finally {
      setLoadingPass(false);
    }
  };

  return (
    <AppLayout title="Setting Akun" showBackButton={false}>
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-md mx-auto bg-white rounded-lg shadow-lg p-6 h-fit">
          <h2 className="text-xl font-bold mb-6 text-gray-800 flex items-center">
            <i className="fas fa-key mr-3 text-emerald-500"></i>Ganti Password
          </h2>

          <div className="mb-6">
            <label className="block text-gray-700 font-bold mb-2 text-sm">Username / Akun Aktif</label>
            <div className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 flex items-center">
              <i className="fas fa-id-badge text-gray-400 mr-3"></i>
              <span className="text-gray-600 font-medium">{user.username}</span>
            </div>
          </div>

          <form onSubmit={handlePasswordChange} className="space-y-4">
            <div>
              <label className="block text-gray-700 font-bold mb-2 text-sm">Password Saat Ini</label>
              <div className="relative">
                <input 
                  type={showCurrent ? "text" : "password"} 
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-emerald-500 outline-none transition pr-12" 
                  required 
                />
                <button 
                  type="button"
                  onClick={() => setShowCurrent(!showCurrent)}
                  className="absolute inset-y-0 right-0 px-4 text-gray-400 hover:text-gray-600"
                >
                  <i className={`fas ${showCurrent ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                </button>
              </div>
            </div>

            <div>
              <label className="block text-gray-700 font-bold mb-2 text-sm">Password Baru</label>
              <div className="relative">
                <input 
                  type={showNew ? "text" : "password"} 
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-emerald-500 outline-none transition pr-12" 
                  required minLength="6" 
                />
                <button 
                  type="button"
                  onClick={() => setShowNew(!showNew)}
                  className="absolute inset-y-0 right-0 px-4 text-gray-400 hover:text-gray-600"
                >
                  <i className={`fas ${showNew ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                </button>
              </div>
            </div>

            <div>
              <label className="block text-gray-700 font-bold mb-2 text-sm">Konfirmasi Password Baru</label>
              <div className="relative">
                <input 
                  type={showConfirm ? "text" : "password"} 
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-emerald-500 outline-none transition pr-12" 
                  required 
                />
                <button 
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute inset-y-0 right-0 px-4 text-gray-400 hover:text-gray-600"
                >
                  <i className={`fas ${showConfirm ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                </button>
              </div>
            </div>

            <div className="pt-4">
              <button 
                type="submit" 
                disabled={loadingPass}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-4 rounded-lg transition disabled:opacity-70 flex justify-center items-center shadow-md active:scale-[0.98]"
              >
                {loadingPass ? (
                  <><i className="fas fa-spinner fa-spin mr-2"></i>Memproses...</>
                ) : (
                  <><i className="fas fa-shield-alt mr-2"></i>Simpan Password</>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </AppLayout>
  );
}
