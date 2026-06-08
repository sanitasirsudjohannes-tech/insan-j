import { useState, useEffect, useCallback } from 'react';
import AppLayout from '../components/AppLayout';
import { getCurrentUser } from '../lib/api';
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

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [resettingId, setResettingId] = useState(null);

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

  useEffect(() => {
    if (isAdmin) fetchUsers();
  }, [isAdmin, fetchUsers]);

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
      // Gunakan RPC function yang sudah dibuat di Supabase dengan SECURITY DEFINER
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

  const filteredUsers = users.filter((u) => {
    const q = searchQuery.toLowerCase();
    return (
      u.nama?.toLowerCase().includes(q) ||
      u.username?.toLowerCase().includes(q) ||
      u.role?.toLowerCase().includes(q)
    );
  });

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
    <AppLayout title="Kelola Pengguna" showBackButton={false}>
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Header Card */}
        <div className="bg-linear-to-r from-indigo-600 to-purple-600 rounded-2xl p-6 mb-6 shadow-lg text-white">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight flex items-center gap-3">
                <span className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                  <i className="fas fa-users-cog text-lg"></i>
                </span>
                Kelola Pengguna
              </h1>
              <p className="text-indigo-200 text-sm mt-1">
                Reset password pengguna ke password bawaan <span className="font-mono font-bold text-white bg-white/20 px-2 py-0.5 rounded">{DEFAULT_PASSWORD}</span>
              </p>
            </div>
            <div className="flex items-center gap-2 bg-white/10 rounded-xl px-4 py-2.5 border border-white/20">
              <i className="fas fa-users text-indigo-200"></i>
              <span className="text-white font-bold text-lg">{users.length}</span>
              <span className="text-indigo-200 text-sm">Pengguna</span>
            </div>
          </div>
        </div>

        {/* Info Box */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 flex items-start gap-3">
          <i className="fas fa-info-circle text-amber-500 mt-0.5 shrink-0"></i>
          <div className="text-sm text-amber-800">
            <p className="font-semibold">Tentang Fitur Reset Password</p>
            <p className="mt-1 text-amber-700">Fitur ini akan mereset password pengguna ke <strong className="font-mono">{DEFAULT_PASSWORD}</strong>. Pengguna disarankan untuk mengganti password mereka setelah login. Pastikan <strong>function SQL</strong> <code className="bg-amber-100 px-1 rounded">admin_reset_user_password</code> sudah dibuat di Supabase.</p>
          </div>
        </div>

        {/* Main Card */}
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

          {/* Content */}
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
              <p className="text-gray-500 font-semibold text-sm tracking-wider">MEMUAT DATA PENGGUNA...</p>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <i className="fas fa-user-slash text-3xl text-gray-400"></i>
              </div>
              <p className="text-gray-500 font-semibold">
                {searchQuery ? `Tidak ada pengguna dengan kata kunci "${searchQuery}"` : 'Belum ada data pengguna.'}
              </p>
            </div>
          ) : (
            <>
              {/* Desktop Table */}
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

              {/* Mobile Cards */}
              <div className="md:hidden divide-y divide-gray-100">
                {filteredUsers.map((u, idx) => (
                  <div key={u.id} className="p-4 hover:bg-indigo-50/20 transition-colors">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-11 h-11 rounded-full bg-linear-to-r from-indigo-500 to-purple-500 flex items-center justify-center text-white font-bold shadow-sm shrink-0">
                        {(u.nama || 'U').charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-gray-800 truncate">{u.nama}</p>
                          {u.id === user?.id && (
                            <span className="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full font-bold border border-emerald-200">Anda</span>
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

              {/* Footer */}
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

        {/* SQL Setup Guide */}
        <div className="mt-6 bg-slate-800 rounded-2xl p-5 text-slate-300 text-sm shadow-xl">
          <p className="font-bold text-white flex items-center gap-2 mb-3">
            <i className="fas fa-database text-indigo-400"></i>
            Setup: SQL Function di Supabase
          </p>
          <p className="text-slate-400 text-xs mb-3">Buat function berikut di <strong className="text-white">Supabase → SQL Editor</strong> agar reset password berfungsi:</p>
          <pre className="bg-slate-900 rounded-xl p-4 text-xs font-mono overflow-x-auto text-green-300 leading-relaxed whitespace-pre-wrap">{`CREATE OR REPLACE FUNCTION admin_reset_user_password(
  target_user_id UUID,
  new_password TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_role TEXT;
BEGIN
  -- Periksa apakah pemanggil adalah admin
  SELECT role INTO caller_role
  FROM public.profiles
  WHERE id = auth.uid();

  IF caller_role IS NULL OR LOWER(caller_role) != 'admin' THEN
    RAISE EXCEPTION 'Akses ditolak. Hanya admin yang bisa mereset password.';
  END IF;

  -- Reset password via auth.users
  UPDATE auth.users
  SET encrypted_password = crypt(new_password, gen_salt('bf'))
  WHERE id = target_user_id;
END;
$$;`}</pre>
        </div>
      </div>
    </AppLayout>
  );
}
