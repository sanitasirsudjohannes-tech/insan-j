import { useState, Suspense, lazy } from 'react';
import AppLayout from '../components/AppLayout';
import { getCurrentUser } from '../lib/api';

const LimbahPadat = lazy(() => import('./LimbahPadat'));
const LimbahRuangan = lazy(() => import('./LimbahRuangan'));
const LimbahAnorganik = lazy(() => import('./LimbahAnorganik'));

const LoadingTab = () => (
  <div className="flex flex-col items-center justify-center py-24">
    <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-3" />
    <p className="text-gray-400 text-sm font-semibold tracking-widest">MEMUAT DATA...</p>
  </div>
);

const TABS = [
  { id: 'ruangan', label: 'Limbah Per Ruangan', shortLabel: 'Per Ruangan', icon: 'fas fa-door-open', color: 'emerald' },
  { id: 'padat', label: 'Data Limbah', shortLabel: 'Data Limbah', icon: 'fas fa-trash-alt', color: 'blue' },
  { id: 'anorganik', label: 'Limbah Anorganik', shortLabel: 'Anorganik', icon: 'fas fa-recycle', color: 'cyan' },
];

const COLOR = {
  blue: {
    active: 'bg-blue-500 text-white border-blue-400',
    inactive: 'text-slate-400 hover:text-white border-transparent hover:bg-white/10',
    dot: 'bg-blue-300',
  },
  emerald: {
    active: 'bg-emerald-500 text-white border-emerald-400',
    inactive: 'text-slate-400 hover:text-white border-transparent hover:bg-white/10',
    dot: 'bg-emerald-300',
  },
  cyan: {
    active: 'bg-cyan-500 text-white border-cyan-400',
    inactive: 'text-slate-400 hover:text-white border-transparent hover:bg-white/10',
    dot: 'bg-cyan-300',
  },
};

export default function LimbahDihasilkan() {
  const user = getCurrentUser();
  const isMahasiswa = user?.role?.toLowerCase() === 'mahasiswa';
  const [activeTab, setActiveTab] = useState('ruangan');
  const visibleTabs = isMahasiswa ? TABS.filter((tab) => tab.id !== 'padat') : TABS;

  return (
    <AppLayout title="Limbah Dihasilkan">
      <div className="bg-slate-800 border-b border-slate-700 shadow-md">
        <div className="flex items-center gap-2 px-3 py-2">
          <div className="w-6 h-6 rounded-md bg-amber-500/20 flex items-center justify-center shrink-0">
            <i className="fas fa-biohazard text-amber-400 text-[10px]" />
          </div>
          <div className="flex gap-1.5 overflow-x-auto">
            {visibleTabs.map(tab => {
              const isActive = activeTab === tab.id;
              const c = COLOR[tab.color];
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold
                    transition-all duration-150 whitespace-nowrap
                    ${isActive ? c.active : c.inactive}`}
                >
                  <i className={`${tab.icon} text-[10px]`} />
                  <span className="hidden sm:inline">{tab.label}</span>
                  <span className="sm:hidden">{tab.shortLabel}</span>
                  {isActive && <span className={`w-1 h-1 rounded-full ${c.dot} animate-pulse`} />}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {!isMahasiswa && (
        <div className={activeTab === 'padat' ? 'block' : 'hidden'}>
          <Suspense fallback={<LoadingTab />}>
            <LimbahPadat embedded />
          </Suspense>
        </div>
      )}
      <div className={activeTab === 'ruangan' ? 'block' : 'hidden'}>
        <Suspense fallback={<LoadingTab />}>
          <LimbahRuangan embedded />
        </Suspense>
      </div>
      <div className={activeTab === 'anorganik' ? 'block' : 'hidden'}>
        <Suspense fallback={<LoadingTab />}>
          <LimbahAnorganik embedded />
        </Suspense>
      </div>
    </AppLayout>
  );
}
