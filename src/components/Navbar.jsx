import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';
import { getCurrentUser, logoutUser } from '../lib/api';
import { getOfflineQueue, syncOfflineQueue } from '../lib/offlineStorage';

export default function Navbar({ title, showBackButton, onMenuToggle }) {
  // const user = getCurrentUser();
  const navigate = useNavigate();
  const user = getCurrentUser();
  const role = user?.role?.trim().toLowerCase();
  const isAdmin = role === 'admin';
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = async () => {
    if (loggingOut) return;

    const pendingCount = getOfflineQueue().length;
    if (pendingCount === 0) {
      setLoggingOut(true);
      await logoutUser();
      return;
    }

    if (!navigator.onLine) {
      const { isConfirmed } = await Swal.fire({
        icon: 'warning',
        title: `${pendingCount} Draft Belum Terkirim`,
        text: 'Perangkat sedang offline. Draft tetap tersimpan di HP dan hanya dapat dilanjutkan setelah akun yang sama masuk kembali.',
        showCancelButton: true,
        confirmButtonText: 'Tetap Logout',
        cancelButtonText: 'Batal',
        confirmButtonColor: '#dc2626',
      });
      if (!isConfirmed) return;
      setLoggingOut(true);
      await logoutUser();
      return;
    }

    const choice = await Swal.fire({
      icon: 'warning',
      title: `${pendingCount} Draft Belum Terkirim`,
      text: 'Sinkronkan terlebih dahulu agar data tidak tertahan di HP ini.',
      showDenyButton: true,
      showCancelButton: true,
      confirmButtonText: 'Sinkronkan Sekarang',
      denyButtonText: 'Tetap Logout',
      cancelButtonText: 'Batal',
      confirmButtonColor: '#059669',
      denyButtonColor: '#dc2626',
    });

    if (choice.isDismissed) return;
    if (choice.isDenied) {
      setLoggingOut(true);
      await logoutUser();
      return;
    }

    setLoggingOut(true);
    Swal.fire({
      title: 'Menyinkronkan Draft...',
      text: 'Mohon jangan tutup aplikasi.',
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading(),
    });

    try {
      await syncOfflineQueue(false, true);
      const remainingCount = getOfflineQueue().length;
      if (remainingCount === 0) {
        await logoutUser();
        return;
      }

      const remainingChoice = await Swal.fire({
        icon: 'warning',
        title: `${remainingCount} Draft Masih Gagal`,
        text: 'Draft tetap aman di HP. Logout hanya jika Anda memahami bahwa sinkronisasi harus dilanjutkan dengan akun yang sama.',
        showCancelButton: true,
        confirmButtonText: 'Tetap Logout',
        cancelButtonText: 'Tetap di Aplikasi',
        confirmButtonColor: '#dc2626',
      });
      if (remainingChoice.isConfirmed) {
        await logoutUser();
        return;
      }
    } catch (error) {
      console.error('Sinkronisasi sebelum logout gagal:', error);
      await Swal.fire({
        icon: 'error',
        title: 'Sinkronisasi Gagal',
        text: 'Draft tetap tersimpan di HP. Silakan periksa koneksi dan coba kembali.',
        confirmButtonColor: '#2563eb',
      });
    } finally {
      setLoggingOut(false);
    }
  };

  return (
    <nav className="bg-white shadow-lg border-b-2 border-blue-500 sticky top-0 z-30">
      <div className="px-4 sm:px-6">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center gap-2">
            {/* Hamburger for mobile */}
            <button
              onClick={onMenuToggle}
              className="hidden md:block text-gray-600 hover:text-gray-800 focus:outline-none p-2 rounded-lg hover:bg-gray-100 transition"
              aria-label="Toggle sidebar"
            >
              <i className="fas fa-bars text-lg"></i>
            </button>

            {showBackButton ? (
              <button
                onClick={() => navigate(-1)}
                className="text-blue-600 font-bold mr-4 hover:text-blue-800 transition"
                aria-label="Kembali"
              >
                <i className="fas fa-arrow-left mr-1"></i> Kembali
              </button>
            ) : (
              <img src={`${import.meta.env.BASE_URL}img/logo.webp`} alt="Logo" className="h-12 w-auto mr-3 hidden lg:block" onError={(e) => e.target.style.display = 'none'} />
            )}
            {title && <h1 className="text-lg font-semibold">{title}</h1>}
          </div>
          <div className="flex items-center space-x-3">
            <div className="text-gray-600 flex items-center bg-gray-100 rounded-full py-1.5 px-3">
              <i
                className={`fas fa-user-circle text-lg mr-2 ${isAdmin ? 'text-purple-600' : 'text-cyan-600'
                  }`}
              ></i>

              <span
                className={`hidden sm:inline font-medium capitalize ${isAdmin ? 'text-purple-700' : 'text-cyan-700'
                  }`}
              >
                {user?.nama || user?.username}
              </span>
            </div>

            <button
              onClick={handleLogout}
              disabled={loggingOut}
              className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg text-sm transition flex items-center shadow-md disabled:opacity-60"
            >
              <i className={`fas ${loggingOut ? 'fa-spinner fa-spin' : 'fa-sign-out-alt'} sm:mr-2`}></i>
              <span className="hidden sm:inline">{loggingOut ? 'Memproses...' : 'Logout'}</span>
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}
