import { useCallback, useEffect, useState } from 'react';
import Sidebar from './Sidebar';
import Navbar from './Navbar';
import OfflineSyncIndicator from './OfflineSyncIndicator';
import BottomNavigation from './BottomNavigation';
import { getSetting, getSettingCached } from '../lib/api';

const MAINTENANCE_SETTING_KEY = 'operational_maintenance_mode';

export default function AppLayout({ children, title, showBackButton }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [maintenanceMode, setMaintenanceMode] = useState(() => (
    getSettingCached(MAINTENANCE_SETTING_KEY, false) === true
  ));

  const refreshMaintenanceMode = useCallback(async () => {
    if (!navigator.onLine) return;
    const enabled = await getSetting(MAINTENANCE_SETTING_KEY, false);
    setMaintenanceMode(enabled === true);
  }, []);

  useEffect(() => {
    refreshMaintenanceMode();

    const handleSettingChange = (event) => {
      if (event.detail?.key === MAINTENANCE_SETTING_KEY) {
        setMaintenanceMode(event.detail.value === true);
      }
    };
    const handleStorage = (event) => {
      if (event.key === `insan_j_setting_${MAINTENANCE_SETTING_KEY}`) {
        setMaintenanceMode(getSettingCached(MAINTENANCE_SETTING_KEY, false) === true);
      }
    };
    const handleVisible = () => {
      if (document.visibilityState === 'visible') refreshMaintenanceMode();
    };

    window.addEventListener('app-setting-changed', handleSettingChange);
    window.addEventListener('storage', handleStorage);
    window.addEventListener('online', refreshMaintenanceMode);
    window.addEventListener('focus', refreshMaintenanceMode);
    document.addEventListener('visibilitychange', handleVisible);
    return () => {
      window.removeEventListener('app-setting-changed', handleSettingChange);
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('online', refreshMaintenanceMode);
      window.removeEventListener('focus', refreshMaintenanceMode);
      document.removeEventListener('visibilitychange', handleVisible);
    };
  }, [refreshMaintenanceMode]);

  return (
    <div className="flex min-h-screen bg-gray-100 print:bg-white relative">
      <div className="print:hidden">
        <OfflineSyncIndicator />
      </div>
      <div className="print:hidden">
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      </div>
      
      <div className="flex-1 flex flex-col min-w-0">
        <div className="print:hidden">
          <Navbar
            title={title}
            showBackButton={showBackButton}
            onMenuToggle={() => setSidebarOpen(prev => !prev)}
          />
        </div>
        {maintenanceMode && (
          <div className="print:hidden bg-amber-100 border-b border-amber-200 px-4 py-2 text-center text-xs font-semibold text-amber-900">
            <i className="fas fa-tools mr-2" />
            Mode pemeliharaan aktif. Input dan sinkronisasi ditunda; draft offline tetap aman di perangkat.
          </div>
        )}
        <main className="flex-1 pb-[calc(5.5rem+env(safe-area-inset-bottom))] md:pb-0">
          {children}
        </main>
      </div>
      <BottomNavigation />
    </div>
  );
}
