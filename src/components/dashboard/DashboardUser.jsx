import { useState } from 'react';
import AppLayout from '../AppLayout';
import TabPengangkutan from './TabPengangkutan';
import TabJenisLimbah from './TabJenisLimbah';

export default function DashboardUser({ user }) {
  const [activeTab, setActiveTab] = useState('pengangkutan');

  return (
    <AppLayout title="Dashboard Petugas">
      <div className="container mx-auto px-4 py-8">

        {/* Welcome Banner */}
        <div className="bg-white rounded-2xl shadow-sm p-6 md:p-8 mb-6 border border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-extrabold text-gray-800">
              Halo, {user?.nama}! <span className="text-2xl">👋</span>
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
            <i className="fas fa-truck-loading mr-2"></i> Pencatatan & Pengangkutan
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
        </div>

        {/* Tab Content */}
        <div className="transition-all duration-300 min-h-[400px]">
          {activeTab === 'pengangkutan' && <TabPengangkutan />}
          {activeTab === 'jenis_limbah' && <TabJenisLimbah />}
        </div>

      </div>
    </AppLayout>
  );
}