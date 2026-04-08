import { useState, useEffect } from 'react';
import AppLayout from '../components/AppLayout';
import { getCurrentUser } from '../lib/api';
import { supabase } from '../lib/supabase';
import Swal from 'sweetalert2';
import withReactContent from 'sweetalert2-react-content';
import EditRiwayatModal from '../components/riwayat/EditRiwayatModal';
import RekapPengisianTable from '../components/riwayat/RekapPengisianTable';
import RekapRuanganTable from '../components/riwayat/RekapRuanganTable';
import DetailRiwayatTable from '../components/riwayat/DetailRiwayatTable';

const MySwal = withReactContent(Swal);

export default function Riwayat() {
  const user = getCurrentUser();
  const isAdmin = user?.role?.toLowerCase() === 'admin' || user?.role === 'Admin';

  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState(isAdmin ? 'rekap' : 'detail');

  // Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);

  // Default to current month YYYY-MM
  const currentMonth = new Date().toISOString().slice(0, 7);
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);

  const formatMonthYear = (yyyy_mm) => {
    if (!yyyy_mm) return '';
    const [year, month] = yyyy_mm.split('-');
    const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
    return `${months[parseInt(month, 10) - 1]} ${year}`;
  };

  const fetchRiwayat = async () => {
    setLoading(true);
    setError(null);
    try {
      const tables = [
        { name: 'ruang_bangunan', formName: 'Ruang Bangunan', formId: 'ruang_bangunan' },
        { name: 'limbah_medis', formName: 'Pengolahan Limbah', formId: 'pengolahan_limbah' },
        { name: 'pemeriksaan_toilet', formName: 'Kebersihan Toilet', formId: 'toilet' },
        { name: 'pemeriksaan_reservoir', formName: 'Kebersihan Bak Reservoir', formId: 'reservoir' },
        { name: 'pemeriksaan_gizi', formName: 'Ceklist Gizi', formId: 'gizi' }
      ];

      const promises = tables.map(async (table) => {
        let query = supabase
          .from(table.name)
          .select('id, tanggal_pemeriksaan, ruangan, total, nilai_maks, persen, petugas, waktu_input');

        if (!isAdmin) {
          query = query.eq('petugas', user?.nama);
        }

        // Optimasi: Filter berdasarkan bulan langsung di server database
        if (selectedMonth) {
          const startDate = `${selectedMonth}-01`;
          const dateObj = new Date(startDate);
          dateObj.setMonth(dateObj.getMonth() + 1);
          const endDate = dateObj.toISOString().split('T')[0];
          query = query.gte('tanggal_pemeriksaan', startDate).lt('tanggal_pemeriksaan', endDate);
        }

        const { data, error } = await query;
        if (error) throw new Error(error.message);

        return data.map(item => ({
          id: `${table.name}_${item.id}`,
          originalId: item.id,
          tanggal: item.tanggal_pemeriksaan,
          formName: table.formName,
          formId: table.formId,
          tableName: table.name,
          lokasi: item.ruangan,
          nilai: item.total,
          maksimal: item.nilai_maks,
          persentase: item.persen ? parseFloat(item.persen) : 0,
          petugas: item.petugas,
          waktu_input: item.waktu_input
        }));
      });

      const results = await Promise.all(promises);
      const allData = results.flat().sort((a, b) => {
        const dateA = new Date(a.tanggal).getTime();
        const dateB = new Date(b.tanggal).getTime();
        if (dateB !== dateA) return dateB - dateA;

        const timeA = new Date(a.waktu_input || 0).getTime();
        const timeB = new Date(b.waktu_input || 0).getTime();
        return timeB - timeA;
      });

      setData(allData);
    } catch (err) {
      console.error(err);
      setError('Gagal memuat data dari server Supabase. ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRiwayat();
  }, [selectedMonth]);

  const handleEditClick = (item) => {
    setEditingItem(item);
    setIsEditModalOpen(true);
  };

  const handleDelete = async (item) => {
    const confirm = await MySwal.fire({
      title: 'Hapus Data Riwayat?',
      text: `Data riwayat ${item.formName} akan dihapus secara permanen.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Ya, Hapus!'
    });

    if (!confirm.isConfirmed) return;

    try {
      MySwal.fire({
        title: 'Menghapus...',
        allowOutsideClick: false,
        didOpen: () => {
          MySwal.showLoading();
        }
      });

      const { error } = await supabase
        .from(item.tableName)
        .delete()
        .eq('id', item.originalId);

      if (error) throw new Error(error.message);

      MySwal.fire('Terhapus!', 'Data riwayat berhasil dihapus.', 'success');
      setData(prev => prev.filter(d => d.id !== item.id));

    } catch (error) {
      console.error(error);
      MySwal.fire('Error', 'Gagal menghapus data. ' + error.message, 'error');
    }
  };

  const filteredData = data.filter(item => {
    if (!selectedMonth) return true;
    return item.tanggal && item.tanggal.startsWith(selectedMonth);
  });

  return (
    <AppLayout title="Riwayat Aktivitas">
      <div className="container mx-auto px-2 sm:px-4 py-6 md:py-8 print:py-0 print:px-0 print:w-full print:max-w-none">
        <div className="bg-white rounded-2xl shadow-xl p-4 md:p-8 border border-gray-100 print:shadow-none print:border-none print:p-0">

          {/* Print Kop Surat */}
          <div className="hidden print:flex w-full pb-3 mb-2 relative pt-2 items-center justify-between">
            <div className="w-24 pl-4 shrink-0">
              <img src={`${import.meta.env.BASE_URL}img/logo_provinsi.png`} alt="Logo NTT" className="w-full h-auto object-contain" />
            </div>
            <div className="flex-1 text-center font-serif text-black leading-snug pr-24">
              <h2 className="text-lg font-bold uppercase tracking-wide">Pemerintah Provinsi Nusa Tenggara Timur</h2>
              <h2 className="text-lg font-bold uppercase tracking-wide">Rumah Sakit Umum Daerah</h2>
              <h1 className="text-xl font-black uppercase my-1 tracking-wider">Prof Dr. W.Z. Johannes Kupang</h1>
              <p className="text-sm font-semibold">Jln. DR. Moch. Hatta No. 19 &nbsp;&nbsp;&nbsp; Telp / Fax (0380) 832892</p>
              <p className="text-sm italic">Website: www.rsudwzjohannes.nttprof.go.id &nbsp;&nbsp;&nbsp; email: rsudjohannes@gmail.com</p>
              <p className="text-sm font-bold mt-1">K U P A N G <span className="ml-8 font-normal">Kode Pos 85111</span></p>
            </div>
          </div>
          <div className="hidden print:block border-b-4 border-black w-full mt-1"></div>
          <div className="hidden print:block border-b border-black w-full mt-1 mb-6"></div>

          <div className="hidden print:block text-center font-bold text-lg mb-6 mt-4 uppercase">
            LAPORAN INSPEKSI SANITASI - {activeTab === 'rekap' ? 'REKAPITULASI PENGISIAN' : activeTab === 'rekap-ruangan' ? 'REKAPITULASI PER RUANGAN' : 'DETAIL RIWAYAT'}
            {selectedMonth && <div className="text-sm font-normal mt-1">Periode Bulan: {formatMonthYear(selectedMonth)}</div>}
          </div>

          <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8 border-b border-gray-100 pb-6 print:hidden">
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
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-gray-200 mb-6 print:hidden gap-4">
              <div className="flex overflow-x-auto pb-1 sm:pb-0 scrollbar-hide -mb-px">
                <button
                  onClick={() => setActiveTab('rekap')}
                  className={`py-3 px-4 sm:px-6 font-bold text-xs sm:text-sm focus:outline-none flex items-center transition-colors whitespace-nowrap ${activeTab === 'rekap' ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-gray-500 hover:text-gray-800'}`}
                >
                  <i className="fas fa-chart-bar mr-2"></i>Rekapitulasi Pengisian
                </button>
                <button
                  onClick={() => setActiveTab('detail')}
                  className={`py-3 px-4 sm:px-6 font-bold text-xs sm:text-sm focus:outline-none flex items-center transition-colors whitespace-nowrap ${activeTab === 'detail' ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-gray-500 hover:text-gray-800'}`}
                >
                  <i className="fas fa-list mr-2"></i>Detail Riwayat
                </button>
                <button
                  onClick={() => setActiveTab('rekap-ruangan')}
                  className={`py-3 px-4 sm:px-6 font-bold text-xs sm:text-sm focus:outline-none flex items-center transition-colors whitespace-nowrap ${activeTab === 'rekap-ruangan' ? 'border-b-2 border-teal-600 text-teal-600' : 'text-gray-500 hover:text-gray-800'}`}
                >
                  <i className="fas fa-door-open mr-2"></i>Rekap Ruangan
                </button>
              </div>
              <button
                onClick={() => window.print()}
                className="bg-green-600 hover:bg-green-700 text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow-md flex items-center transition-colors active:scale-95 w-full sm:w-auto justify-center"
              >
                <i className="fas fa-print mr-2"></i> Cetak Laporan
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
                  {selectedMonth ? `Tidak ada pengisian form yang ditemukan pada bulan ${formatMonthYear(selectedMonth)}.` : 'Belum ada data tersedia.'}
                </p>
                <button
                  onClick={fetchRiwayat}
                  className="mt-8 bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-xl text-sm font-bold transition-all shadow-lg hover:shadow-xl active:scale-95 flex items-center mx-auto"
                >
                  <i className="fas fa-sync-alt mr-2"></i>Segarkan Data
                </button>
              </div>
            ) : isAdmin && activeTab === 'rekap' ? (
              <RekapPengisianTable data={filteredData} />
            ) : isAdmin && activeTab === 'rekap-ruangan' ? (
              <RekapRuanganTable data={filteredData} />
            ) : (
              <DetailRiwayatTable
                data={filteredData}
                isAdmin={isAdmin}
                onEdit={handleEditClick}
                onDelete={handleDelete}
              />
            )}
          </div>
        </div>
      </div>

      {/* Edit Form Modal Component */}
      <EditRiwayatModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        item={editingItem}
        onSuccess={fetchRiwayat}
      />
    </AppLayout>
  );
}
