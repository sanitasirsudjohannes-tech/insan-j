import { NavLink } from 'react-router-dom';
import { getCurrentUser } from '../lib/api';

export default function Sidebar({ isOpen, onClose }) {
  const user = getCurrentUser();
  const isAdmin = user?.role?.toLowerCase() === 'admin';

  const navItems = [
    { to: '/dashboard', label: 'Dashboard', icon: 'fas fa-th-large' },
    ...(!isAdmin ? [
      { to: '/limbah-padat', label: 'Limbah Medis Padat', icon: 'fas fa-trash-alt' },
      { to: '/limbah-ruangan', label: 'Limbah Per Ruangan', icon: 'fas fa-door-open' },
      { to: '/pengangkutan', label: 'Pengangkutan Limbah', icon: 'fas fa-truck' },
      { to: '/inspeksi', label: 'Form Inspeksi', icon: 'fas fa-clipboard-list' }
    ] : []),
    { to: '/riwayat', label: 'Riwayat Inspeksi', icon: 'fas fa-history' },
    ...(isAdmin ? [{ to: '/kelola-admin', label: 'Kelola Pengguna', icon: 'fas fa-users-cog', adminOnly: true }] : []),
    { to: '/akun', label: 'Setting Akun', icon: 'fas fa-cog' },
  ];

  return (
    <>
      {isOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 transition-opacity duration-300" onClick={onClose} />
      )}
      <aside className={`fixed top-0 left-0 z-50 h-full w-64 bg-linear-to-b from-slate-900 via-slate-800 to-slate-900 shadow-2xl flex flex-col transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>

        {/* Logo */}
        <div className="flex items-center justify-between px-5 py-5 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-linear-to-br from-blue-500 to-cyan-400 flex items-center justify-center shadow-lg shadow-blue-500/25">
              <i className="fas fa-clipboard-check text-white text-sm"></i>
            </div>
            <div>
              <h2 className="text-white font-bold text-base tracking-tight leading-none">INSAN-J</h2>
              <p className="text-slate-400 text-[10px] mt-0.5 tracking-wider uppercase">Sanitasi RS</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors p-1 rounded-md hover:bg-white/10">
            <i className="fas fa-times text-lg"></i>
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest px-3 mb-3">Menu</p>
          {navItems.map(item => (
            <NavLink key={item.to} to={item.to} onClick={onClose}
              className={({ isActive }) =>
                `group flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${isActive
                  ? item.adminOnly ? 'bg-purple-600/20 text-purple-400 shadow-inner' : 'bg-blue-600/20 text-blue-400 shadow-inner'
                  : 'text-slate-300 hover:bg-white/5 hover:text-white'}`
              }>
              {({ isActive }) => (
                <>
                  <span className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-200 ${isActive
                    ? item.adminOnly ? 'bg-purple-500/30 text-purple-400' : 'bg-blue-500/30 text-blue-400'
                    : 'bg-white/5 text-slate-400 group-hover:bg-white/10 group-hover:text-white'}`}>
                    <i className={`${item.icon} text-xs`}></i>
                  </span>
                  <span>{item.label}</span>
                  {item.adminOnly && !isActive && (
                    <span className="ml-auto text-[9px] bg-purple-500/20 text-purple-400 px-1.5 py-0.5 rounded font-bold border border-purple-500/30">ADMIN</span>
                  )}
                  {isActive && (
                    <span className={`ml-auto w-1.5 h-1.5 rounded-full shadow-lg ${item.adminOnly ? 'bg-purple-400 shadow-purple-400/50' : 'bg-blue-400 shadow-blue-400/50'}`}></span>
                  )}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* User info */}
        <div className="px-4 py-4 border-t border-white/10">
          <div className="flex items-center gap-3 px-2">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-md ${user?.role?.toLowerCase() === 'admin'
                  ? 'bg-linear-to-br from-red-500 to-purple-600'
                  : 'bg-linear-to-br from-blue-500 to-cyan-500'
                }`}
            >
              {(user?.nama || 'U').charAt(0).toUpperCase()}
            </div>

            <div className="flex-1 min-w-0">
              <p
                className={`text-sm font-medium truncate ${user?.role?.toLowerCase() === 'admin'
                    ? 'text-purple-300'
                    : 'text-cyan-300'
                  }`}
              >
                {user?.nama || 'User'}
              </p>

              <p
                className={`text-[10px] capitalize font-medium ${user?.role?.toLowerCase() === 'admin'
                    ? 'text-purple-400'
                    : 'text-cyan-400'
                  }`}
              >
                {user?.role || 'Petugas'}
              </p>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}