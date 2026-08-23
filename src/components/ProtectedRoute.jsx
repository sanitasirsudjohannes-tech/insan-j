import { Navigate, useLocation } from 'react-router-dom';
import { getCurrentUser } from '../lib/api';
import Swal from 'sweetalert2';
import { useEffect } from 'react';

// eslint-disable-next-react/prop-types
export default function ProtectedRoute({ children, requiredRole, allowedRoles, deniedRoles }) {
  const user = getCurrentUser();
  const location = useLocation();

  if (!user) {
    return <Navigate to="/" state={{ from: location }} replace />;
  }

  const normalizedRole = user.role?.trim().toLowerCase();
  const normalizedAllowedRoles = allowedRoles?.map((role) => role.toLowerCase());
  const normalizedDeniedRoles = deniedRoles?.map((role) => role.toLowerCase());
  const roleDenied = requiredRole
    ? normalizedRole !== requiredRole.toLowerCase()
    : (normalizedAllowedRoles && !normalizedAllowedRoles.includes(normalizedRole))
      || normalizedDeniedRoles?.includes(normalizedRole);

  if (roleDenied) {
    // We cannot use hooks conditionally, so return a redirect component
    return <RoleCheckRedirect />;
  }

  return children;
}

function RoleCheckRedirect() {
  useEffect(() => {
    Swal.fire({
      icon: 'error',
      title: 'Akses Ditolak',
      text: 'Akun Anda tidak memiliki izin untuk membuka halaman ini.',
      confirmButtonColor: '#3b82f6'
    });
  }, []);
  return <Navigate to="/dashboard" replace />;
}
