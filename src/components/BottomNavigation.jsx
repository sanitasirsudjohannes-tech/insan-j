import { useEffect, useMemo, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { getCurrentUser } from '../lib/api';

const NavItem = ({ item, onClick }) => (
  <NavLink
    to={item.to}
    onClick={onClick}
    className={({ isActive }) => `flex min-w-0 flex-1 flex-col items-center justify-center gap-1 px-1 py-2 text-[10px] font-semibold transition-colors ${
      isActive ? 'text-blue-600' : 'text-slate-500 active:text-blue-600'
    }`}
  >
    {({ isActive }) => (
      <>
        <span className={`flex h-8 w-12 items-center justify-center rounded-full transition-colors ${isActive ? 'bg-blue-50' : ''}`}>
          <i className={`${item.icon} text-base`} />
        </span>
        <span className="max-w-full truncate">{item.label}</span>
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
          { to: '/limbah-dihasilkan', label: 'Input', icon: 'fas fa-circle-plus' },
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
        { to: '/limbah-dihasilkan', label: 'Input', icon: 'fas fa-circle-plus' },
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
            className="fixed inset-0 z-40 bg-slate-950/35 backdrop-blur-[1px]"
            onClick={() => setMoreOpen(false)}
          />
          <section className="fixed inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-50 mx-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-2xl">
            <div className="mb-2 flex items-center justify-between px-2 py-1">
              <div>
                <p className="text-sm font-black text-slate-800">Menu lainnya</p>
                <p className="text-xs text-slate-400">Pilih fitur yang ingin dibuka</p>
              </div>
              <button type="button" onClick={() => setMoreOpen(false)} className="h-9 w-9 rounded-full bg-slate-100 text-slate-500" aria-label="Tutup">
                <i className="fas fa-xmark" />
              </button>
            </div>
            <div className="space-y-1">
              {moreItems.map(item => (
                <NavLink key={item.to} to={item.to} className="flex items-center gap-3 rounded-xl p-3 active:bg-slate-100">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
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

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_24px_rgba(15,23,42,0.08)] backdrop-blur-lg" aria-label="Navigasi utama seluler">
        <div className="mx-auto flex h-[4.5rem] max-w-lg items-stretch px-1">
          {primaryItems.map(item => <NavItem key={item.to} item={item} />)}
          {moreItems.length > 0 && (
            <button
              type="button"
              onClick={() => setMoreOpen(open => !open)}
              className={`flex min-w-0 flex-1 flex-col items-center justify-center gap-1 px-1 py-2 text-[10px] font-semibold transition-colors ${moreOpen || moreIsActive ? 'text-blue-600' : 'text-slate-500'}`}
              aria-expanded={moreOpen}
            >
              <span className={`flex h-8 w-12 items-center justify-center rounded-full ${moreOpen || moreIsActive ? 'bg-blue-50' : ''}`}>
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
