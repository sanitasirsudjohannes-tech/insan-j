import { useState } from 'react';
import Navbar from '../components/Navbar';
import Swal from 'sweetalert2';
import withReactContent from 'sweetalert2-react-content';
import { API_URL, getCurrentUser } from '../lib/api';

const MySwal = withReactContent(Swal);

export default function Akun() {
  const user = getCurrentUser();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (newPassword !== confirmPassword) {
      MySwal.fire('Error', 'Password baru dan konfirmasi tidak cocok.', 'error');
      return;
    }

    if (newPassword.length < 6) {
      MySwal.fire('Error', 'Password minimal 6 karakter.', 'error');
      return;
    }

    // Local check if password was stored in session
    if (user.password && currentPassword !== user.password) {
      MySwal.fire('Error', 'Password saat ini salah.', 'error');
      return;
    }

    const { isConfirmed } = await MySwal.fire({
      title: 'Yakin?',
      text: 'Anda akan mengganti password akun ini.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#d33',
      confirmButtonText: 'Ya, Ganti!'
    });

    if (!isConfirmed) return;

    setLoading(true);
    MySwal.fire({
      title: 'Memproses...',
      allowOutsideClick: false,
      didOpen: () => {
        MySwal.showLoading();
      }
    });

    try {
      const formData = new URLSearchParams();
      formData.append('action', 'changePassword');
      formData.append('username', user.username || '');
      formData.append('userId', user.id || '');
      formData.append('oldPassword', currentPassword);
      formData.append('newPassword', newPassword);
      formData.append('timestamp', new Date().toISOString());

      await fetch(API_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formData
      });

      // Update session locally
      const updatedUser = { ...user, password: newPassword };
      sessionStorage.setItem('currentUser', JSON.stringify(updatedUser));

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
      MySwal.fire('Info', 'Terjadi kesalahan saat mengirim data. Data tetap diproses secara lokal.', 'info');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-gray-100 min-h-screen">
      <Navbar title="Akun" showBackButton={true} />

      <div className="container mx-auto px-4 py-8">
        <div className="max-w-md mx-auto bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-xl font-bold mb-6 text-gray-800 flex items-center">
            <i className="fas fa-key mr-2 text-blue-500"></i>Ganti Password
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-gray-700 font-bold mb-2 text-sm">Username</label>
              <input 
                type="text" 
                value={user?.username || user?.nama || ''} 
                className="w-full border rounded-lg px-3 py-2 bg-gray-50 text-gray-500 cursor-not-allowed" 
                disabled 
              />
            </div>

            <div>
              <label className="block text-gray-700 font-bold mb-2 text-sm">Password Saat Ini</label>
              <div className="password-input-group">
                <input 
                  type={showCurrent ? "text" : "password"} 
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none" 
                  required 
                />
                <i 
                  className={`fas ${showCurrent ? 'fa-eye-slash' : 'fa-eye'} password-toggle`}
                  onClick={() => setShowCurrent(!showCurrent)}
                ></i>
              </div>
            </div>

            <div>
              <label className="block text-gray-700 font-bold mb-2 text-sm">Password Baru</label>
              <div className="password-input-group">
                <input 
                  type={showNew ? "text" : "password"} 
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none" 
                  required minLength="6" 
                />
                <i 
                  className={`fas ${showNew ? 'fa-eye-slash' : 'fa-eye'} password-toggle`}
                  onClick={() => setShowNew(!showNew)}
                ></i>
              </div>
            </div>

            <div>
              <label className="block text-gray-700 font-bold mb-2 text-sm">Konfirmasi Password Baru</label>
              <div className="password-input-group">
                <input 
                  type={showConfirm ? "text" : "password"} 
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none" 
                  required 
                />
                <i 
                  className={`fas ${showConfirm ? 'fa-eye-slash' : 'fa-eye'} password-toggle`}
                  onClick={() => setShowConfirm(!showConfirm)}
                ></i>
              </div>
            </div>

            <div className="pt-4">
              <button 
                type="submit" 
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg transition disabled:opacity-70 flex justify-center items-center shadow-md hover:shadow-lg active:scale-[0.98]"
              >
                {loading ? (
                  <><i className="fas fa-spinner fa-spin mr-2"></i>Memproses...</>
                ) : (
                  <><i className="fas fa-save mr-2"></i>Simpan Perubahan</>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
