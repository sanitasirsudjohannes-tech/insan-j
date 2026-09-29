import DashboardTabs from './DashboardTabs';
import WelcomeBanner from './WelcomeBanner';
import { useEffect, useState } from 'react';
import AppLayout from '../AppLayout';
import TabPengangkutan from './TabPengangkutan';
import TabJenisLimbah from './TabJenisLimbah';
import TabAnorganik from './TabAnorganik';
import DashboardNotification from './DashboardNotification';

export default function DashboardUser({ user }) {
  const [activeTab, setActiveTab] = useState('pengangkutan');
  const [dataRevision, setDataRevision] = useState(0);

  useEffect(() => {
    const relevantTables = new Set([
      'limbah_padat',
      'limbah_ruangan',
      'pengangkutan_limbah',
      'limbah_anorganik',
    ]);
    let refreshTimer;

    const refreshDashboard = event => {
      const changedTables = event.detail?.changedTables || [];
      if (changedTables.length > 0 && !changedTables.some(table => relevantTables.has(table))) return;

      window.clearTimeout(refreshTimer);
      refreshTimer = window.setTimeout(() => setDataRevision(value => value + 1), 120);
    };

    window.addEventListener('offline-sync-finished', refreshDashboard);
    window.addEventListener('insan-j-data-changed', refreshDashboard);

    return () => {
      window.clearTimeout(refreshTimer);
      window.removeEventListener('offline-sync-finished', refreshDashboard);
      window.removeEventListener('insan-j-data-changed', refreshDashboard);
    };
  }, []);

  return (
    <AppLayout title="Dashboard Petugas">
      <div className="container mx-auto px-4 py-8">
        <DashboardNotification key={`notification-${dataRevision}`} />

        <WelcomeBanner user={user} />

        <DashboardTabs activeTab={activeTab} onChange={setActiveTab}>
          {activeTab === 'pengangkutan' && <TabPengangkutan key={`pengangkutan-${dataRevision}`} />}
          {activeTab === 'jenis_limbah' && <TabJenisLimbah key={`jenis-${dataRevision}`} />}
          {activeTab === 'anorganik' && <TabAnorganik key={`anorganik-${dataRevision}`} />}
        </DashboardTabs>

      </div>
    </AppLayout>
  );
}
