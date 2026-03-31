import Navbar from '../components/Navbar';
import { getCurrentUser } from '../lib/api';

export default function Riwayat() {
  const user = getCurrentUser();

  return (
    <div className="bg-gray-100 min-h-screen">
      <Navbar title="Riwayat Aktivitas" showBackButton={true} />

      <main className="container mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8 border-b pb-4">
            <div>
              <h2 className="text-2xl font-bold text-gray-800">Semua Riwayat (Admin)</h2>
              <p className="text-sm text-gray-500 mt-1">Daftar inspeksi rutin dan isian nilai sanitasi.</p>
            </div>
            <div className="mt-4 md:mt-0 flex items-center bg-blue-50 px-4 py-2 rounded-lg text-blue-700 font-medium">
              <i className="fas fa-user-shield mr-2"></i>Status: {user?.role || 'Admin'}
            </div>
          </div>

          <div id="contentArea" className="mt-10">
            <div className="text-center text-gray-500 py-16 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
              <div className="bg-white w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 shadow-md">
                <i className="fas fa-clock text-4xl text-blue-400"></i>
              </div>
              <h3 className="text-xl font-semibold text-gray-700">Tidak ada data riwayat tersedia</h3>
              <p className="text-sm mt-3 text-gray-400 max-w-md mx-auto">
                Silakan implementasikan pengambilan data riwayat dari Google Apps Script server sesuai kebutuhan sistem Anda.
              </p>
              
              <button className="mt-8 bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded-lg text-sm transition shadow-sm hover:shadow active:scale-95 flex items-center mx-auto">
                <i className="fas fa-sync-alt mr-2"></i>Refresh Data
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
