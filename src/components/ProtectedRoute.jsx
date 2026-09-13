import { Navigate, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import {
  clearCachedUser,
  getCachedUser,
  restoreUserSession,
} from '../lib/session';
import Swal from 'sweetalert2';
import { useEffect, useRef, useState } from 'react';

function SessionLoading() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4">
      <div className="mb-4 h-12 w-12 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
      <p className="text-sm font-bold text-gray-600">Memulihkan sesi…</p>
      <p className="mt-1 text-center text-xs text-gray-400">Data akan dimuat setelah sesi pengguna siap.</p>
    </div>
  );
}

function SessionError({ onRetry, onLogin }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-6 text-center">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-lg">
        <div className="mb-3 text-4xl text-amber-500"><i className="fas fa-wifi" /></div>
        <h1 className="text-lg font-bold text-gray-800">Sesi belum dapat dipulihkan</h1>
        <p className="mt-2 text-sm text-gray-500">Periksa koneksi internet, lalu coba kembali.</p>
        <button type="button" onClick={onRetry} className="mt-5 w-full rounded-lg bg-blue-600 px-4 py-3 font-semibold text-white hover:bg-blue-700">
          Coba Lagi
        </button>
        <button type="button" onClick={onLogin} className="mt-2 w-full px-4 py-2 text-sm font-semibold text-gray-500">
          Kembali ke Login
        </button>
      </div>
    </div>
  );
}

export default function ProtectedRoute({ children, requiredRole, allowedRoles, deniedRoles }) {
  const [status, setStatus] = useState('checking');
  const [user, setUser] = useState(getCachedUser);
  const [retryKey, setRetryKey] = useState(0);
  const requestIdRef = useRef(0);
  const location = useLocation();

  useEffect(() => {
    let active = true;

    const restore = async ({ showLoading = false } = {}) => {
      const requestId = ++requestIdRef.current;
      if (showLoading) setStatus('checking');
      const result = await restoreUserSession();
      if (!active || requestId !== requestIdRef.current) return;
      setUser(result.user);
      setStatus(result.status);
    };

    restore({ showLoading: true });

    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (!active || event === 'INITIAL_SESSION') return;
      if (event === 'SIGNED_OUT') {
        requestIdRef.current += 1;
        clearCachedUser();
        setUser(null);
        setStatus('unauthenticated');
        return;
      }
      if (['SIGNED_IN', 'TOKEN_REFRESHED', 'USER_UPDATED'].includes(event)) {
        window.setTimeout(() => restore(), 0);
      }
    });

    const restoreWhenOnline = () => restore({ showLoading: true });
    window.addEventListener('online', restoreWhenOnline);

    return () => {
      active = false;
      requestIdRef.current += 1;
      listener?.subscription?.unsubscribe();
      window.removeEventListener('online', restoreWhenOnline);
    };
  }, [retryKey]);

  const returnToLogin = () => {
    requestIdRef.current += 1;
    clearCachedUser();
    setUser(null);
    setStatus('unauthenticated');
    supabase.auth.signOut({ scope: 'local' }).catch(() => {});
  };

  if (status === 'checking') return <SessionLoading />;
  if (status === 'error') {
    return <SessionError onRetry={() => setRetryKey(value => value + 1)} onLogin={returnToLogin} />;
  }
  if (status === 'unauthenticated' || !user) {
    return <Navigate to="/" state={{ from: location }} replace />;
  }

  const normalizedRole = user.role?.trim().toLowerCase();
  const normalizedAllowedRoles = allowedRoles?.map(role => role.toLowerCase());
  const normalizedDeniedRoles = deniedRoles?.map(role => role.toLowerCase());
  const roleDenied = requiredRole
    ? normalizedRole !== requiredRole.toLowerCase()
    : (normalizedAllowedRoles && !normalizedAllowedRoles.includes(normalizedRole))
      || normalizedDeniedRoles?.includes(normalizedRole);

  if (roleDenied) return <RoleCheckRedirect />;
  return children;
}

function RoleCheckRedirect() {
  useEffect(() => {
    Swal.fire({
      icon: 'error',
      title: 'Akses Ditolak',
      text: 'Akun Anda tidak memiliki izin untuk membuka halaman ini.',
      confirmButtonColor: '#3b82f6',
    });
  }, []);
  return <Navigate to="/dashboard" replace />;
}
