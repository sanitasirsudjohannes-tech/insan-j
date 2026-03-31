import { Navigate, useLocation } from 'react-router-dom';
import { getCurrentUser } from '../lib/api';
import Swal from 'sweetalert2';
import { useEffect } from 'react';

// eslint-disable-next-react/prop-types
export default function ProtectedRoute({ children, requiredRole }) {
  const user = getCurrentUser();
  const location = useLocation();

  if (!user) {
    return <Navigate to="/" state={{ from: location }} replace />;
  }

  if (requiredRole && (!user.role || user.role.toLowerCase() !== requiredRole)) {
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
      text: 'Halaman ini hanya untuk admin.',
      confirmButtonColor: '#3b82f6'
    });
  }, []);
  return <Navigate to="/dashboard" replace />;
}
