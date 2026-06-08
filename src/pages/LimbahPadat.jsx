import { useState, useEffect } from 'react';
import AppLayout from '../components/AppLayout';
import { supabase } from '../lib/supabase';
import Swal from 'sweetalert2';
import withReactContent from 'sweetalert2-react-content';
import { getCurrentUser } from '../lib/api';

const MySwal = withReactContent(Swal);

export default function LimbahPadat() {
  const user = getCurrentUser();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [page, setPage] = useState(1);
  const [totalData, setTotalData] = useState(0);
  const itemsPerPage = 10;

  // Form State
  const [formData, setFormData] = useState({
    id: null,
    tanggal: new Date().toISOString().split('T')[0],
    infeksius: '',
    jarum_suntik: '',
    botol_obat: '',
    sitotoksik: ''
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const { count } = await supabase
        .from('limbah_padat')
        .select('*', { count: 'exact', head: true });
        
      setTotalData(count || 0);

      const from = (page - 1) * itemsPerPage;
      const to = from + itemsPerPage - 1;

      const { data: dbData, error } = await supabase
        .from('limbah_padat')
        .select('*')
        .order('tanggal', { ascending: false })
        .range(from, to);

      if (error) throw error;
      setData(dbData || []);
    } catch (error) {
      console.error('Error fetching data:', error);
      // Optional: MySwal.fire('Error', error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [page]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const payload = {
        tanggal: formData.tanggal,
        petugas: user?.nama || 'Petugas',
        infeksius: parseFloat(formData.infeksius) || 0,
        jarum_suntik: parseFloat(formData.jarum_suntik) || 0,
        botol_obat: parseFloat(formData.botol_obat) || 0,
        sitotoksik: parseFloat(formData.sitotoksik) || 0,
        waktu_input: new Date().toISOString()
      };

      if (formData.id) {
        // Update
        const { error } = await supabase
          .from('limbah_padat')
          .update(payload)
          .eq('id', formData.id);
        if (error) throw error;
        MySwal.fire('Berhasil', 'Data berhasil diubah', 'success');
      } else {
        // Insert
        const { error } = await supabase
          .from('limbah_padat')
          .insert([payload]);
        if (error) throw error;
        MySwal.fire('Berhasil', 'Data berhasil ditambahkan', 'success');
      }

      setFormData({
        id: null,
        tanggal: new Date().toISOString().split('T')[0],
        infeksius: '',
        jarum_suntik: '',
        botol_obat: '',
        sitotoksik: ''
      });
      
      fetchData();
    } catch (error) {
      MySwal.fire('Gagal', error.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (item) => {
    setFormData({
      id: item.id,
      tanggal: item.tanggal,
      infeksius: item.infeksius,
      jarum_suntik: item.jarum_suntik,
      botol_obat: item.botol_obat,
      sitotoksik: item.sitotoksik
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id) => {
    const confirm = await MySwal.fire({
      title: 'Hapus Data?',
      text: "Data yang dihapus tidak dapat dikembalikan!",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Ya, Hapus!'
    });

    if (confirm.isConfirmed) {
      try {
        const { error } = await supabase.from('limbah_padat').delete().eq('id', id);
        if (error) throw error;
        MySwal.fire('Terhapus', 'Data berhasil dihapus', 'success');
        fetchData();
      } catch (error) {
        MySwal.fire('Gagal', error.message, 'error');
      }
    }
  };

  const totalPages = Math.ceil(totalData / itemsPerPage);

  const handlePrint = async () => {
    const { value: formValues } = await MySwal.fire({
      title: 'Pilih Bulan & Tahun',
      html: '<input id="swal-input-month" type="month" class="swal2-input">',
      focusConfirm: false,
      preConfirm: () => {
        return document.getElementById('swal-input-month').value;
      }
    });

    if (!formValues) return;

    const [year, month] = formValues.split('-');
    
    try {
      MySwal.fire({
        title: 'Mengambil Data...',
        allowOutsideClick: false,
        didOpen: () => {
          MySwal.showLoading();
        }
      });

      const startOfMonth = new Date(year, month - 1, 1).toISOString().split('T')[0];
      const endOfMonth = new Date(year, month, 0).toISOString().split('T')[0];

      const { data: printData, error } = await supabase
        .from('limbah_padat')
        .select('*')
        .gte('tanggal', startOfMonth)
        .lte('tanggal', endOfMonth)
        .order('tanggal', { ascending: true });

      if (error) throw error;

      if (!printData || printData.length === 0) {
        MySwal.fire('Informasi', 'Tidak ada data untuk bulan ini.', 'info');
        return;
      }

      let totalInfeksius = 0;
      let totalJarum = 0;
      let totalBotol = 0;
      let totalSitotoksik = 0;
      let grandTotal = 0;

      const rowsHTML = printData.map((item, index) => {
        const itemTotal = (item.infeksius || 0) + (item.jarum_suntik || 0) + (item.botol_obat || 0) + (item.sitotoksik || 0);
        totalInfeksius += (item.infeksius || 0);
        totalJarum += (item.jarum_suntik || 0);
        totalBotol += (item.botol_obat || 0);
        totalSitotoksik += (item.sitotoksik || 0);
        grandTotal += itemTotal;

        return `
          <tr>
            <td style="text-align: center;">${index + 1}</td>
            <td>${new Date(item.tanggal).toLocaleDateString('id-ID')}</td>
            <td style="text-align: right;">${item.infeksius || 0}</td>
            <td style="text-align: right;">${item.jarum_suntik || 0}</td>
            <td style="text-align: right;">${item.botol_obat || 0}</td>
            <td style="text-align: right;">${item.sitotoksik || 0}</td>
            <td style="text-align: right;"><strong>${itemTotal.toFixed(2)}</strong></td>
          </tr>
        `;
      }).join('');

      MySwal.close();

      const printWindow = window.open('', '_blank');
      const monthNames = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
      const monthName = monthNames[parseInt(month) - 1];

      printWindow.document.write(`
        <html>
          <head>
            <title>Laporan Limbah Padat - ${monthName} ${year}</title>
            <style>
              body { font-family: Arial, sans-serif; padding: 20px; }
              h2 { text-align: center; margin-bottom: 20px; }
              table { width: 100%; border-collapse: collapse; margin-top: 20px; }
              th, td { border: 1px solid #000; padding: 8px; text-align: left; }
              th { background-color: #f2f2f2; text-align: center; }
              .totals { font-weight: bold; background-color: #e6e6e6; }
              @media print {
                @page { margin: 1cm; }
                body { padding: 0; }
              }
            </style>
          </head>
          <body>
            <h2>Laporan Bulanan Limbah Medis Padat<br/>Bulan ${monthName} Tahun ${year}</h2>
            <table>
              <thead>
                <tr>
                  <th rowspan="2">No.</th>
                  <th rowspan="2">Tanggal</th>
                  <th colspan="4">Jenis Limbah (Kg)</th>
                  <th rowspan="2">Total Harian (Kg)</th>
                </tr>
                <tr>
                  <th>Infeksius</th>
                  <th>Jarum Suntik</th>
                  <th>Botol Obat</th>
                  <th>Sitotoksik</th>
                </tr>
              </thead>
              <tbody>
                ${rowsHTML}
              </tbody>
              <tfoot>
                <tr class="totals">
                  <td colspan="2" style="text-align: center;">TOTAL DALAM SEBULAN</td>
                  <td style="text-align: right;">${totalInfeksius.toFixed(2)}</td>
                  <td style="text-align: right;">${totalJarum.toFixed(2)}</td>
                  <td style="text-align: right;">${totalBotol.toFixed(2)}</td>
                  <td style="text-align: right;">${totalSitotoksik.toFixed(2)}</td>
                  <td style="text-align: right;">${grandTotal.toFixed(2)}</td>
                </tr>
              </tfoot>
            </table>
            <div style="margin-top: 50px; display: flex; justify-content: flex-end;">
              <div style="text-align: center;">
                <p>Mengetahui,</p>
                <br/><br/><br/>
                <p><strong>_____________________</strong></p>
                <p>Petugas Sanitasi</p>
              </div>
            </div>
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
        printWindow.close();
      }, 500);

    } catch (error) {
      console.error(error);
      MySwal.fire('Gagal', 'Terjadi kesalahan saat mengambil data cetak: ' + error.message, 'error');
    }
  };

  return (
    <AppLayout title="Data Limbah Padat">
      <div className="container mx-auto px-4 py-8">
        {/* Form Input */}
        <div className="bg-white rounded-lg shadow-lg mb-8 overflow-hidden">
          <div className="bg-blue-600 text-white px-6 py-4">
            <h2 className="text-lg font-bold"><i className="fas fa-edit mr-2"></i> Form Input Limbah Padat (Kg)</h2>
          </div>
          <div className="p-6">
            <form onSubmit={handleSubmit}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-gray-700 font-medium mb-1">Tanggal</label>
                  <input type="date" name="tanggal" value={formData.tanggal} onChange={handleInputChange} required className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
                <div>
                  <label className="block text-gray-700 font-medium mb-1">Petugas</label>
                  <input type="text" value={user?.nama || ''} readOnly className="w-full border bg-gray-100 text-gray-500 rounded-lg px-3 py-2 cursor-not-allowed" />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <div>
                  <label className="block text-gray-700 font-medium mb-1">Limbah Infeksius</label>
                  <input type="number" step="0.01" min="0" name="infeksius" value={formData.infeksius} onChange={handleInputChange} required className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none" placeholder="0.0" />
                </div>
                <div>
                  <label className="block text-gray-700 font-medium mb-1">Limbah Jarum Suntik</label>
                  <input type="number" step="0.01" min="0" name="jarum_suntik" value={formData.jarum_suntik} onChange={handleInputChange} required className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none" placeholder="0.0" />
                </div>
                <div>
                  <label className="block text-gray-700 font-medium mb-1">Limbah Botol Obat</label>
                  <input type="number" step="0.01" min="0" name="botol_obat" value={formData.botol_obat} onChange={handleInputChange} required className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none" placeholder="0.0" />
                </div>
                <div>
                  <label className="block text-gray-700 font-medium mb-1">Limbah Sitotoksik</label>
                  <input type="number" step="0.01" min="0" name="sitotoksik" value={formData.sitotoksik} onChange={handleInputChange} required className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none" placeholder="0.0" />
                </div>
              </div>
              <div className="flex justify-end space-x-3">
                {formData.id && (
                  <button type="button" onClick={() => setFormData({ id: null, tanggal: new Date().toISOString().split('T')[0], infeksius: '', jarum_suntik: '', botol_obat: '', sitotoksik: '' })} className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-lg transition">Batal Edit</button>
                )}
                <button type="submit" disabled={submitting} className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg font-medium transition disabled:opacity-50">
                  {submitting ? <i className="fas fa-spinner fa-spin mr-2"></i> : <i className="fas fa-save mr-2"></i>}
                  {formData.id ? 'Update Data' : 'Simpan Data'}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Tabel Data */}
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          <div className="bg-gray-800 text-white px-6 py-4 flex justify-between items-center">
            <h2 className="text-lg font-bold"><i className="fas fa-table mr-2"></i> Data Limbah Padat</h2>
            <button onClick={handlePrint} className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded transition font-medium text-sm">
              <i className="fas fa-print mr-2"></i> Cetak Bulanan
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-100 text-gray-700 uppercase text-sm border-b">
                  <th className="px-4 py-3">Tanggal</th>
                  <th className="px-4 py-3">Petugas</th>
                  <th className="px-4 py-3 text-right">Infeksius</th>
                  <th className="px-4 py-3 text-right">Jarum Suntik</th>
                  <th className="px-4 py-3 text-right">Botol Obat</th>
                  <th className="px-4 py-3 text-right">Sitotoksik</th>
                  <th className="px-4 py-3 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan="7" className="text-center py-6"><i className="fas fa-spinner fa-spin text-blue-500 text-2xl"></i></td></tr>
                ) : data.length === 0 ? (
                  <tr><td colSpan="7" className="text-center py-6 text-gray-500">Belum ada data.</td></tr>
                ) : (
                  data.map(item => (
                    <tr key={item.id} className="border-b hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-800">{new Date(item.tanggal).toLocaleDateString('id-ID')}</td>
                      <td className="px-4 py-3">{item.petugas}</td>
                      <td className="px-4 py-3 text-right">{item.infeksius} kg</td>
                      <td className="px-4 py-3 text-right">{item.jarum_suntik} kg</td>
                      <td className="px-4 py-3 text-right">{item.botol_obat} kg</td>
                      <td className="px-4 py-3 text-right">{item.sitotoksik} kg</td>
                      <td className="px-4 py-3 text-center">
                        <button onClick={() => handleEdit(item)} className="bg-blue-100 text-blue-600 hover:bg-blue-200 px-2 py-1 rounded mx-1" title="Edit">
                          <i className="fas fa-edit"></i>
                        </button>
                        <button onClick={() => handleDelete(item.id)} className="bg-red-100 text-red-600 hover:bg-red-200 px-2 py-1 rounded mx-1" title="Hapus">
                          <i className="fas fa-trash"></i>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-between items-center px-6 py-4 bg-gray-50 border-t">
              <span className="text-sm text-gray-600">Halaman {page} dari {totalPages}</span>
              <div className="flex space-x-2">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-1 bg-white border rounded hover:bg-gray-100 disabled:opacity-50">Sebelumnya</button>
                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="px-3 py-1 bg-white border rounded hover:bg-gray-100 disabled:opacity-50">Selanjutnya</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
