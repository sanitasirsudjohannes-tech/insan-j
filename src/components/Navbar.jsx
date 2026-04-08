import { useNavigate } from 'react-router-dom';
import { getCurrentUser, logoutUser } from '../lib/api';

export default function Navbar({ title, showBackButton, onMenuToggle }) {
  const user = getCurrentUser();
  const navigate = useNavigate();

  return (
    <nav className="bg-white shadow-lg border-b-2 border-blue-500 sticky top-0 z-30">
      <div className="px-4 sm:px-6">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center gap-2">
            {/* Hamburger for mobile */}
            <button
              onClick={onMenuToggle}
              className="text-gray-600 hover:text-gray-800 focus:outline-none p-2 rounded-lg hover:bg-gray-100 transition"
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
              <i className="fas fa-user-circle text-lg text-blue-500 mr-2"></i>
              <span className="hidden sm:inline font-medium capitalize">{user?.nama || user?.username}</span>
            </div>

            <button onClick={logoutUser} className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg text-sm transition flex items-center shadow-md">
              <i className="fas fa-sign-out-alt sm:mr-2"></i>
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}
