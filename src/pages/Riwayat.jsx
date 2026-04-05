import { useState, useEffect } from 'react';
import AppLayout from '../components/AppLayout';
import { getCurrentUser } from '../lib/api';
import { supabase } from '../lib/supabase';
import Swal from 'sweetalert2';
import withReactContent from 'sweetalert2-react-content';
import { CHECKLIST_ITEMS, AVAILABLE_FORMS } from '../lib/constants';

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
  const [editFormData, setEditFormData] = useState({});
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);

  // Default to current month YYYY-MM
  const currentMonth = new Date().toISOString().slice(0, 7);
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // Reset to first page when filtering or page size changes
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedMonth, rowsPerPage, data.length]);


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
      setError('Gagal memuat data asli dari server Supabase. ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRiwayat();
  }, [selectedMonth]); // Trigger fetch ulang otomatis saat user mengganti bulan

  // Edit Action
  const handleEditClick = async (item) => {
    try {
      MySwal.fire({
        title: 'Memuat Data...',
        allowOutsideClick: false,
        didOpen: () => {
          MySwal.showLoading();
        }
      });

      // Lazy Loading: Ambil data lengkap baris ini hanya saat tombol Edit ditekan
      const fields = CHECKLIST_ITEMS[item.formId] || [];
      const columns = ['id', ...fields.map(f => f.dbCol)].join(', ');

      const { data, error } = await supabase
        .from(item.tableName)
        .select(columns)
        .eq('id', item.originalId)
        .single();

      if (error) throw new Error(error.message);

      setEditingItem(item);

      // Memuat data mentah ke dalam state form
      const items = CHECKLIST_ITEMS[item.formId] || [];
      const formData = {};
      items.forEach(field => {
        // Nilai fallback jika kosong adalah 0
        formData[field.id] = data[field.dbCol] || 0;
      });

      setEditFormData(formData);
      MySwal.close();
      setIsEditModalOpen(true);

    } catch (err) {
      console.error(err);
      MySwal.fire('Error', 'Gagal memuat detail data. ' + err.message, 'error');
    }
  };

  const handleEditInputChange = (fieldId, value) => {
    let numStr = value.replace(/[^0-9]/g, '');
    let num = parseInt(numStr || '0', 10);
    if (num > 10) num = 10;
    if (num < 0) num = 0;

    setEditFormData(prev => ({
      ...prev,
      [fieldId]: num
    }));
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();

    const confirm = await MySwal.fire({
      title: 'Simpan Perubahan?',
      text: "Data nilai lama akan ditimpa dengan yang baru.",
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#d33',
      confirmButtonText: 'Ya, Simpan!'
    });

    if (!confirm.isConfirmed) return;

    setIsSubmittingEdit(true);

    try {
      const items = CHECKLIST_ITEMS[editingItem.formId] || [];

      let totalNilai = 0;
      let maksimalNilai = items.length * 10;
      let updateData = {};

      items.forEach(field => {
        const val = editFormData[field.id] || 0;
        totalNilai += val;
        updateData[field.dbCol] = val; // Set ke kolom DB yang benar
      });

      const persentase = maksimalNilai > 0 ? Math.round((totalNilai / maksimalNilai) * 100) : 0;

      // Update nilai agregat
      updateData.total = totalNilai;
      updateData.persen = persentase;

      const { error } = await supabase
        .from(editingItem.tableName)
        .update(updateData)
        .eq('id', editingItem.originalId);

      if (error) throw new Error(error.message);

      MySwal.fire('Berhasil', 'Data berhasil diperbarui!', 'success');
      setIsEditModalOpen(false);
      fetchRiwayat(); // Refresh data

    } catch (error) {
      console.error(error);
      MySwal.fire('Error', 'Gagal menyimpan perubahan. ' + error.message, 'error');
    } finally {
      setIsSubmittingEdit(false);
    }
  };

  // Delete Action
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

      // Update local state by filtering out deleted item
      setData(prev => prev.filter(d => d.id !== item.id));

    } catch (error) {
      console.error(error);
      MySwal.fire('Error', 'Gagal menghapus data. ' + error.message, 'error');
    }
  };

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

  // Calculate aggregation for Rekap Ruangan (per petugas + per ruangan)
  const rekapRuanganMap = {};
  if (isAdmin) {
    filteredData.forEach(item => {
      const petugas = item.petugas || 'Tanpa Nama';
      const ruangan = item.lokasi || 'Tanpa Ruangan';
      const key = `${petugas}__${ruangan}`;
      if (!rekapRuanganMap[key]) {
        rekapRuanganMap[key] = {
          petugas,
          ruangan,
          'Ruang Bangunan': null,
          'Pengolahan Limbah': null,
          'Kebersihan Toilet': null,
          'Kebersihan Bak Reservoir': null,
          'Ceklist Gizi': null,
        };
      }
      const formKey = item.formName;
      if (rekapRuanganMap[key][formKey] === null) {
        rekapRuanganMap[key][formKey] = { total: 0, count: 0 };
      }
      if (rekapRuanganMap[key][formKey] !== null) {
        rekapRuanganMap[key][formKey].total += item.persentase;
        rekapRuanganMap[key][formKey].count += 1;
      }
    });
  }
  const rekapRuanganArray = Object.values(rekapRuanganMap).sort((a, b) =>
    a.petugas.localeCompare(b.petugas) || a.ruangan.localeCompare(b.ruangan)
  );

  // Pagination for Detail Riwayat
  const totalItems = filteredData.length;
  const totalPages = Math.ceil(totalItems / rowsPerPage);
  const startIndex = (currentPage - 1) * rowsPerPage;
  const paginatedData = filteredData.slice(startIndex, startIndex + rowsPerPage);


  return (
    <AppLayout title="Riwayat Aktivitas">
      <div className="container mx-auto px-4 py-8 print:py-0 print:px-0 print:w-full print:max-w-none">
        <div className="bg-white rounded-2xl shadow-xl p-6 md:p-8 border border-gray-100 print:shadow-none print:border-none print:p-0">

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
            {selectedMonth && <div className="text-sm font-normal mt-1">Periode Bulan: {selectedMonth}</div>}
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
            <div className="flex justify-between items-center border-b border-gray-200 mb-6 print:hidden">
              <div className="flex">
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
                <button
                  onClick={() => setActiveTab('rekap-ruangan')}
                  className={`py-3 px-6 font-bold text-sm focus:outline-none flex items-center transition-colors ${activeTab === 'rekap-ruangan' ? 'border-b-2 border-teal-600 text-teal-600' : 'text-gray-500 hover:text-gray-800'}`}
                >
                  <i className="fas fa-door-open mr-2"></i>Rekap Ruangan
                </button>
              </div>
              <button
                onClick={() => window.print()}
                className="bg-green-600 hover:bg-green-700 text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow-md flex items-center transition-colors active:scale-95"
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
                <table className="min-w-full divide-y divide-gray-200 bg-white print:border-collapse print:border print:border-black">
                  <thead className="bg-gray-50 print:bg-transparent">
                    <tr>
                      <th scope="col" className="px-6 py-4 print:py-2 print:px-3 print:border print:border-black text-left text-xs font-extrabold text-gray-500 print:text-black uppercase tracking-wider">Nama Petugas</th>
                      <th scope="col" className="px-6 py-4 print:py-2 print:px-3 print:border print:border-black text-center text-xs font-extrabold text-blue-600 print:text-black uppercase tracking-wider">Ruang Bangunan</th>
                      <th scope="col" className="px-6 py-4 print:py-2 print:px-3 print:border print:border-black text-center text-xs font-extrabold text-green-600 print:text-black uppercase tracking-wider">Pengolahan Limbah</th>
                      <th scope="col" className="px-6 py-4 print:py-2 print:px-3 print:border print:border-black text-center text-xs font-extrabold text-purple-600 print:text-black uppercase tracking-wider">Toilet</th>
                      <th scope="col" className="px-6 py-4 print:py-2 print:px-3 print:border print:border-black text-center text-xs font-extrabold text-yellow-600 print:text-black uppercase tracking-wider">Reservoir</th>
                      <th scope="col" className="px-6 py-4 print:py-2 print:px-3 print:border print:border-black text-center text-xs font-extrabold text-gray-600 print:text-black uppercase tracking-wider">Gizi</th>
                      <th scope="col" className="px-6 py-4 print:py-2 print:px-3 print:border print:border-black text-center text-xs font-extrabold text-indigo-800 print:text-black uppercase tracking-wider">Total Form</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 print:divide-none">
                    {rekapArray.map((rekap, idx) => {
                      const totalSubmit = rekap['Ruang Bangunan'] + rekap['Pengolahan Limbah'] + rekap['Kebersihan Toilet'] + rekap['Kebersihan Bak Reservoir'] + rekap['Ceklist Gizi'];
                      return (
                        <tr key={idx} className="hover:bg-indigo-50/30 transition-colors duration-200 group print:border print:border-black">
                          <td className="px-6 py-5 print:py-2 print:px-3 print:border print:border-black whitespace-nowrap">
                            <div className="flex items-center">
                              <div className="bg-linear-to-br from-indigo-100 to-purple-100 text-indigo-700 w-9 h-9 rounded-full flex items-center justify-center mr-3 font-extrabold text-lg shadow-sm border border-indigo-200 print:hidden">
                                {rekap.nama.charAt(0).toUpperCase()}
                              </div>
                              <span className="text-sm font-bold text-gray-800 print:text-black">{rekap.nama}</span>
                            </div>
                          </td>
                          <td className="px-6 py-5 print:py-2 print:px-3 print:border print:border-black whitespace-nowrap text-center text-sm font-bold text-gray-700 print:text-black">{rekap['Ruang Bangunan']}</td>
                          <td className="px-6 py-5 print:py-2 print:px-3 print:border print:border-black whitespace-nowrap text-center text-sm font-bold text-gray-700 print:text-black">{rekap['Pengolahan Limbah']}</td>
                          <td className="px-6 py-5 print:py-2 print:px-3 print:border print:border-black whitespace-nowrap text-center text-sm font-bold text-gray-700 print:text-black">{rekap['Kebersihan Toilet']}</td>
                          <td className="px-6 py-5 print:py-2 print:px-3 print:border print:border-black whitespace-nowrap text-center text-sm font-bold text-gray-700 print:text-black">{rekap['Kebersihan Bak Reservoir']}</td>
                          <td className="px-6 py-5 print:py-2 print:px-3 print:border print:border-black whitespace-nowrap text-center text-sm font-bold text-gray-700 print:text-black">{rekap['Ceklist Gizi']}</td>
                          <td className="px-6 py-5 print:py-2 print:px-3 print:border print:border-black whitespace-nowrap text-center">
                            <span className="text-sm font-extrabold text-indigo-700 print:text-black bg-indigo-50 print:bg-transparent px-3 py-1 print:p-0 rounded-lg border border-indigo-100 print:border-none inline-block shadow-sm print:shadow-none">
                              {totalSubmit}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            ) : isAdmin && activeTab === 'rekap-ruangan' ? (
              <div className="overflow-x-auto rounded-2xl shadow-sm border border-gray-200">
                <table className="min-w-full divide-y divide-gray-200 bg-white print:border-collapse print:border print:border-black">
                  <thead className="bg-teal-50 print:bg-transparent">
                    <tr>
                      <th scope="col" className="px-6 py-4 print:py-2 print:px-3 print:border print:border-black text-left text-xs font-extrabold text-gray-600 print:text-black uppercase tracking-wider">Nama Petugas</th>
                      <th scope="col" className="px-6 py-4 print:py-2 print:px-3 print:border print:border-black text-left text-xs font-extrabold text-teal-700 print:text-black uppercase tracking-wider">Ruangan</th>
                      <th scope="col" className="px-6 py-4 print:py-2 print:px-3 print:border print:border-black text-center text-xs font-extrabold text-blue-600 print:text-black uppercase tracking-wider">Ruang Bangunan</th>
                      <th scope="col" className="px-6 py-4 print:py-2 print:px-3 print:border print:border-black text-center text-xs font-extrabold text-green-600 print:text-black uppercase tracking-wider">Pengolahan Limbah</th>
                      <th scope="col" className="px-6 py-4 print:py-2 print:px-3 print:border print:border-black text-center text-xs font-extrabold text-purple-600 print:text-black uppercase tracking-wider">Toilet</th>
                      <th scope="col" className="px-6 py-4 print:py-2 print:px-3 print:border print:border-black text-center text-xs font-extrabold text-yellow-600 print:text-black uppercase tracking-wider">Reservoir</th>
                      <th scope="col" className="px-6 py-4 print:py-2 print:px-3 print:border print:border-black text-center text-xs font-extrabold text-orange-600 print:text-black uppercase tracking-wider">Gizi</th>
                    </tr>
                  </thead>
                  <tbody className="print:divide-none">
                    {(() => {
                      const formKeys = [
                        { key: 'Ruang Bangunan' },
                        { key: 'Pengolahan Limbah' },
                        { key: 'Kebersihan Toilet' },
                        { key: 'Kebersihan Bak Reservoir' },
                        { key: 'Ceklist Gizi' },
                      ];
                      const getPct = (row, k) => {
                        const d = row[k];
                        if (!d || d.count === 0) return null;
                        return Math.round(d.total / d.count);
                      };
                      const pctCell = (row, k, isLastRow) => {
                        const pct = getPct(row, k);
                        const border = isLastRow ? 'border-b-2 border-gray-300' : '';
                        if (pct === null) return (
                          <td key={k} className={`px-6 py-4 print:py-2 print:px-3 print:border print:border-black whitespace-nowrap text-center text-xs text-gray-300 print:text-black ${border}`}>—</td>
                        );
                        const bg = pct >= 80 ? 'bg-green-100 text-green-700' : pct >= 60 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700';
                        return (
                          <td key={k} className={`px-6 py-4 print:py-2 print:px-3 print:border print:border-black whitespace-nowrap text-center ${border}`}>
                            <span className={`inline-block px-2.5 py-1 rounded-lg text-xs font-black print:bg-transparent print:text-black ${bg}`}>{pct}%</span>
                          </td>
                        );
                      };

                      // Group rows by petugas
                      const groups = [];
                      rekapRuanganArray.forEach(row => {
                        const last = groups[groups.length - 1];
                        if (last && last.petugas === row.petugas) {
                          last.rows.push(row);
                        } else {
                          groups.push({ petugas: row.petugas, rows: [row] });
                        }
                      });

                      return groups.flatMap(group =>
                        group.rows.map((row, rowIdx) => {
                          const isFirst = rowIdx === 0;
                          const isLast = rowIdx === group.rows.length - 1;
                          const rowCount = group.rows.length;
                          return (
                            <tr key={`${group.petugas}-${rowIdx}`} className={`hover:bg-teal-50/40 transition-colors duration-200 print:border print:border-black ${isLast ? 'border-b-2 border-gray-300' : 'border-b border-gray-100'}`}>
                              {isFirst && (
                                <td rowSpan={rowCount} className="px-6 py-4 print:py-2 print:px-3 print:border print:border-black whitespace-nowrap align-middle border-b-2 border-gray-300">
                                  <div className="flex items-center">
                                    <div className="bg-linear-to-br from-teal-100 to-cyan-100 text-teal-700 w-8 h-8 rounded-full flex items-center justify-center mr-3 font-extrabold text-sm shadow-sm border border-teal-200 print:hidden shrink-0">
                                      {row.petugas.charAt(0).toUpperCase()}
                                    </div>
                                    <span className="text-sm font-bold text-gray-800 print:text-black">{row.petugas}</span>
                                  </div>
                                </td>
                              )}
                              <td className={`px-6 py-4 print:py-2 print:px-3 print:border print:border-black whitespace-nowrap ${isLast ? 'border-b-2 border-gray-300' : ''}`}>
                                <span className="text-sm font-semibold text-teal-700 print:text-black">{row.ruangan}</span>
                              </td>
                              {formKeys.map(({ key }) => pctCell(row, key, isLast))}
                            </tr>
                          );
                        })
                      );
                    })()}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-2xl shadow-sm border border-gray-200">
                <table className="min-w-full divide-y divide-gray-200 bg-white print:border-collapse print:border print:border-black">
                  <thead className="bg-gray-50 print:bg-transparent">
                    <tr>
                      {isAdmin && <th scope="col" className="px-6 py-4 print:py-2 print:px-3 print:border print:border-black text-left text-xs font-extrabold text-gray-500 print:text-black uppercase tracking-wider">Petugas</th>}
                      <th scope="col" className="px-6 py-4 print:py-2 print:px-3 print:border print:border-black text-left text-xs font-extrabold text-gray-500 print:text-black uppercase tracking-wider">Tanggal</th>
                      <th scope="col" className="px-6 py-4 print:py-2 print:px-3 print:border print:border-black text-left text-xs font-extrabold text-gray-500 print:text-black uppercase tracking-wider">Lokasi</th>
                      <th scope="col" className="px-6 py-4 print:py-2 print:px-3 print:border print:border-black text-left text-xs font-extrabold text-gray-500 print:text-black uppercase tracking-wider">Formulir</th>
                      <th scope="col" className="px-6 py-4 print:py-2 print:px-3 print:border print:border-black text-left text-xs font-extrabold text-gray-500 print:text-black uppercase tracking-wider">Total Nilai</th>
                      <th scope="col" className="px-6 py-4 print:py-2 print:px-3 print:border print:border-black text-left text-xs font-extrabold text-gray-500 print:text-black uppercase tracking-wider">Persentase</th>
                      {!isAdmin && <th scope="col" className="px-6 py-4 print:hidden text-center text-xs font-extrabold text-gray-500 uppercase tracking-wider">Aksi</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 print:divide-none">
                    {paginatedData.map((item, idx) => (
                      <tr key={item.id || idx} className="hover:bg-blue-50/50 transition-colors duration-200 group print:border print:border-black">
                        {isAdmin && (
                          <td className="px-6 py-5 print:py-2 print:px-3 print:border print:border-black whitespace-nowrap">
                            <div className="text-sm font-bold text-indigo-700 print:text-black flex items-center">
                              <span className="print:hidden">
                                <i className="fas fa-user-circle mr-2 opacity-50"></i>
                              </span>
                              {item.petugas || '-'}
                            </div>
                          </td>
                        )}
                        <td className="px-6 py-5 print:py-2 print:px-3 print:border print:border-black whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="bg-blue-100 text-blue-600 w-8 h-8 rounded-full flex items-center justify-center mr-3 group-hover:bg-blue-600 group-hover:text-white transition-colors shadow-sm print:hidden">
                              <i className="far fa-calendar-alt text-sm print:hidden"></i>
                            </div>
                            <span className="text-sm font-bold text-gray-800 print:text-black">
                              {new Date(item.tanggal).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-5 print:py-2 print:px-3 print:border print:border-black whitespace-nowrap">
                          <div className="text-sm text-gray-700 print:text-black font-bold flex items-center">
                            <span className="print:hidden">
                              <i className="fas fa-map-marker-alt text-gray-400 mr-2 text-xs"></i>
                            </span>
                            {item.lokasi}
                          </div>
                        </td>
                        <td className="px-6 py-5 print:py-2 print:px-3 print:border print:border-black whitespace-nowrap">
                          <span className="px-3 py-1.5 print:p-0 inline-flex text-xs leading-5 font-bold rounded-lg bg-indigo-50 print:bg-transparent text-indigo-700 print:text-black border border-indigo-100 print:border-none shadow-sm print:shadow-none">
                            <span className="print:hidden">
                              <i className="fas fa-clipboard-check mr-1.5 mt-0.5"></i>
                            </span>
                            {item.formName}
                          </span>
                        </td>
                        <td className="px-6 py-5 print:py-2 print:px-3 print:border print:border-black whitespace-nowrap">
                          <div className="text-sm text-gray-900 print:text-black font-extrabold bg-gray-50 print:bg-transparent px-3 py-1 print:p-0 rounded-lg inline-block border border-gray-200 print:border-none">
                            {item.nilai} <span className="text-gray-400 print:text-black font-medium">/ {item.maksimal}</span>
                          </div>
                        </td>
                        <td className="px-6 py-5 print:py-2 print:px-3 print:border print:border-black whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="w-full bg-gray-200 rounded-full h-2.5 mr-3 max-w-20 overflow-hidden shadow-inner print:hidden">
                              <div
                                className={`h-full rounded-full transition-all duration-1000 ease-out ${item.persentase >= 80 ? 'bg-linear-to-r from-green-400 to-green-500' :
                                  item.persentase >= 60 ? 'bg-linear-to-r from-yellow-400 to-yellow-500' :
                                    'bg-linear-to-r from-red-400 to-red-500'
                                  }`}
                                style={{ width: `${item.persentase}%` }}
                              ></div>
                            </div>
                            <span className={`text-sm font-black print:text-black ${item.persentase >= 80 ? 'text-green-600' :
                              item.persentase >= 60 ? 'text-yellow-600' :
                                'text-red-600'
                              }`}>
                              {item.persentase}%
                            </span>
                          </div>
                        </td>

                        {/* Kolom Aksi Hanya Untuk Petugas */}
                        {!isAdmin && (
                          <td className="px-6 py-5 whitespace-nowrap text-center print:hidden">
                            <div className="flex items-center justify-center space-x-3">
                              <button
                                onClick={() => handleEditClick(item)}
                                className="text-blue-500 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 p-2 rounded-lg transition-colors"
                                title="Edit Data"
                              >
                                <i className="fas fa-edit"></i>
                              </button>
                              <button
                                onClick={() => handleDelete(item)}
                                className="text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 p-2 rounded-lg transition-colors"
                                title="Hapus Data"
                              >
                                <i className="fas fa-trash-alt"></i>
                              </button>
                            </div>
                          </td>
                        )}

                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Pagination Detail Riwayat */}
                <div className="bg-white px-6 py-4 flex flex-col sm:flex-row items-center justify-between border-t border-gray-200 print:hidden">
                  <div className="flex items-center mb-4 sm:mb-0">
                    <span className="text-sm text-gray-700 font-medium">Banyak baris:</span>
                    <select
                      className="ml-2 bg-gray-50 border border-gray-300 text-gray-900 text-xs rounded-lg focus:ring-blue-500 focus:border-blue-500 p-2 font-bold outline-none"
                      value={rowsPerPage}
                      onChange={(e) => setRowsPerPage(Number(e.target.value))}
                    >
                      <option value={10}>10</option>
                      <option value={25}>25</option>
                      <option value={50}>50</option>
                      <option value={100}>100</option>
                    </select>
                    <span className="ml-4 text-sm text-gray-500">
                      Menampilkan <span className="font-bold text-gray-800">{totalItems > 0 ? startIndex + 1 : 0}</span> sampai <span className="font-bold text-gray-800">{Math.min(startIndex + rowsPerPage, totalItems)}</span> dari <span className="font-bold text-gray-800">{totalItems}</span> data
                    </span>
                  </div>

                  <div className="flex space-x-2">
                    <button
                      onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                      disabled={currentPage === 1}
                      className="px-4 py-2 bg-white border border-gray-300 rounded-xl text-sm font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      <i className="fas fa-chevron-left mr-2"></i>Sebelumnya
                    </button>
                    <div className="flex items-center px-4 bg-gray-50 border border-gray-200 rounded-xl">
                      <span className="text-sm font-bold text-gray-700">Halaman <span className="text-blue-600">{currentPage}</span> dari {totalPages || 1}</span>
                    </div>
                    <button
                      onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                      disabled={currentPage === totalPages || totalPages === 0}
                      className="px-4 py-2 bg-white border border-gray-300 rounded-xl text-sm font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      Selanjutnya<i className="fas fa-chevron-right ml-2"></i>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Edit Form Modal */}
      {isEditModalOpen && editingItem && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-100 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col my-auto animation-fade-in-up">

            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-blue-600 text-white rounded-t-2xl">
              <h3 className="text-xl font-bold flex items-center">
                <i className="fas fa-edit mr-3"></i>
                Edit {editingItem.formName}
              </h3>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="text-white hover:text-gray-200 focus:outline-none p-1"
              >
                <i className="fas fa-times text-xl"></i>
              </button>
            </div>

            <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
              <div className="bg-blue-50 text-blue-800 text-sm p-4 rounded-xl mb-6 flex flex-col sm:flex-row gap-4 border border-blue-100">
                <div className="flex-1"><span className="font-semibold text-blue-900 block text-xs uppercase opacity-70">LOKASI</span> {editingItem.lokasi}</div>
                <div className="flex-1"><span className="font-semibold text-blue-900 block text-xs uppercase opacity-70">TANGGAL</span> {new Date(editingItem.tanggal).toLocaleDateString('id-ID')}</div>
              </div>

              <form id="editForm" onSubmit={handleEditSubmit} className="space-y-4">
                {CHECKLIST_ITEMS[editingItem.formId]?.map(item => (
                  <div key={item.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 border border-gray-100 rounded-xl hover:bg-gray-50 transition-colors">
                    <label htmlFor={`edit_${item.id}`} className="text-gray-700 flex-1 sm:mr-4 text-sm font-medium mb-2 sm:mb-0">
                      {item.text}
                    </label>
                    <div className="flex items-center space-x-2 w-full sm:w-auto mt-2 sm:mt-0 justify-end">
                      <input
                        type="text"
                        inputMode="numeric"
                        className="w-16 text-center text-lg font-bold border-2 border-gray-200 rounded-lg py-1 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none"
                        id={`edit_${item.id}`}
                        value={editFormData[item.id] ?? ''}
                        onChange={(e) => handleEditInputChange(item.id, e.target.value)}
                        required
                      />
                      <span className="text-gray-400 text-xs font-semibold whitespace-nowrap min-w-[40px] text-left">/ 10</span>
                    </div>
                  </div>
                ))}
              </form>
            </div>

            <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 rounded-b-2xl flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                className="px-6 py-2.5 bg-white border border-gray-300 text-gray-700 font-bold rounded-xl hover:bg-gray-50 transition-colors shadow-sm"
              >
                Batal
              </button>
              <button
                type="submit"
                form="editForm"
                disabled={isSubmittingEdit}
                className="px-6 py-2.5 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-colors flex items-center shadow-md disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {isSubmittingEdit ? (
                  <><i className="fas fa-spinner fa-spin mr-2"></i>Menyimpan...</>
                ) : (
                  <><i className="fas fa-save mr-2"></i>Simpan Perubahan</>
                )}
              </button>
            </div>

          </div>
        </div>
      )}

    </AppLayout>
  );
}
