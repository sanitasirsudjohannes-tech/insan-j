import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';
import withReactContent from 'sweetalert2-react-content';
import { fetchDaftarRuangan } from '../lib/api';
import { supabase } from '../lib/supabase';
import {
  cacheUser,
  clearCachedUser,
  loadUserProfile,
  restoreUserSession,
} from '../lib/session';

const MySwal = withReactContent(Swal);

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [sessionError, setSessionError] = useState(false);
  const [recoveryAttempt, setRecoveryAttempt] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    let active = true;
    setCheckingSession(true);
    setSessionError(false);

    restoreUserSession().then(result => {
      if (!active) return;
      if (['authenticated', 'offline', 'degraded'].includes(result.status) && result.user) {
        navigate('/dashboard', { replace: true });
        return;
      }
      setSessionError(result.status === 'error');
      setCheckingSession(false);
    });

    return () => { active = false; };
  }, [navigate, recoveryAttempt]);

  const handleLogin = async event => {
    event.preventDefault();
    if (!username || !password) {
      MySwal.fire({
        icon: 'error',
        title: 'Oops...',
        text: 'Username dan password harus diisi!',
        confirmButtonColor: '#3b82f6',
      });
      return;
    }

    setLoading(true);
    let authenticated = false;

    try {
      const { data: emailRpc, error: rpcError } = await supabase.rpc('get_user_email_by_username', {
        p_username: username,
      });
      const loginEmail = !rpcError && emailRpc
        ? emailRpc
        : (username.includes('@') ? username : `${username}@rs.com`);

      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: loginEmail,
        password,
      });
      if (authError) throw authError;
      authenticated = true;

      const userData = await loadUserProfile(authData.user.id);
      cacheUser(userData);
      fetchDaftarRuangan().catch(() => {});

      await MySwal.fire({
        icon: 'success',
        title: 'Login Berhasil!',
        text: `Selamat datang, ${userData.nama}`,
        timer: 1500,
        showConfirmButton: false,
      });
      navigate('/dashboard', { replace: true });
    } catch (error) {
      if (authenticated && error?.code === 'profile_not_found') {
        clearCachedUser();
        await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
        MySwal.fire({
          icon: 'error',
          title: 'Profil Tidak Ditemukan',
          text: 'Akun berhasil dikenali, tetapi profil pengguna belum tersedia. Hubungi admin.',
          confirmButtonColor: '#3b82f6',
        });
      } else if (authenticated) {
        MySwal.fire({
          icon: 'warning',
          title: 'Profil Belum Termuat',
          text: 'Login berhasil, tetapi profil belum dapat dimuat. Periksa koneksi lalu coba lagi.',
          confirmButtonColor: '#3b82f6',
        });
      } else {
        MySwal.fire({
          icon: 'error',
          title: 'Login Gagal',
          text: 'Username atau password salah!',
          confirmButtonColor: '#3b82f6',
        });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-linear-to-br from-blue-500 to-purple-600 px-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md transform transition-all hover:scale-[1.02] duration-300">
        <div className="text-center mb-8">
          <img src={`${import.meta.env.BASE_URL}img/logo.webp`} alt="Logo" className="max-w-50 h-auto mx-auto" onError={event => { event.target.style.display = 'none'; }} />
        </div>

        <h3 className="text-2xl font-bold text-center text-gray-800 mb-8">Login Aplikasi</h3>

        {checkingSession && (
          <div className="mb-5 rounded-lg bg-blue-50 px-4 py-3 text-center text-sm font-medium text-blue-700">
            <i className="fas fa-spinner fa-spin mr-2" />Memeriksa sesi sebelumnya…
          </div>
        )}

        {sessionError && !checkingSession && (
          <div className="mb-5 rounded-lg bg-amber-50 px-4 py-3 text-center text-sm text-amber-800">
            <p>Sesi sebelumnya belum dapat diperiksa.</p>
            <button type="button" onClick={() => setRecoveryAttempt(value => value + 1)} className="mt-2 font-bold text-blue-700">
              Coba Lagi
            </button>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-6">
          <label className="block text-gray-700 text-sm font-semibold" htmlFor="username">
            <span className="mb-2 block"><i className="fas fa-user mr-2 text-blue-500" />Username</span>
            <div className="relative">
              <input type="text" id="username" required value={username} onChange={event => setUsername(event.target.value)} autoComplete="username" disabled={checkingSession} className="w-full pl-4 pr-10 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition disabled:bg-gray-100" placeholder="Masukkan username" />
              <i className="fas fa-user absolute right-3 top-3.5 text-gray-400" />
            </div>
          </label>

          <label className="block text-gray-700 text-sm font-semibold" htmlFor="password">
            <span className="mb-2 block"><i className="fas fa-lock mr-2 text-blue-500" />Password</span>
            <div className="password-input-group">
              <input type={showPassword ? 'text' : 'password'} id="password" required value={password} onChange={event => setPassword(event.target.value)} autoComplete="current-password" disabled={checkingSession} className="w-full pl-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition disabled:bg-gray-100" placeholder="Masukkan password" />
              <i className={`fas ${showPassword ? 'fa-eye-slash' : 'fa-eye'} password-toggle`} onClick={() => setShowPassword(value => !value)} />
            </div>
          </label>

          <button type="submit" disabled={loading || checkingSession} className="w-full bg-linear-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-semibold py-3 px-4 rounded-lg transition duration-300 transform hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 shadow-lg disabled:opacity-70 disabled:hover:scale-100">
            {loading ? <><i className="fas fa-spinner fa-spin mr-2" />Loading...</> : <><i className="fas fa-sign-in-alt mr-2" />Login</>}
          </button>
        </form>

        <p className="text-center text-xs text-gray-400 mt-6">
          © {new Date().getFullYear()} INSAN-J. Sanitasi RSUD Johannes Kupang.
        </p>
      </div>
    </div>
  );
}
