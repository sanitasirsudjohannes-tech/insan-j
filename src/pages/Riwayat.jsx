import { useState, useEffect } from 'react';
import AppLayout from '../components/AppLayout';
import { API_URL, getCurrentUser } from '../lib/api';

export default function Riwayat() {
  const user = getCurrentUser();
  const isAdmin = user?.role?.toLowerCase() === 'admin' || user?.role === 'Admin';

  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState(isAdmin ? 'rekap' : 'detail');

  // Default to current month YYYY-MM
  const currentMonth = new Date().toISOString().slice(0, 7);
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);

  const fetchRiwayat = async () => {
    setLoading(true);
    setError(null);
    try {
      const fetchUserId = isAdmin ? '' : (user?.id || '');
      const response = await fetch(`${API_URL}?action=getRiwayat&userId=${fetchUserId}`);
      if (!response.ok) throw new Error('Respon jaringan tidak baik');
      const result = await response.json();

      // Filter based on userId and/or petugas to satisfy "masing2 user hanya melihat hasil masing2" (kalau bukan admin)
      const userOnly = Array.isArray(result)
        ? (isAdmin ? result : result.filter(item => item.userId == user?.id || item.petugas === user?.nama))
        : [];

      setData(userOnly);
    } catch (err) {
      console.error(err);
      // Fallback dummy data if mapping isn't implemented in the backend yet
      const dummy = [
        { id: 1, tanggal: '2026-04-01', formName: 'Ruang Bangunan', lokasi: 'Poli Jantung', nilai: 100, maksimal: 120, persentase: 83, petugas: user?.nama || 'Petugas 1', userId: user?.id },
        { id: 2, tanggal: '2026-04-05', formName: 'Kebersihan Toilet', lokasi: 'IGD Lama', nilai: 140, maksimal: 140, persentase: 100, petugas: user?.nama || 'Petugas 1', userId: user?.id },
        { id: 3, tanggal: '2026-03-15', formName: 'Pengolahan Limbah', lokasi: 'Radiologi', nilai: 90, maksimal: 130, persentase: 69, petugas: user?.nama || 'Petugas 1', userId: user?.id },
        { id: 4, tanggal: '2026-04-10', formName: 'Kebersihan Bak Reservoir', lokasi: 'Reservoir Atas', nilai: 80, maksimal: 90, persentase: 88, petugas: user?.nama || 'Petugas 1', userId: user?.id },
      ];
      if (isAdmin) {
        dummy.push(
          { id: 5, tanggal: '2026-04-02', formName: 'Ruang Bangunan', lokasi: 'Gizi', nilai: 110, maksimal: 120, persentase: 91, petugas: 'Budi (User Lain)', userId: 'user2' },
          { id: 6, tanggal: '2026-04-03', formName: 'Ceklist Gizi', lokasi: 'Dapur', nilai: 90, maksimal: 120, persentase: 75, petugas: 'Budi (User Lain)', userId: 'user2' },
          { id: 7, tanggal: '2026-04-12', formName: 'Kebersihan Toilet', lokasi: 'Kamar Mandi 1', nilai: 120, maksimal: 140, persentase: 85, petugas: 'Budi (User Lain)', userId: 'user2' }
        );
      }
      setData(dummy);
      setError('Gagal memuat data asli dari server. Menampilkan data contoh (dummy) untuk preview.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRiwayat();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Filter based on month (YYYY-MM)
  const filteredData = data.filter(item => {
    if (!selectedMonth) return true;
    return item.tanggal && item.tanggal.startsWith(selectedMonth);
  });

  // Calculate aggregation for Admin
  const rekapUser = {};
  if (isAdmin) {
    filteredData.forEach(item => {
      const petugas = item.petugas || 'Tanpa Nama';
      if (!rekapUser[petugas]) {
        rekapUser[petugas] = {
          nama: petugas,
          'Ruang Bangunan': 0,
          'Pengolahan Limbah': 0,
          'Kebersihan Toilet': 0,
          'Kebersihan Bak Reservoir': 0,
          'Ceklist Gizi': 0
        };
      }
      if (item.formName === 'Ruang Bangunan') rekapUser[petugas]['Ruang Bangunan']++;
      else if (item.formName === 'Pengolahan Limbah') rekapUser[petugas]['Pengolahan Limbah']++;
      else if (item.formName === 'Kebersihan Toilet') rekapUser[petugas]['Kebersihan Toilet']++;
      else if (item.formName === 'Kebersihan Bak Reservoir') rekapUser[petugas]['Kebersihan Bak Reservoir']++;
      else if (item.formName === 'Ceklist Gizi') rekapUser[petugas]['Ceklist Gizi']++;
    });
  }
  const rekapArray = Object.values(rekapUser);

  return (
    <AppLayout title="Riwayat Aktivitas">
      <div className="container mx-auto px-4 py-8">
        <div className="bg-white rounded-2xl shadow-xl p-6 md:p-8 border border-gray-100">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8 border-b border-gray-100 pb-6">
            <div>
              <h2 className="text-3xl font-extrabold text-gray-800 tracking-tight">Riwayat Inspeksi</h2>
              <p className="text-sm text-gray-500 mt-2 font-medium">Filter dan pantau nilai form yang telah diisi.</p>
            </div>

            <div className="mt-4 md:mt-0 flex flex-col sm:flex-row gap-4 items-center">
              <div className="relative w-full sm:w-auto">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <i className="fas fa-calendar-alt text-gray-400"></i>
                </div>
                <input
                  type="month"
                  className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-shadow text-gray-700 font-semibold shadow-sm"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                />
              </div>
              <div className={`w-full sm:w-auto flex items-center justify-center px-5 py-2.5 rounded-xl font-bold shadow-sm border ${isAdmin ? 'bg-linear-to-r from-purple-50 to-indigo-50 text-indigo-700 border-indigo-100' : 'bg-linear-to-r from-blue-50 to-indigo-50 text-blue-700 border-blue-100'}`}>
                <i className={`${isAdmin ? 'fas fa-user-shield' : 'fas fa-user-circle'} mr-2 text-lg`}></i>
                <span className="truncate max-w-[150px]">{user?.nama || 'Petugas'} ({isAdmin ? 'Admin' : 'User'})</span>
              </div>
            </div>
          </div>

          {isAdmin && (
            <div className="flex border-b border-gray-200 mb-6">
              <button
                onClick={() => setActiveTab('rekap')}
                className={`py-3 px-6 font-bold text-sm focus:outline-none flex items-center transition-colors ${activeTab === 'rekap' ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-gray-500 hover:text-gray-800'}`}
              >
                <i className="fas fa-chart-bar mr-2"></i>Rekapitulasi Pengisian
              </button>
              <button
                onClick={() => setActiveTab('detail')}
                className={`py-3 px-6 font-bold text-sm focus:outline-none flex items-center transition-colors ${activeTab === 'detail' ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-gray-500 hover:text-gray-800'}`}
              >
                <i className="fas fa-list mr-2"></i>Detail Riwayat
              </button>
            </div>
          )}

          {error && (
            <div className="mb-6 bg-orange-50 border-l-4 border-orange-400 p-4 rounded-r-xl shadow-sm animate-fade-in">
              <div className="flex items-center">
                <i className="fas fa-info-circle text-orange-500 mr-3 text-lg"></i>
                <p className="text-sm text-orange-800 font-medium">{error}</p>
              </div>
            </div>
          )}

          <div id="contentArea" className="mt-6">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
                <i className="fas fa-circle-notch fa-spin text-5xl text-blue-500 mb-4"></i>
                <p className="text-gray-500 font-bold tracking-wide">MENGAMBIL DATA...</p>
              </div>
            ) : filteredData.length === 0 ? (
              <div className="text-center text-gray-500 py-16 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200 transition-all hover:bg-gray-100">
                <div className="bg-white w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6 shadow-md border border-gray-100 transform transition-transform hover:scale-110">
                  <i className="fas fa-folder-open text-4xl text-blue-400"></i>
                </div>
                <h3 className="text-2xl font-bold text-gray-700">Tidak ada riwayat</h3>
                <p className="text-sm mt-3 text-gray-500 max-w-md mx-auto font-medium">
                  {selectedMonth ? `Tidak ada pengisian form yang ditemukan pada bulan ${selectedMonth}.` : 'Belum ada data tersedia.'}
                </p>
                <button
                  onClick={fetchRiwayat}
                  className="mt-8 bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-xl text-sm font-bold transition-all shadow-lg hover:shadow-xl active:scale-95 flex items-center mx-auto"
                >
                  <i className="fas fa-sync-alt mr-2"></i>Segarkan Data
                </button>
              </div>
            ) : isAdmin && activeTab === 'rekap' ? (
              <div className="overflow-x-auto rounded-2xl shadow-sm border border-gray-200">
                <table className="min-w-full divide-y divide-gray-200 bg-white">
                  <thead className="bg-gray-50">
                    <tr>
                      <th scope="col" className="px-6 py-4 text-left text-xs font-extrabold text-gray-500 uppercase tracking-wider">Nama User</th>
                      <th scope="col" className="px-6 py-4 text-center text-xs font-extrabold text-blue-600 uppercase tracking-wider">Ruang Bangunan</th>
                      <th scope="col" className="px-6 py-4 text-center text-xs font-extrabold text-green-600 uppercase tracking-wider">Pengolahan Limbah</th>
                      <th scope="col" className="px-6 py-4 text-center text-xs font-extrabold text-purple-600 uppercase tracking-wider">Toilet</th>
                      <th scope="col" className="px-6 py-4 text-center text-xs font-extrabold text-yellow-600 uppercase tracking-wider">Reservoir</th>
                      <th scope="col" className="px-6 py-4 text-center text-xs font-extrabold text-gray-600 uppercase tracking-wider">Gizi</th>
                      <th scope="col" className="px-6 py-4 text-center text-xs font-extrabold text-indigo-800 uppercase tracking-wider">Total Form</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {rekapArray.map((rekap, idx) => {
                      const totalSubmit = rekap['Ruang Bangunan'] + rekap['Pengolahan Limbah'] + rekap['Kebersihan Toilet'] + rekap['Kebersihan Bak Reservoir'] + rekap['Ceklist Gizi'];
                      return (
                        <tr key={idx} className="hover:bg-indigo-50/30 transition-colors duration-200 group">
                          <td className="px-6 py-5 whitespace-nowrap">
                            <div className="flex items-center">
                              <div className="bg-linear-to-br from-indigo-100 to-purple-100 text-indigo-700 w-9 h-9 rounded-full flex items-center justify-center mr-3 font-extrabold text-lg shadow-sm border border-indigo-200">
                                {rekap.nama.charAt(0).toUpperCase()}
                              </div>
                              <span className="text-sm font-bold text-gray-800">{rekap.nama}</span>
                            </div>
                          </td>
                          <td className="px-6 py-5 whitespace-nowrap text-center text-sm font-bold text-gray-700">{rekap['Ruang Bangunan']}</td>
                          <td className="px-6 py-5 whitespace-nowrap text-center text-sm font-bold text-gray-700">{rekap['Pengolahan Limbah']}</td>
                          <td className="px-6 py-5 whitespace-nowrap text-center text-sm font-bold text-gray-700">{rekap['Kebersihan Toilet']}</td>
                          <td className="px-6 py-5 whitespace-nowrap text-center text-sm font-bold text-gray-700">{rekap['Kebersihan Bak Reservoir']}</td>
                          <td className="px-6 py-5 whitespace-nowrap text-center text-sm font-bold text-gray-700">{rekap['Ceklist Gizi']}</td>
                          <td className="px-6 py-5 whitespace-nowrap text-center">
                            <span className="text-sm font-extrabold text-indigo-700 bg-indigo-50 px-3 py-1 rounded-lg border border-indigo-100 inline-block shadow-sm">
                              {totalSubmit}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-2xl shadow-sm border border-gray-200">
                <table className="min-w-full divide-y divide-gray-200 bg-white">
                  <thead className="bg-gray-50">
                    <tr>
                      {isAdmin && <th scope="col" className="px-6 py-4 text-left text-xs font-extrabold text-gray-500 uppercase tracking-wider">Petugas</th>}
                      <th scope="col" className="px-6 py-4 text-left text-xs font-extrabold text-gray-500 uppercase tracking-wider">Tanggal</th>
                      <th scope="col" className="px-6 py-4 text-left text-xs font-extrabold text-gray-500 uppercase tracking-wider">Lokasi</th>
                      <th scope="col" className="px-6 py-4 text-left text-xs font-extrabold text-gray-500 uppercase tracking-wider">Formulir</th>
                      <th scope="col" className="px-6 py-4 text-left text-xs font-extrabold text-gray-500 uppercase tracking-wider">Total Nilai</th>
                      <th scope="col" className="px-6 py-4 text-left text-xs font-extrabold text-gray-500 uppercase tracking-wider">Rata-rata/Persentase</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredData.map((item, idx) => (
                      <tr key={item.id || idx} className="hover:bg-blue-50/50 transition-colors duration-200 group">
                        {isAdmin && (
                          <td className="px-6 py-5 whitespace-nowrap">
                            <div className="text-sm font-bold text-indigo-700 flex items-center">
                              <i className="fas fa-user-circle mr-2 opacity-50"></i>
                              {item.petugas || '-'}
                            </div>
                          </td>
                        )}
                        <td className="px-6 py-5 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="bg-blue-100 text-blue-600 w-8 h-8 rounded-full flex items-center justify-center mr-3 group-hover:bg-blue-600 group-hover:text-white transition-colors shadow-sm">
                              <i className="far fa-calendar-alt text-sm"></i>
                            </div>
                            <span className="text-sm font-bold text-gray-800">
                              {new Date(item.tanggal).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-5 whitespace-nowrap">
                          <div className="text-sm text-gray-700 font-bold flex items-center">
                            <i className="fas fa-map-marker-alt text-gray-400 mr-2 text-xs"></i>
                            {item.lokasi}
                          </div>
                        </td>
                        <td className="px-6 py-5 whitespace-nowrap">
                          <span className="px-3 py-1.5 inline-flex text-xs leading-5 font-bold rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-100 shadow-sm">
                            <i className="fas fa-clipboard-check mr-1.5 mt-0.5"></i>
                            {item.formName}
                          </span>
                        </td>
                        <td className="px-6 py-5 whitespace-nowrap">
                          <div className="text-sm text-gray-900 font-extrabold bg-gray-50 px-3 py-1 rounded-lg inline-block border border-gray-200">
                            {item.nilai} <span className="text-gray-400 font-medium">/ {item.maksimal}</span>
                          </div>
                        </td>
                        <td className="px-6 py-5 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="w-full bg-gray-200 rounded-full h-2.5 mr-3 max-w-20 overflow-hidden shadow-inner">
                              <div
                                className={`h-full rounded-full transition-all duration-1000 ease-out ${item.persentase >= 80 ? 'bg-linear-to-r from-green-400 to-green-500' :
                                  item.persentase >= 60 ? 'bg-linear-to-r from-yellow-400 to-yellow-500' :
                                    'bg-linear-to-r from-red-400 to-red-500'
                                  }`}
                                style={{ width: `${item.persentase}%` }}
                              ></div>
                            </div>
                            <span className={`text-sm font-black ${item.persentase >= 80 ? 'text-green-600' :
                              item.persentase >= 60 ? 'text-yellow-600' :
                                'text-red-600'
                              }`}>
                              {item.persentase}%
                            </span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
