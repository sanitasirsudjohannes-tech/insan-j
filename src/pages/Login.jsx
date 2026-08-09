import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';
import withReactContent from 'sweetalert2-react-content';
import { getCurrentUser, fetchDaftarRuangan } from '../lib/api';
import { supabase } from '../lib/supabase';

const MySwal = withReactContent(Swal);

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Redirect if already logged in
    if (getCurrentUser()) {
      navigate('/dashboard');
    }
  }, [navigate]);

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!username || !password) {
      MySwal.fire({
        icon: 'error',
        title: 'Oops...',
        text: 'Username dan password harus diisi!',
        confirmButtonColor: '#3b82f6'
      });
      return;
    }

    setLoading(true);

    try {
      // 1. Cari email berdasarkan username dari tabel profiles yang dicocokkan dengan auth.users
      let loginEmail = '';
      const { data: emailRpc, error: rpcError } = await supabase.rpc('get_user_email_by_username', {
        p_username: username
      });

      if (!rpcError && emailRpc) {
        // Jika fungsi SQL berhasil dan email ditemukan
        loginEmail = emailRpc;
      } else {
        // Fallback jika belum di-run fungsi SQL-nya (sementara)
        loginEmail = username.includes('@') ? username : `${username}@rs.com`;
      }

      // 2. Login menggunakan email yang sudah didapatkan
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: loginEmail,
        password: password,
      });

      if (authError) {
        throw new Error(authError.message);
      }

      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authData.user.id)
        .single();

      if (profileError || !profileData) {
        console.error('Error fetching profile:', profileError);
        throw new Error('Profil pengguna tidak ditemukan di sistem.');
      }

      const userData = {
        id: authData.user.id,
        username: profileData.username,
        nama: profileData.nama,
        role: profileData.role,
      };

      localStorage.setItem('currentUser', JSON.stringify(userData));
      sessionStorage.setItem('currentUser', JSON.stringify(userData));

      // Cache daftar ruangan agar bisa digunakan secara offline
      fetchDaftarRuangan().catch(() => {});

      MySwal.fire({
        icon: 'success',
        title: 'Login Berhasil!',
        text: `Selamat datang, ${userData.nama}`,
        timer: 1500,
        showConfirmButton: false
      }).then(() => {
        navigate('/dashboard');
      });

    } catch (error) {
      // Hapus console.error agar log teknis tidak muncul
      MySwal.fire({
        icon: 'error',
        title: 'Login Gagal',
        text: 'Username atau password salah!',
        confirmButtonColor: '#3b82f6'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-linear-to-br from-blue-500 to-purple-600 px-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md transform transition-all hover:scale-[1.02] duration-300">
        <div className="text-center mb-8">
          <img src={`${import.meta.env.BASE_URL}img/logo.webp`} alt="Logo" className="max-w-50 h-auto mx-auto" onError={(e) => e.target.style.display = 'none'} />
        </div>

        <h3 className="text-2xl font-bold text-center text-gray-800 mb-8">Login Aplikasi</h3>

        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label className="block text-gray-700 text-sm font-semibold mb-2" htmlFor="username">
              <i className="fas fa-user mr-2 text-blue-500"></i>Username
            </label>
            <div className="relative">
              <input
                type="text"
                id="username"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                className="w-full pl-4 pr-10 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                placeholder="Masukkan username"
              />
              <i className="fas fa-user absolute right-3 top-3.5 text-gray-400"></i>
            </div>
          </div>

          <div>
            <label className="block text-gray-700 text-sm font-semibold mb-2" htmlFor="password">
              <i className="fas fa-lock mr-2 text-blue-500"></i>Password
            </label>
            <div className="password-input-group">
              <input
                type={showPassword ? "text" : "password"}
                id="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                className="w-full pl-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                placeholder="Masukkan password"
              />
              <i
                className={`fas ${showPassword ? 'fa-eye-slash' : 'fa-eye'} password-toggle`}
                onClick={() => setShowPassword(!showPassword)}
              ></i>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-linear-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-semibold py-3 px-4 rounded-lg transition duration-300 transform hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 shadow-lg disabled:opacity-70 disabled:hover:scale-100"
          >
            {loading ? (
              <><i className="fas fa-spinner fa-spin mr-2"></i>Loading...</>
            ) : (
              <><i className="fas fa-sign-in-alt mr-2"></i>Login</>
            )}
          </button>
        </form>

        <p className="text-center text-xs text-gray-400 mt-6">
          © {new Date().getFullYear()} INSAN-J. Sanitasi RSUD Johannes Kupang.
        </p>
      </div>
    </div>
  );
}
