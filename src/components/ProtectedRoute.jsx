import { Navigate, useLocation } from 'react-router-dom';
import { getCurrentUser } from '../lib/api';
import { supabase } from '../lib/supabase';
import Swal from 'sweetalert2';
import { useEffect, useState } from 'react';

const clearCachedUser = () => {
  localStorage.removeItem('currentUser');
  sessionStorage.removeItem('currentUser');
};

const cacheUser = user => {
  localStorage.setItem('currentUser', JSON.stringify(user));
  sessionStorage.setItem('currentUser', JSON.stringify(user));
};

async function resolveUserFromSession(session, cachedUser) {
  if (!session?.user) return null;
  if (cachedUser?.id === session.user.id) return cachedUser;

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('username, nama, role')
    .eq('id', session.user.id)
    .single();

  if (error || !profile) throw error || new Error('Profil pengguna tidak ditemukan.');
  return {
    id: session.user.id,
    username: profile.username,
    nama: profile.nama,
    role: profile.role,
  };
}

function SessionLoading() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4">
      <div className="mb-4 h-12 w-12 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
      <p className="text-sm font-bold text-gray-600">Memulihkan sesi…</p>
      <p className="mt-1 text-center text-xs text-gray-400">Data akan dimuat setelah sesi pengguna siap.</p>
    </div>
  );
}

export default function ProtectedRoute({ children, requiredRole, allowedRoles, deniedRoles }) {
  const [status, setStatus] = useState('checking');
  const [user, setUser] = useState(() => getCurrentUser());
  const location = useLocation();

  useEffect(() => {
    let active = true;

    const restoreSession = async () => {
      const cachedUser = getCurrentUser();
      try {
        let { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        let session = data?.session || null;

        if (!session && cachedUser && navigator.onLine) {
          const refreshed = await supabase.auth.refreshSession();
          if (refreshed.error) throw refreshed.error;
          session = refreshed.data?.session || null;
        }

        if (!active) return;
        if (session) {
          const resolvedUser = await resolveUserFromSession(session, cachedUser);
          if (!active) return;
          cacheUser(resolvedUser);
          setUser(resolvedUser);
          setStatus('authenticated');
          return;
        }

        if (!navigator.onLine && cachedUser) {
          setUser(cachedUser);
          setStatus('offline');
          return;
        }

        clearCachedUser();
        setUser(null);
        setStatus('unauthenticated');
      } catch (error) {
        if (!active) return;
        if (!navigator.onLine && cachedUser) {
          setUser(cachedUser);
          setStatus('offline');
          return;
        }
        console.warn('Pemulihan sesi gagal.', { reason: error?.name || 'session_error' });
        clearCachedUser();
        setUser(null);
        setStatus('unauthenticated');
      }
    };

    restoreSession();

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active || event === 'INITIAL_SESSION') return;

      if (event === 'SIGNED_OUT' || !session) {
        clearCachedUser();
        setUser(null);
        setStatus('unauthenticated');
        return;
      }

      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
        window.setTimeout(() => {
          if (!active) return;
          restoreSession().then(() => {
            if (event === 'TOKEN_REFRESHED') {
              window.dispatchEvent(new CustomEvent('insan-j-data-changed', { detail: { changedTables: [] } }));
            }
          });
        }, 0);
      }
    });

    const restoreWhenOnline = () => {
      setStatus('checking');
      restoreSession();
    };
    window.addEventListener('online', restoreWhenOnline);

    return () => {
      active = false;
      listener?.subscription?.unsubscribe();
      window.removeEventListener('online', restoreWhenOnline);
    };
  }, []);

  if (status === 'checking') return <SessionLoading />;
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
