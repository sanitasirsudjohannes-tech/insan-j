import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { getCurrentUser } from '../lib/api';
import { LANDING_NAV_ITEMS } from './landingNavigation';

const isPathActive = (pathname, to) => pathname === to || pathname.startsWith(`${to}/`);

function MenuLink({ item, onClose, nested = false }) {
  return <NavLink
    to={item.to}
    onClick={onClose}
    className={({ isActive }) => `group flex items-center rounded-lg font-medium transition-all duration-200 ${nested ? 'gap-2 py-2 pl-10 pr-3 text-xs' : 'gap-3 px-3 py-2 text-sm'} ${isActive
      ? item.adminOnly ? 'bg-purple-600/20 text-purple-300' : 'bg-blue-600/20 text-blue-300'
      : 'text-slate-300 hover:bg-white/5 hover:text-white'}`}
  >
    {({ isActive }) => <>
      <span className={`${nested ? 'w-5 text-center' : 'flex h-7 w-7 items-center justify-center rounded-md bg-white/5'} ${isActive ? item.adminOnly ? 'text-purple-400' : 'text-blue-400' : 'text-slate-400 group-hover:text-white'}`}>
        <i className={`${item.icon} text-[11px]`} />
      </span>
      <span className="min-w-0 flex-1 truncate">{item.label}</span>
      {item.adminOnly && !isActive && <span className="text-[8px] font-bold text-purple-400">ADMIN</span>}
      {isActive && <span className={`h-1.5 w-1.5 rounded-full ${item.adminOnly ? 'bg-purple-400' : 'bg-blue-400'}`} />}
    </>}
  </NavLink>;
}

function MenuGroup({ group, pathname, isOpen, onToggle, onClose }) {
  const active = group.items.some(item => isPathActive(pathname, item.to));
  return <div className={`rounded-xl ${active ? 'bg-blue-950/35' : ''}`}>
    <button type="button" onClick={onToggle} aria-expanded={isOpen}
      className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors ${active ? 'text-blue-300' : 'text-slate-300 hover:bg-white/5 hover:text-white'}`}>
      <span className={`flex h-7 w-7 items-center justify-center rounded-md ${active ? 'bg-blue-500/20 text-blue-400' : 'bg-white/5 text-slate-400'}`}><i className={`${group.icon} text-[11px]`} /></span>
      <span className="min-w-0 flex-1 truncate">{group.label}</span>
      <i className={`fas fa-chevron-down text-[9px] text-slate-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
    </button>
    {isOpen && <div className="mb-1 space-y-0.5 border-l border-white/10">{group.items.map(item => <MenuLink key={item.to} item={item} onClose={onClose} nested />)}</div>}
  </div>;
}

export default function Sidebar({ isOpen, onClose, variant = 'app' }) {
  const location = useLocation();
  const [landingOpen, setLandingOpen] = useState(false);

  if (variant === 'landing') {
    const goTo = id => {
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      onClose?.();
    };

    return <>
      {isOpen && (
        <button
          type="button"
          aria-label="Tutup menu"
          className="fixed inset-0 z-70 cursor-default bg-slate-950/45 backdrop-blur-[3px] transition-opacity duration-300"
          onClick={onClose}
        />
      )}

      <aside
        aria-label="Navigasi landing page"
        className={`fixed left-3 top-3 z-80 hidden h-[calc(100%-1.5rem)] w-[18rem] flex-col overflow-hidden rounded-3xl border border-white/10 bg-slate-900/90 shadow-[0_24px_60px_rgba(2,6,23,0.42)] backdrop-blur-2xl transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] md:flex ${isOpen ? 'translate-x-0' : '-translate-x-[calc(100%+1rem)]'}`}
      >
        <div className="absolute inset-x-8 top-0 h-16 rounded-full bg-cyan-400/10 blur-2xl" />

        <div className="relative flex items-center justify-between border-b border-white/10 px-5 py-4">
          <div className="flex min-w-0 items-center gap-3">
            <img src={import.meta.env.BASE_URL + 'img/Icon.webp'} alt="INSAN-J" className="h-10 w-10 shrink-0 rounded-xl object-contain ring-1 ring-white/10" />
            <div className="min-w-0">
              <h2 className="truncate text-sm font-extrabold tracking-wide text-white">INSAN-J</h2>
              <p className="mt-0.5 truncate text-[10px] text-slate-400">Informasi Sanitasi Johannes</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="ml-3 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-400 transition-all hover:bg-white/10 hover:text-white active:scale-95" aria-label="Tutup menu">
            <i className="fas fa-xmark text-sm" />
          </button>
        </div>

        <nav className="relative flex-1 space-y-2 overflow-y-auto px-3 py-5">
          <p className="px-3 pb-2 text-[10px] font-bold uppercase tracking-[0.22em] text-slate-500">Navigasi</p>
          {LANDING_NAV_ITEMS.map(item => (
            <button
              key={item.id}
              type="button"
              onClick={() => goTo(item.id)}
              className="group flex w-full items-center gap-3 rounded-2xl border border-transparent px-3 py-3 text-left transition-all duration-200 hover:border-white/10 hover:bg-white/6 active:scale-[0.98]"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-400 transition-all duration-200 group-hover:border-cyan-300/20 group-hover:bg-cyan-300/10 group-hover:text-cyan-300">
                <i className={`${item.icon} text-sm`} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-slate-200 group-hover:text-white">{item.label}</span>
                <span className="mt-0.5 block truncate text-[10px] text-slate-500 group-hover:text-slate-400">{item.description}</span>
              </span>
              <i className="fas fa-chevron-right text-[9px] text-slate-600 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-slate-400" />
            </button>
          ))}
        </nav>

        <div className="relative border-t border-white/10 px-5 py-4">
          <p className="text-[10px] leading-5 text-slate-500">Unit Sanitasi RSUD Prof. Dr. W.Z. Johannes Kupang</p>
        </div>
      </aside>
    </>; 
  }


  const user = getCurrentUser();
  const role = user?.role?.toLowerCase();
  const isAdmin = role === 'admin';
  const isMahasiswa = role === 'mahasiswa';

  const mahasiswaItems = [
    { to: '/dashboard', label: 'Dashboard', icon: 'fas fa-th-large' },
    { to: '/limbah-dihasilkan', label: 'Input Data Limbah', icon: 'fas fa-recycle' },
    { to: '/akun', label: 'Setting Akun', icon: 'fas fa-cog' },
  ];

  const menu = isAdmin ? [
    { to: '/dashboard', label: 'Dashboard', icon: 'fas fa-th-large' },
    { to: '/rekap-limbah', label: 'Rekap Limbah', icon: 'fas fa-file-invoice' },
    { to: '/asisten-laporan', label: 'Asisten Laporan', icon: 'fas fa-wand-magic-sparkles' },
    { to: '/riwayat', label: 'Riwayat Inspeksi', icon: 'fas fa-history' },
    { to: '/kelola-admin', label: 'Kelola Pengguna', icon: 'fas fa-users-cog', adminOnly: true },
    { to: '/akun', label: 'Setting Akun', icon: 'fas fa-cog' },
  ] : [
    { to: '/dashboard', label: 'Dashboard', icon: 'fas fa-th-large' },
    {
      id: 'waste', label: 'Pengelolaan Limbah', icon: 'fas fa-recycle', items: [
        { to: '/limbah-dihasilkan', label: 'Limbah Dihasilkan', icon: 'fas fa-biohazard' },
        { to: '/pengangkutan', label: 'Pengangkutan', icon: 'fas fa-truck' },
        { to: '/rekap-limbah', label: 'Rekap Limbah', icon: 'fas fa-file-invoice' },
      ]
    },
    {
      id: 'inspection', label: 'Inspeksi Sanitasi', icon: 'fas fa-clipboard-check', items: [
        { to: '/inspeksi', label: 'Form Inspeksi', icon: 'fas fa-pen-to-square' },
        { to: '/riwayat', label: 'Riwayat Inspeksi', icon: 'fas fa-history' },
      ]
    },
    { to: '/pemeriksaan-air', label: 'Pemeriksaan Air', icon: 'fas fa-droplet' },
    { to: '/asisten-laporan', label: 'Asisten Laporan', icon: 'fas fa-wand-magic-sparkles' },
    { to: '/akun', label: 'Setting Akun', icon: 'fas fa-cog' },
  ];

  const initialGroups = Object.fromEntries(menu.filter(item => item.items).map(group => [group.id, group.items.some(item => isPathActive(location.pathname, item.to))]));
  const [openGroups, setOpenGroups] = useState(initialGroups);
  const toggleGroup = id => setOpenGroups(current => ({ ...current, [id]: !current[id] }));

  return <>
    {isOpen && <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm transition-opacity duration-300" onClick={onClose} />}
    <aside className={`fixed left-0 top-0 z-50 flex h-full w-64 flex-col bg-linear-to-b from-slate-900 via-slate-800 to-slate-900 shadow-2xl transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
      <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
        <div className="flex items-center gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-lg bg-linear-to-br from-blue-500 to-cyan-400 shadow-lg shadow-blue-500/25"><i className="fas fa-clipboard-check text-sm text-white" /></div><div><h2 className="text-base font-bold leading-none tracking-tight text-white">INSAN-J</h2><p className="mt-0.5 text-[10px] uppercase tracking-wider text-slate-400">Sanitasi RS</p></div></div>
        <button onClick={onClose} className="rounded-md p-1 text-slate-400 transition-colors hover:bg-white/10 hover:text-white" aria-label="Tutup menu"><i className="fas fa-times text-lg" /></button>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-3">
        <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-widest text-slate-500">Menu</p>
        {(isMahasiswa ? mahasiswaItems : menu).map(item => item.items
          ? <MenuGroup key={item.id} group={item} pathname={location.pathname} isOpen={Boolean(openGroups[item.id])} onToggle={() => toggleGroup(item.id)} onClose={onClose} />
          : <MenuLink key={item.to} item={item} onClose={onClose} />)}
      </nav>

      <div className="border-t border-white/10 px-4 py-3"><div className="flex items-center gap-3 px-2"><div className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-white shadow-md ${isAdmin ? 'bg-linear-to-br from-red-500 to-purple-600' : 'bg-linear-to-br from-blue-500 to-cyan-500'}`}>{(user?.nama || 'U').charAt(0).toUpperCase()}</div><div className="min-w-0 flex-1"><p className={`truncate text-sm font-medium ${isAdmin ? 'text-purple-300' : 'text-cyan-300'}`}>{user?.nama || 'User'}</p><p className={`text-[10px] font-medium capitalize ${isAdmin ? 'text-purple-400' : 'text-cyan-400'}`}>{isMahasiswa ? 'Mahasiswa Praktik' : (user?.role || 'Petugas')}</p></div></div></div>
    </aside>
  </>;
}
