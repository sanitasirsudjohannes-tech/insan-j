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

    window.addEventListener('offline-sync-complete', refreshDashboard);
    window.addEventListener('insan-j-data-changed', refreshDashboard);

    return () => {
      window.clearTimeout(refreshTimer);
      window.removeEventListener('offline-sync-complete', refreshDashboard);
      window.removeEventListener('insan-j-data-changed', refreshDashboard);
    };
  }, []);

  return (
    <AppLayout title="Dashboard Petugas">
      <div className="container mx-auto px-4 py-8">
        <DashboardNotification key={`notification-${dataRevision}`} />

        {/* Welcome Banner */}
        <div className="bg-white rounded-2xl shadow-sm p-6 md:p-8 mb-6 border border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-extrabold text-gray-800">
              Hallo, {user?.nama}! <span className="text-2xl">👋</span>
            </h2>
            <p className="text-gray-500 mt-2 font-medium">Monitoring data limbah medis padat rumah sakit dengan mudah.</p>
          </div>
          <div className="bg-blue-50 text-blue-600 px-4 py-2 rounded-lg font-bold text-sm shadow-inner flex items-center w-max">
            <i className="fas fa-calendar-day mr-2"></i>
            {new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-2 mb-8 inline-flex flex-wrap md:flex-nowrap gap-2">
          <button
            onClick={() => setActiveTab('pengangkutan')}
            className={`px-5 py-2.5 rounded-lg font-semibold text-sm transition-all duration-200 flex items-center ${activeTab === 'pengangkutan'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-500/30'
              : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'
              }`}
          >
            <i className="fas fa-truck-loading mr-2"></i> Sisa Limbah & Pengangkutan
          </button>
          <button
            onClick={() => setActiveTab('jenis_limbah')}
            className={`px-5 py-2.5 rounded-lg font-semibold text-sm transition-all duration-200 flex items-center ${activeTab === 'jenis_limbah'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-500/30'
              : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'
              }`}
          >
            <i className="fas fa-layer-group mr-2"></i> Jenis & Trend Bulanan
          </button>
          <button
            onClick={() => setActiveTab('anorganik')}
            className={`px-5 py-2.5 rounded-lg font-semibold text-sm transition-all duration-200 flex items-center ${activeTab === 'anorganik'
              ? 'bg-cyan-600 text-white shadow-md shadow-cyan-500/30'
              : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'
              }`}
          >
            <i className="fas fa-recycle mr-2"></i> Limbah Anorganik
          </button>
        </div>

        {/* Tab Content */}
        <div className="min-h-[400px]">
          {activeTab === 'pengangkutan' && <TabPengangkutan key={`pengangkutan-${dataRevision}`} />}
          {activeTab === 'jenis_limbah' && <TabJenisLimbah key={`jenis-${dataRevision}`} />}
          {activeTab === 'anorganik' && <TabAnorganik key={`anorganik-${dataRevision}`} />}
        </div>

      </div>
    </AppLayout>
  );
}
