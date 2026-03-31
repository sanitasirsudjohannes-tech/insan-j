import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getCurrentUser, logoutUser } from '../lib/api';

export default function Navbar({ title, showBackButton }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const user = getCurrentUser();
  const isAdmin = user?.role?.toLowerCase() === 'admin';
  const navigate = useNavigate();

  useEffect(() => {
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <nav className="bg-white shadow-lg border-b-2 border-blue-500">
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center">
            {showBackButton ? (
              <button onClick={() => navigate(-1)} className="text-blue-600 font-bold mr-4 hover:text-blue-800 transition">
                &larr; Kembali
              </button>
            ) : (
              <img src="/img/logo.png" alt="Logo" className="h-8 w-auto mr-3" onError={(e) => e.target.style.display='none'} />
            )}
            {title && <h1 className="text-lg font-semibold">{title}</h1>}
          </div>
          <div className="flex items-center space-x-4 relative">
            <button 
              onClick={() => setMenuOpen(!menuOpen)}
              className="text-gray-600 hover:text-gray-800 focus:outline-none px-2 cursor-pointer transition flex items-center"
            >
              <i className="fas fa-user mr-2"></i>
              <span className="hidden sm:inline">{user?.nama || user?.username}</span>
            </button>

            {menuOpen && (
              <div ref={menuRef} className="absolute top-10 right-0 w-44 bg-white border rounded shadow-lg z-50">
                <Link to="/akun" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition">Ganti Password</Link>
              </div>
            )}

            {isAdmin && !showBackButton && (
              <Link to="/riwayat" className="hidden sm:inline-flex bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg text-sm transition items-center">
                <i className="fas fa-history mr-2"></i>Riwayat
              </Link>
            )}

            {/* If on riwayat page, show admin back button specifically or use standard logic */}
            {showBackButton && isAdmin && window.location.pathname === '/riwayat' ? null : null}

            <button onClick={logoutUser} className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg text-sm transition flex items-center">
              <i className="fas fa-sign-out-alt sm:mr-2"></i>
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}
