import { useState, useEffect, useRef } from 'react';
import AppLayout from '../components/AppLayout';
import { supabase } from '../lib/supabase';
import Swal from 'sweetalert2';
import withReactContent from 'sweetalert2-react-content';
import { getCurrentUser } from '../lib/api';
import * as XLSX from 'xlsx';

const MySwal = withReactContent(Swal);

export default function LimbahPadat() {
  const user = getCurrentUser();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [page, setPage] = useState(1);
  const [totalData, setTotalData] = useState(0);
  const itemsPerPage = 10;
  const importInputRef = useRef(null);

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
        const { error } = await supabase
          .from('limbah_padat')
          .update(payload)
          .eq('id', formData.id);
        if (error) throw error;
        MySwal.fire('Berhasil', 'Data berhasil diubah', 'success');
      } else {
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

  // ─── EXPORT EXCEL ────────────────────────────────────────────────────────────
  const handleExportExcel = async () => {
    const { value: selectedMonth } = await MySwal.fire({
      title: 'Pilih Bulan & Tahun',
      html: `<p class="text-sm text-gray-500 mb-2">Pilih periode data yang ingin diekspor</p>
             <input id="swal-input-month" type="month" class="swal2-input" value="${new Date().toISOString().slice(0, 7)}">`,
      focusConfirm: false,
      showCancelButton: true,
      confirmButtonText: '<i class="fas fa-file-excel mr-2"></i>Export',
      cancelButtonText: 'Batal',
      preConfirm: () => document.getElementById('swal-input-month').value
    });

    if (!selectedMonth) return;

    const [year, month] = selectedMonth.split('-');
    const startOfMonth = new Date(year, month - 1, 1).toISOString().split('T')[0];
    const endOfMonth = new Date(year, month, 0).toISOString().split('T')[0];

    MySwal.fire({ title: 'Mengambil Data...', allowOutsideClick: false, didOpen: () => MySwal.showLoading() });

    try {
      const { data: exportData, error } = await supabase
        .from('limbah_padat')
        .select('*')
        .gte('tanggal', startOfMonth)
        .lte('tanggal', endOfMonth)
        .order('tanggal', { ascending: true });

      if (error) throw error;

      if (!exportData || exportData.length === 0) {
        MySwal.fire('Informasi', 'Tidak ada data untuk bulan ini.', 'info');
        return;
      }

      const monthNames = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
      const monthLabel = `${monthNames[parseInt(month) - 1]} ${year}`;

      // Build worksheet rows
      const wsData = [];

      // Title rows
      wsData.push(['LAPORAN LIMBAH MEDIS PADAT']);
      wsData.push([`Periode: ${monthLabel}`]);
      wsData.push([`Dicetak: ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}`]);
      wsData.push([]); // blank row

      // Header
      wsData.push(['No.', 'Tanggal', 'Limbah Infeksius (Kg)', 'Jarum Suntik (Kg)', 'Botol Obat (Kg)', 'Sitotoksik (Kg)', 'Total Harian (Kg)']);

      let totalInfeksius = 0, totalJarum = 0, totalBotol = 0, totalSito = 0;

      exportData.forEach((item, idx) => {
        const inf = parseFloat(item.infeksius) || 0;
        const jar = parseFloat(item.jarum_suntik) || 0;
        const bot = parseFloat(item.botol_obat) || 0;
        const sit = parseFloat(item.sitotoksik) || 0;
        const total = inf + jar + bot + sit;

        totalInfeksius += inf;
        totalJarum += jar;
        totalBotol += bot;
        totalSito += sit;

        wsData.push([
          idx + 1,
          new Date(item.tanggal).toLocaleDateString('id-ID'),
          inf,
          jar,
          bot,
          sit,
          total
        ]);
      });

      // Total row
      wsData.push([
        '', 'TOTAL BULAN',
        totalInfeksius,
        totalJarum,
        totalBotol,
        totalSito,
        totalInfeksius + totalJarum + totalBotol + totalSito
      ]);

      const ws = XLSX.utils.aoa_to_sheet(wsData);

      // Column widths
      ws['!cols'] = [
        { wch: 5 },   // No
        { wch: 14 },  // Tanggal
        { wch: 22 },  // Infeksius
        { wch: 18 },  // Jarum
        { wch: 16 },  // Botol
        { wch: 14 },  // Sito
        { wch: 18 },  // Total
      ];

      // Merge title cells A1:G1, A2:G2, A3:G3
      ws['!merges'] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: 6 } },
        { s: { r: 1, c: 0 }, e: { r: 1, c: 6 } },
        { s: { r: 2, c: 0 }, e: { r: 2, c: 6 } },
      ];

      // Style helpers (openpyxl-style not available in SheetJS CE, but we set number formats)
      const headerRowIdx = 4; // 0-indexed row 4 = header
      const dataStartRow = 5;
      const dataEndRow = dataStartRow + exportData.length - 1;
      const totalRowIdx = dataEndRow + 1;

      // Number format for numeric cells
      for (let r = dataStartRow; r <= totalRowIdx; r++) {
        for (let c = 2; c <= 6; c++) {
          const cellRef = XLSX.utils.encode_cell({ r, c });
          if (ws[cellRef]) ws[cellRef].z = '#,##0.00';
        }
      }

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, `Limbah ${monthLabel}`);

      XLSX.writeFile(wb, `Laporan_Limbah_Padat_${monthLabel.replace(' ', '_')}.xlsx`);

      MySwal.fire({
        icon: 'success',
        title: 'Export Berhasil!',
        text: `${exportData.length} data berhasil diekspor ke Excel.`,
        timer: 2000,
        showConfirmButton: false
      });

    } catch (error) {
      console.error(error);
      MySwal.fire('Gagal', 'Terjadi kesalahan saat mengekspor data: ' + error.message, 'error');
    }
  };

  // ─── DOWNLOAD TEMPLATE ───────────────────────────────────────────────────────
  const handleDownloadTemplate = () => {
    const templateData = [
      ['No.', 'Tanggal', 'Limbah Infeksius (Kg)', 'Jarum Suntik (Kg)', 'Botol Obat (Kg)', 'Sitotoksik (Kg)'],
      ['', 'Petunjuk: Isi tanggal format YYYY-MM-DD, misal: 2025-01-15', '', '', '', ''],
      [1, '2025-01-01', 0.5, 0.2, 0.1, 0.05],
      [2, '2025-01-02', 0.8, 0.3, 0.15, 0.1],
    ];

    const ws = XLSX.utils.aoa_to_sheet(templateData);
    ws['!cols'] = [
      { wch: 5 }, { wch: 20 }, { wch: 22 }, { wch: 18 }, { wch: 16 }, { wch: 14 }
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Template');
    XLSX.writeFile(wb, 'Template_Import_Limbah_Padat.xlsx');
  };

  // ─── IMPORT EXCEL ────────────────────────────────────────────────────────────
  const handleImportFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Reset input so same file can be re-selected
    e.target.value = '';

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const binaryStr = evt.target.result;
        const wb = XLSX.read(binaryStr, { type: 'binary', cellDates: true });
        const sheetName = wb.SheetNames[0];
        const ws = wb.Sheets[sheetName];

        // Convert to array of arrays, skip header row (row 0)
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

        // Find actual data rows (skip header, skip instruction rows)
        // We detect header row by checking if row contains 'Tanggal'
        let headerIdx = -1;
        for (let i = 0; i < rows.length; i++) {
          const rowStr = rows[i].join('').toLowerCase();
          if (rowStr.includes('tanggal')) {
            headerIdx = i;
            break;
          }
        }

        if (headerIdx === -1) {
          MySwal.fire('Format Salah', 'Tidak ditemukan baris header "Tanggal" di file. Gunakan template yang tersedia.', 'error');
          return;
        }

        const dataRows = rows.slice(headerIdx + 1).filter(row => {
          // Skip empty rows and instruction/total rows
          const tanggalCell = row[1];
          return tanggalCell && String(tanggalCell).trim() !== '' && !String(tanggalCell).toLowerCase().includes('petunjuk') && !String(tanggalCell).toLowerCase().includes('total');
        });

        if (dataRows.length === 0) {
          MySwal.fire('Tidak Ada Data', 'Tidak ditemukan baris data yang valid di file.', 'warning');
          return;
        }

        // Preview data to user
        const previewHTML = `
          <div style="text-align:left; max-height:300px; overflow-y:auto;">
            <p style="margin-bottom:8px; font-weight:600; color:#374151;">
              <i class="fas fa-table"></i> Ditemukan <strong>${dataRows.length} baris data</strong>
            </p>
            <table style="width:100%; font-size:12px; border-collapse:collapse;">
              <thead>
                <tr style="background:#f3f4f6;">
                  <th style="border:1px solid #e5e7eb; padding:4px 8px;">Tanggal</th>
                  <th style="border:1px solid #e5e7eb; padding:4px 8px;">Infeksius</th>
                  <th style="border:1px solid #e5e7eb; padding:4px 8px;">Jarum</th>
                  <th style="border:1px solid #e5e7eb; padding:4px 8px;">Botol</th>
                  <th style="border:1px solid #e5e7eb; padding:4px 8px;">Sito</th>
                </tr>
              </thead>
              <tbody>
                ${dataRows.slice(0, 10).map(row => `
                  <tr>
                    <td style="border:1px solid #e5e7eb; padding:4px 8px;">${formatDateFromExcel(row[1])}</td>
                    <td style="border:1px solid #e5e7eb; padding:4px 8px; text-align:right;">${parseFloat(row[2]) || 0}</td>
                    <td style="border:1px solid #e5e7eb; padding:4px 8px; text-align:right;">${parseFloat(row[3]) || 0}</td>
                    <td style="border:1px solid #e5e7eb; padding:4px 8px; text-align:right;">${parseFloat(row[4]) || 0}</td>
                    <td style="border:1px solid #e5e7eb; padding:4px 8px; text-align:right;">${parseFloat(row[5]) || 0}</td>
                  </tr>
                `).join('')}
                ${dataRows.length > 10 ? `<tr><td colspan="5" style="text-align:center; padding:4px; color:#6b7280;">...dan ${dataRows.length - 10} baris lainnya</td></tr>` : ''}
              </tbody>
            </table>
          </div>
        `;

        const { isConfirmed } = await MySwal.fire({
          title: 'Konfirmasi Import',
          html: previewHTML,
          icon: 'question',
          showCancelButton: true,
          confirmButtonColor: '#16a34a',
          cancelButtonColor: '#6b7280',
          confirmButtonText: '<i class="fas fa-upload mr-2"></i>Ya, Import!',
          cancelButtonText: 'Batal',
          width: '600px'
        });

        if (!isConfirmed) return;

        setImporting(true);
        MySwal.fire({ title: 'Mengimport Data...', allowOutsideClick: false, didOpen: () => MySwal.showLoading() });

        // Parse and insert rows
        const payloads = dataRows.map(row => ({
          tanggal: formatDateFromExcel(row[1]),
          petugas: user?.nama || 'Petugas',
          infeksius: parseFloat(row[2]) || 0,
          jarum_suntik: parseFloat(row[3]) || 0,
          botol_obat: parseFloat(row[4]) || 0,
          sitotoksik: parseFloat(row[5]) || 0,
          waktu_input: new Date().toISOString()
        })).filter(p => p.tanggal); // only rows with valid date

        if (payloads.length === 0) {
          MySwal.fire('Gagal', 'Tidak ada baris dengan tanggal yang valid.', 'error');
          setImporting(false);
          return;
        }

        // Insert in batches of 50
        const batchSize = 50;
        let inserted = 0;
        for (let i = 0; i < payloads.length; i += batchSize) {
          const batch = payloads.slice(i, i + batchSize);
          const { error } = await supabase.from('limbah_padat').insert(batch);
          if (error) throw error;
          inserted += batch.length;
        }

        await fetchData();
        MySwal.fire({
          icon: 'success',
          title: 'Import Berhasil!',
          text: `${inserted} data berhasil diimport.`,
          timer: 2500,
          showConfirmButton: false
        });

      } catch (err) {
        console.error(err);
        MySwal.fire('Gagal Import', err.message || 'Terjadi kesalahan saat membaca file.', 'error');
      } finally {
        setImporting(false);
      }
    };

    reader.readAsBinaryString(file);
  };

  // Helper: parse tanggal dari Excel (bisa Date object, serial number, atau string)
  const formatDateFromExcel = (val) => {
    if (!val) return '';
    // If Date object (cellDates:true)
    if (val instanceof Date) {
      return val.toISOString().split('T')[0];
    }
    // If Excel serial number
    if (typeof val === 'number') {
      const date = XLSX.SSF.parse_date_code(val);
      if (date) {
        const m = String(date.m).padStart(2, '0');
        const d = String(date.d).padStart(2, '0');
        return `${date.y}-${m}-${d}`;
      }
    }
    // If string - try to parse
    const str = String(val).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
    // try d/m/Y or d-m-Y
    const parts = str.split(/[\/\-\.]/);
    if (parts.length === 3) {
      if (parts[0].length === 4) return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
      return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
    }
    return '';
  };

  // ─── PRINT PDF ───────────────────────────────────────────────────────────────
  const handlePrint = async () => {
    const { value: formValues } = await MySwal.fire({
      title: 'Pilih Bulan & Tahun',
      html: '<input id="swal-input-month" type="month" class="swal2-input">',
      focusConfirm: false,
      preConfirm: () => document.getElementById('swal-input-month').value
    });

    if (!formValues) return;

    const [year, month] = formValues.split('-');

    try {
      MySwal.fire({ title: 'Mengambil Data...', allowOutsideClick: false, didOpen: () => MySwal.showLoading() });

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

      let totalInfeksius = 0, totalJarum = 0, totalBotol = 0, totalSitotoksik = 0, grandTotal = 0;
      const rowsHTML = printData.map((item, index) => {
        const itemTotal = (item.infeksius || 0) + (item.jarum_suntik || 0) + (item.botol_obat || 0) + (item.sitotoksik || 0);
        totalInfeksius += (item.infeksius || 0);
        totalJarum += (item.jarum_suntik || 0);
        totalBotol += (item.botol_obat || 0);
        totalSitotoksik += (item.sitotoksik || 0);
        grandTotal += itemTotal;
        return `<tr>
          <td style="text-align:center;">${index + 1}</td>
          <td>${new Date(item.tanggal).toLocaleDateString('id-ID')}</td>
          <td style="text-align:right;">${item.infeksius || 0}</td>
          <td style="text-align:right;">${item.jarum_suntik || 0}</td>
          <td style="text-align:right;">${item.botol_obat || 0}</td>
          <td style="text-align:right;">${item.sitotoksik || 0}</td>
          <td style="text-align:right;"><strong>${itemTotal.toFixed(2)}</strong></td>
        </tr>`;
      }).join('');

      MySwal.close();
      const printWindow = window.open('', '_blank');
      const monthNames = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
      const monthName = monthNames[parseInt(month) - 1];
      printWindow.document.write(`<html><head><title>Laporan Limbah Padat - ${monthName} ${year}</title>
        <style>body{font-family:Arial,sans-serif;padding:20px;}h2{text-align:center;margin-bottom:20px;}
        table{width:100%;border-collapse:collapse;margin-top:20px;}
        th,td{border:1px solid #000;padding:8px;text-align:left;}
        th{background-color:#f2f2f2;text-align:center;}
        .totals{font-weight:bold;background-color:#e6e6e6;}
        @media print{@page{margin:1cm;}body{padding:0;}}</style></head>
        <body><h2>Laporan Bulanan Limbah Medis Padat<br/>Bulan ${monthName} Tahun ${year}</h2>
        <table><thead><tr><th rowspan="2">No.</th><th rowspan="2">Tanggal</th>
        <th colspan="4">Jenis Limbah (Kg)</th><th rowspan="2">Total Harian (Kg)</th></tr>
        <tr><th>Infeksius</th><th>Jarum Suntik</th><th>Botol Obat</th><th>Sitotoksik</th></tr></thead>
        <tbody>${rowsHTML}</tbody>
        <tfoot><tr class="totals"><td colspan="2" style="text-align:center;">TOTAL DALAM SEBULAN</td>
        <td style="text-align:right;">${totalInfeksius.toFixed(2)}</td>
        <td style="text-align:right;">${totalJarum.toFixed(2)}</td>
        <td style="text-align:right;">${totalBotol.toFixed(2)}</td>
        <td style="text-align:right;">${totalSitotoksik.toFixed(2)}</td>
        <td style="text-align:right;">${grandTotal.toFixed(2)}</td></tr></tfoot></table>
        <div style="margin-top:50px;display:flex;justify-content:flex-end;">
        <div style="text-align:center;"><p>Mengetahui,</p><br/><br/><br/>
        <p><strong>_____________________</strong></p><p>Petugas Sanitasi</p></div></div>
        </body></html>`);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => { printWindow.print(); printWindow.close(); }, 500);

    } catch (error) {
      console.error(error);
      MySwal.fire('Gagal', 'Terjadi kesalahan saat mengambil data cetak: ' + error.message, 'error');
    }
  };

  const totalPages = Math.ceil(totalData / itemsPerPage);

  return (
    <AppLayout title="Data Limbah Padat">
      <div className="container mx-auto px-4 py-8">

        {/* ── Form Input ── */}
        <div className="bg-white rounded-lg shadow-lg mb-6 overflow-hidden">
          <div className="bg-blue-600 text-white px-6 py-4">
            <h2 className="text-lg font-bold">
              <i className="fas fa-edit mr-2"></i> Form Input Limbah Padat (Kg)
            </h2>
          </div>
          <div className="p-6">
            <form onSubmit={handleSubmit}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-gray-700 font-medium mb-1">Tanggal</label>
                  <input type="date" name="tanggal" value={formData.tanggal} onChange={handleInputChange} required
                    className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
                <div>
                  <label className="block text-gray-700 font-medium mb-1">Petugas</label>
                  <input type="text" value={user?.nama || ''} readOnly
                    className="w-full border bg-gray-100 text-gray-500 rounded-lg px-3 py-2 cursor-not-allowed" />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                {[
                  { name: 'infeksius', label: 'Limbah Infeksius' },
                  { name: 'jarum_suntik', label: 'Limbah Jarum Suntik' },
                  { name: 'botol_obat', label: 'Limbah Botol Obat' },
                  { name: 'sitotoksik', label: 'Limbah Sitotoksik' },
                ].map(field => (
                  <div key={field.name}>
                    <label className="block text-gray-700 font-medium mb-1">{field.label}</label>
                    <input type="number" step="0.01" min="0" name={field.name}
                      value={formData[field.name]} onChange={handleInputChange} required
                      className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
                      placeholder="0.0" />
                  </div>
                ))}
              </div>
              <div className="flex justify-end space-x-3">
                {formData.id && (
                  <button type="button"
                    onClick={() => setFormData({ id: null, tanggal: new Date().toISOString().split('T')[0], infeksius: '', jarum_suntik: '', botol_obat: '', sitotoksik: '' })}
                    className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-lg transition">
                    Batal Edit
                  </button>
                )}
                <button type="submit" disabled={submitting}
                  className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg font-medium transition disabled:opacity-50">
                  {submitting ? <i className="fas fa-spinner fa-spin mr-2"></i> : <i className="fas fa-save mr-2"></i>}
                  {formData.id ? 'Update Data' : 'Simpan Data'}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* ── Import / Export Toolbar ── */}
        <div className="bg-white rounded-lg shadow-lg mb-6 overflow-hidden">
          <div className="bg-emerald-700 text-white px-6 py-4">
            <h2 className="text-lg font-bold">
              <i className="fas fa-file-excel mr-2"></i> Import / Export Excel
            </h2>
          </div>
          <div className="p-5 flex flex-wrap gap-3 items-center">

            {/* Download Template */}
            <button
              onClick={handleDownloadTemplate}
              className="flex items-center gap-2 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 px-4 py-2.5 rounded-lg font-semibold text-sm transition active:scale-95 shadow-sm">
              <i className="fas fa-download"></i>
              <span>Download Template</span>
            </button>

            {/* Import Excel */}
            <div>
              <input
                ref={importInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={handleImportFile}
              />
              <button
                onClick={() => importInputRef.current?.click()}
                disabled={importing}
                className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-lg font-semibold text-sm transition active:scale-95 shadow-sm disabled:opacity-60">
                {importing
                  ? <><i className="fas fa-spinner fa-spin"></i><span>Mengimport...</span></>
                  : <><i className="fas fa-upload"></i><span>Import Excel</span></>}
              </button>
            </div>

            {/* Export Excel */}
            <button
              onClick={handleExportExcel}
              className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2.5 rounded-lg font-semibold text-sm transition active:scale-95 shadow-sm">
              <i className="fas fa-file-excel"></i>
              <span>Export Excel</span>
            </button>

            {/* Divider */}
            <div className="hidden sm:block w-px h-8 bg-gray-200 mx-1"></div>

            {/* Info */}
            <div className="text-xs text-gray-500 flex-1 min-w-[220px]">
              <p><i className="fas fa-info-circle text-blue-400 mr-1"></i>
                <strong>Import:</strong> Download template terlebih dahulu, isi data, lalu upload.</p>
              <p className="mt-0.5"><i className="fas fa-info-circle text-green-500 mr-1"></i>
                <strong>Export:</strong> Ekspor data per bulan ke file Excel (.xlsx).</p>
            </div>
          </div>
        </div>

        {/* ── Tabel Data ── */}
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          <div className="bg-gray-800 text-white px-6 py-4 flex justify-between items-center">
            <h2 className="text-lg font-bold">
              <i className="fas fa-table mr-2"></i> Data Limbah Padat
              <span className="ml-3 text-sm font-normal text-gray-300">({totalData} total data)</span>
            </h2>
            <button onClick={handlePrint}
              className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded transition font-medium text-sm">
              <i className="fas fa-print mr-2"></i> Cetak PDF
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-100 text-gray-700 text-sm border-b">
                  <th className="px-4 py-3">No.</th>
                  <th className="px-4 py-3">Tanggal</th>
                  <th className="px-4 py-3 text-right">Infeksius (Kg)</th>
                  <th className="px-4 py-3 text-right">Jarum Suntik (Kg)</th>
                  <th className="px-4 py-3 text-right">Botol Obat (Kg)</th>
                  <th className="px-4 py-3 text-right">Sitotoksik (Kg)</th>
                  <th className="px-4 py-3 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan="7" className="text-center py-8">
                    <i className="fas fa-spinner fa-spin text-blue-500 text-2xl"></i>
                    <p className="text-gray-500 text-sm mt-2">Memuat data...</p>
                  </td></tr>
                ) : data.length === 0 ? (
                  <tr><td colSpan="7" className="text-center py-8 text-gray-400">
                    <i className="fas fa-inbox text-4xl mb-2 block"></i>
                    Belum ada data.
                  </td></tr>
                ) : (
                  data.map((item, idx) => {
                    const rowNo = (page - 1) * itemsPerPage + idx + 1;
                    return (
                      <tr key={item.id} className="border-b hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 text-gray-500 text-sm">{rowNo}</td>
                        <td className="px-4 py-3 font-medium text-gray-800">
                          {new Date(item.tanggal).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                        </td>
                        <td className="px-4 py-3 text-right text-red-600 font-semibold">{parseFloat(item.infeksius || 0).toFixed(2)}</td>
                        <td className="px-4 py-3 text-right text-orange-600 font-semibold">{parseFloat(item.jarum_suntik || 0).toFixed(2)}</td>
                        <td className="px-4 py-3 text-right text-blue-600 font-semibold">{parseFloat(item.botol_obat || 0).toFixed(2)}</td>
                        <td className="px-4 py-3 text-right text-purple-600 font-semibold">{parseFloat(item.sitotoksik || 0).toFixed(2)}</td>
                        <td className="px-4 py-3 text-center">
                          <button onClick={() => handleEdit(item)}
                            className="bg-blue-100 text-blue-600 hover:bg-blue-200 px-2 py-1 rounded mx-1 transition" title="Edit">
                            <i className="fas fa-edit"></i>
                          </button>
                          <button onClick={() => handleDelete(item.id)}
                            className="bg-red-100 text-red-600 hover:bg-red-200 px-2 py-1 rounded mx-1 transition" title="Hapus">
                            <i className="fas fa-trash"></i>
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-between items-center px-6 py-4 bg-gray-50 border-t">
              <span className="text-sm text-gray-600">Halaman {page} dari {totalPages}</span>
              <div className="flex space-x-2">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                  className="px-3 py-1 bg-white border rounded hover:bg-gray-100 disabled:opacity-50 text-sm">
                  Sebelumnya
                </button>
                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                  className="px-3 py-1 bg-white border rounded hover:bg-gray-100 disabled:opacity-50 text-sm">
                  Selanjutnya
                </button>
              </div>
            </div>
          )}
        </div>

      </div>
    </AppLayout>
  );
}