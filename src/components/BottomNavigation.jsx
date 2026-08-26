import { useEffect, useMemo, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { getCurrentUser } from '../lib/api';

const NavItem = ({ item, onClick }) => (
  <NavLink
    to={item.to}
    onClick={onClick}
    className={({ isActive }) => `group relative flex min-w-0 flex-1 flex-col items-center justify-center gap-1 px-1 py-2 text-[10px] font-bold transition-all duration-200 ${
      isActive ? 'text-blue-600' : 'text-slate-500 active:text-blue-600'
    }`}
  >
    {({ isActive }) => (
      <>
        <span className={`${item.emphasized ? '-mt-7 h-13 w-13 rounded-2xl' : 'h-9 w-12 rounded-xl'} relative flex items-center justify-center transition-all duration-200 ${
          item.emphasized
            ? `border border-white/70 bg-linear-to-br from-cyan-400 via-blue-500 to-indigo-600 text-white shadow-[0_8px_0_#1d4ed8,0_13px_22px_rgba(37,99,235,0.38)] ${isActive ? '-translate-y-1 scale-105' : 'active:translate-y-1 active:shadow-[0_4px_0_#1d4ed8,0_7px_14px_rgba(37,99,235,0.3)]'}`
            : isActive
              ? '-translate-y-0.5 border border-white bg-linear-to-b from-white to-blue-50 shadow-[0_5px_10px_rgba(37,99,235,0.18),inset_0_1px_0_white]'
              : 'border border-transparent group-active:translate-y-0.5 group-active:bg-slate-100'
        }`}>
          {item.emphasized && <span className="absolute inset-x-2 top-1 h-1/3 rounded-full bg-white/25 blur-[1px]" />}
          <i className={`${item.icon} relative text-base ${item.emphasized ? 'text-lg drop-shadow-sm' : ''}`} />
        </span>
        <span className={`max-w-full truncate ${item.emphasized ? 'mt-0.5 text-blue-700' : ''}`}>{item.label}</span>
      </>
    )}
  </NavLink>
);

export default function BottomNavigation() {
  const location = useLocation();
  const user = getCurrentUser();
  const role = user?.role?.trim().toLowerCase();
  const isAdmin = role === 'admin';
  const isMahasiswa = role === 'mahasiswa';
  const [moreOpen, setMoreOpen] = useState(false);
  const [keyboardOpen, setKeyboardOpen] = useState(false);

  const { primaryItems, moreItems } = useMemo(() => {
    if (isMahasiswa) {
      return {
        primaryItems: [
          { to: '/dashboard', label: 'Beranda', icon: 'fas fa-house' },
          { to: '/limbah-dihasilkan', label: 'Input', icon: 'fas fa-plus', emphasized: true },
          { to: '/akun', label: 'Akun', icon: 'fas fa-user-gear' },
        ],
        moreItems: [],
      };
    }

    if (isAdmin) {
      return {
        primaryItems: [
          { to: '/dashboard', label: 'Beranda', icon: 'fas fa-house' },
          { to: '/rekap-limbah', label: 'Rekap', icon: 'fas fa-file-invoice' },
          { to: '/riwayat', label: 'Riwayat', icon: 'fas fa-clock-rotate-left' },
        ],
        moreItems: [
          { to: '/kelola-admin', label: 'Kelola Pengguna', icon: 'fas fa-users-gear', description: 'Akun, peran, dan master ruangan' },
          { to: '/akun', label: 'Pengaturan Akun', icon: 'fas fa-user-gear', description: 'Profil dan keamanan akun' },
        ],
      };
    }

    return {
      primaryItems: [
        { to: '/dashboard', label: 'Beranda', icon: 'fas fa-house' },
        { to: '/limbah-dihasilkan', label: 'Input', icon: 'fas fa-plus', emphasized: true },
        { to: '/pengangkutan', label: 'Angkut', icon: 'fas fa-truck' },
        { to: '/rekap-limbah', label: 'Rekap', icon: 'fas fa-file-invoice' },
      ],
      moreItems: [
        { to: '/inspeksi', label: 'Form Inspeksi', icon: 'fas fa-clipboard-check', description: 'Isi pemeriksaan sanitasi' },
        { to: '/riwayat', label: 'Riwayat Inspeksi', icon: 'fas fa-clock-rotate-left', description: 'Lihat dan kelola hasil inspeksi' },
        { to: '/akun', label: 'Pengaturan Akun', icon: 'fas fa-user-gear', description: 'Profil dan keamanan akun' },
      ],
    };
  }, [isAdmin, isMahasiswa]);

  useEffect(() => setMoreOpen(false), [location.pathname]);

  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return undefined;
    const initialHeight = viewport.height;
    const updateKeyboardState = () => setKeyboardOpen(initialHeight - viewport.height > 150);
    viewport.addEventListener('resize', updateKeyboardState);
    return () => viewport.removeEventListener('resize', updateKeyboardState);
  }, []);

  const moreIsActive = moreItems.some(item => item.to === location.pathname);
  if (keyboardOpen) return null;

  return (
    <div className="md:hidden print:hidden">
      {moreOpen && moreItems.length > 0 && (
        <>
          <button
            type="button"
            aria-label="Tutup menu lainnya"
            className="fixed inset-0 z-40 bg-slate-950/45 backdrop-blur-[2px]"
            onClick={() => setMoreOpen(false)}
          />
          <section className="fixed inset-x-0 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-50 mx-3 overflow-hidden rounded-3xl border border-white/80 bg-linear-to-br from-white via-slate-50 to-blue-50 p-3 shadow-[0_18px_50px_rgba(15,23,42,0.28),inset_0_1px_0_white]">
            <div className="pointer-events-none absolute inset-x-8 top-0 h-16 rounded-full bg-blue-200/30 blur-2xl" />
            <div className="mb-2 flex items-center justify-between px-2 py-1">
              <div>
                <p className="text-sm font-black text-slate-800">Menu lainnya</p>
                <p className="text-xs text-slate-400">Pilih fitur yang ingin dibuka</p>
              </div>
              <button type="button" onClick={() => setMoreOpen(false)} className="relative h-9 w-9 rounded-xl border border-white bg-linear-to-b from-white to-slate-100 text-slate-500 shadow-[0_4px_0_#cbd5e1,0_7px_12px_rgba(15,23,42,0.12)] active:translate-y-1 active:shadow-none" aria-label="Tutup">
                <i className="fas fa-xmark" />
              </button>
            </div>
            <div className="space-y-1">
              {moreItems.map(item => (
                <NavLink key={item.to} to={item.to} className="relative flex items-center gap-3 rounded-2xl border border-white/90 bg-white/75 p-3 shadow-[0_5px_12px_rgba(15,23,42,0.07),inset_0_1px_0_white] transition-all active:translate-y-0.5 active:shadow-sm">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white bg-linear-to-br from-cyan-400 to-blue-600 text-white shadow-[0_5px_0_#1d4ed8,0_8px_15px_rgba(37,99,235,0.25)]">
                    <i className={item.icon} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-bold text-slate-700">{item.label}</span>
                    <span className="block truncate text-xs text-slate-400">{item.description}</span>
                  </span>
                  <i className="fas fa-chevron-right text-xs text-slate-300" />
                </NavLink>
              ))}
            </div>
          </section>
        </>
      )}

      <nav className="fixed inset-x-2 bottom-2 z-40 rounded-[1.65rem] border border-white/80 bg-linear-to-b from-white/95 to-slate-100/95 pb-[env(safe-area-inset-bottom)] shadow-[0_12px_30px_rgba(15,23,42,0.22),0_3px_0_#cbd5e1,inset_0_1px_0_white] backdrop-blur-xl" aria-label="Navigasi utama seluler">
        <div className="pointer-events-none absolute inset-x-8 top-0 h-5 rounded-full bg-white/80 blur-md" />
        <div className="relative mx-auto flex h-[4.75rem] max-w-lg items-stretch px-1.5">
          {primaryItems.map(item => <NavItem key={item.to} item={item} />)}
          {moreItems.length > 0 && (
            <button
              type="button"
              onClick={() => setMoreOpen(open => !open)}
              className={`group flex min-w-0 flex-1 flex-col items-center justify-center gap-1 px-1 py-2 text-[10px] font-bold transition-all ${moreOpen || moreIsActive ? 'text-blue-600' : 'text-slate-500'}`}
              aria-expanded={moreOpen}
            >
              <span className={`flex h-9 w-12 items-center justify-center rounded-xl border transition-all ${moreOpen || moreIsActive ? '-translate-y-0.5 border-white bg-linear-to-b from-white to-blue-50 shadow-[0_5px_10px_rgba(37,99,235,0.18),inset_0_1px_0_white]' : 'border-transparent group-active:translate-y-0.5 group-active:bg-slate-100'}`}>
                <i className="fas fa-ellipsis text-base" />
              </span>
              <span>Lainnya</span>
            </button>
          )}
        </div>
      </nav>
    </div>
  );
}
