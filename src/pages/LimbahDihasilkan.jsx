import { useEffect, useLayoutEffect, useRef, useState, Suspense, lazy } from 'react';
import AppLayout from '../components/AppLayout';
import MissingDateToast from '../components/limbah/MissingDateToast';
import { getCurrentUser } from '../lib/api';
import { readDataFilters } from '../lib/urlDataFilters';

const loadLimbahPadat = () => import('./LimbahPadat');
const loadLimbahRuangan = () => import('./LimbahRuangan');
const loadLimbahAnorganik = () => import('./LimbahAnorganik');

const LimbahPadat = lazy(loadLimbahPadat);
const LimbahRuangan = lazy(loadLimbahRuangan);
const LimbahAnorganik = lazy(loadLimbahAnorganik);

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

const ACTIVE_COLOR = {
  blue: 'bg-blue-500',
  emerald: 'bg-emerald-500',
  cyan: 'bg-cyan-500',
};

export default function LimbahDihasilkan() {
  const user = getCurrentUser();
  const isMahasiswa = user?.role?.toLowerCase() === 'mahasiswa';
  const initialTab = typeof window === 'undefined' ? 'ruangan' : readDataFilters(window.location.search).tab;
  const allowedInitialTab = TABS.some(tab => tab.id === initialTab) && !(isMahasiswa && initialTab === 'padat') ? initialTab : 'ruangan';
  const [activeTab, setActiveTab] = useState(allowedInitialTab);
  const [visitedTabs, setVisitedTabs] = useState(() => new Set([allowedInitialTab]));
  const visibleTabs = isMahasiswa ? TABS.filter((tab) => tab.id !== 'padat') : TABS;
  const activeTabData = TABS.find(tab => tab.id === activeTab);
  const tabListRef = useRef(null);
  const tabRefs = useRef({});
  const panelRefs = useRef({});
  const previousTabRef = useRef(activeTab);
  const [indicator, setIndicator] = useState(null);
  const [reduceMotion, setReduceMotion] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );

  useLayoutEffect(() => {
    const tabList = tabListRef.current;
    const activeButton = tabRefs.current[activeTab];
    if (!tabList || !activeButton) return undefined;
    const updateIndicator = () => {
      setIndicator({ left: activeButton.offsetLeft, width: activeButton.offsetWidth });
    };
    updateIndicator();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(updateIndicator);
    observer?.observe(tabList);
    observer?.observe(activeButton);
    return () => observer?.disconnect();
  }, [activeTab, isMahasiswa]);

  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const updatePreference = () => setReduceMotion(preference.matches);
    preference.addEventListener?.('change', updatePreference);
    return () => preference.removeEventListener?.('change', updatePreference);
  }, []);

  useEffect(() => {
    const previousTab = previousTabRef.current;
    previousTabRef.current = activeTab;
    if (previousTab === activeTab || reduceMotion) return undefined;
    const panel = panelRefs.current[activeTab];
    if (!panel?.animate) return undefined;
    const direction = TABS.findIndex(tab => tab.id === activeTab) >
      TABS.findIndex(tab => tab.id === previousTab) ? 1 : -1;
    const animation = panel.animate(
      [
        { opacity: 0.65, transform: 'translateX(' + (direction * 18) + 'px)' },
        { opacity: 1, transform: 'translateX(0)' },
      ],
      { duration: 320, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' }
    );
    return () => animation.cancel();
  }, [activeTab, reduceMotion]);

  useEffect(() => {
    let cancelled = false;

    const warmOfflineTabs = async () => {
      if (!navigator.onLine) return;

      if ('serviceWorker' in navigator) {
        try {
          await navigator.serviceWorker.ready;
        } catch (error) {
          console.warn('Service worker belum siap untuk cache tab offline:', error);
        }
      }

      if (cancelled || !navigator.onLine) return;
      const loaders = [loadLimbahRuangan, loadLimbahAnorganik];
      if (!isMahasiswa) loaders.push(loadLimbahPadat);
      await Promise.allSettled(loaders.map(load => load()));
    };

    const idleHandle = typeof window.requestIdleCallback === 'function'
      ? window.requestIdleCallback(warmOfflineTabs, { timeout: 2000 })
      : window.setTimeout(warmOfflineTabs, 1000);

    window.addEventListener('online', warmOfflineTabs);
    return () => {
      cancelled = true;
      if (typeof window.cancelIdleCallback === 'function') window.cancelIdleCallback(idleHandle);
      else window.clearTimeout(idleHandle);
      window.removeEventListener('online', warmOfflineTabs);
    };
  }, [isMahasiswa]);

  const handleTabChange = (tabId) => {
    setActiveTab(tabId);
    setVisitedTabs((previousTabs) => {
      if (previousTabs.has(tabId)) return previousTabs;

      const nextTabs = new Set(previousTabs);
      nextTabs.add(tabId);
      return nextTabs;
    });
  };

  return (
    <AppLayout title="Limbah Dihasilkan">
      <MissingDateToast user={user} enabled={!isMahasiswa} />

      <div className="bg-slate-800 border-b border-slate-700 shadow-md">
        <div className="overflow-x-auto px-3 py-2">
          <div ref={tabListRef} role="tablist" aria-label="Jenis limbah" className="relative flex w-max gap-1.5">
            {indicator && (
              <span
                aria-hidden="true"
                className={`absolute top-0 bottom-0 rounded-lg shadow-sm pointer-events-none ${ACTIVE_COLOR[activeTabData.color]}`}
                style={{
                  left: indicator.left,
                  width: indicator.width,
                  transition: reduceMotion ? 'none' : 'left 350ms cubic-bezier(0.22, 1, 0.36, 1), width 350ms cubic-bezier(0.22, 1, 0.36, 1), background-color 250ms ease',
                }}
              />
            )}
            {visibleTabs.map(tab => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  ref={element => { tabRefs.current[tab.id] = element; }}
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => handleTabChange(tab.id)}
                  className={`relative z-10 flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors duration-200
                    ${isActive ? 'text-white' : 'text-slate-400 hover:bg-white/10 hover:text-white'}`}
                >
                  <i className={`${tab.icon} text-[10px]`} />
                  <span className="hidden sm:inline">{tab.label}</span>
                  <span className="sm:hidden">{tab.shortLabel}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {!isMahasiswa && visitedTabs.has('padat') && (
        <div ref={element => { panelRefs.current.padat = element; }} role="tabpanel" className={activeTab === 'padat' ? 'block' : 'hidden'}>
          <Suspense fallback={<LoadingTab />}>
            <LimbahPadat embedded />
          </Suspense>
        </div>
      )}
      {visitedTabs.has('ruangan') && (
        <div ref={element => { panelRefs.current.ruangan = element; }} role="tabpanel" className={activeTab === 'ruangan' ? 'block' : 'hidden'}>
          <Suspense fallback={<LoadingTab />}>
            <LimbahRuangan embedded />
          </Suspense>
        </div>
      )}
      {visitedTabs.has('anorganik') && (
        <div ref={element => { panelRefs.current.anorganik = element; }} role="tabpanel" className={activeTab === 'anorganik' ? 'block' : 'hidden'}>
          <Suspense fallback={<LoadingTab />}>
            <LimbahAnorganik embedded />
          </Suspense>
        </div>
      )}
    </AppLayout>
  );
}
