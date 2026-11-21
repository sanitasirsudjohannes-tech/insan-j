import { Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import Swal from 'sweetalert2';
import { useSession } from './SessionContext';
export default function RoleGate({ children, requiredRole, allowedRoles, deniedRoles }) {
  const { user } = useSession() || {};
  if (!user) return <Navigate to="/" replace />;
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
