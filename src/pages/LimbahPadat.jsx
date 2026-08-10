import { useState, useEffect, useRef } from 'react';
import AppLayout from '../components/AppLayout';
import { supabase } from '../lib/supabase';
import Swal from 'sweetalert2';
import withReactContent from 'sweetalert2-react-content';
import { getCurrentUser, getSetting, getSettingCached } from '../lib/api';
import { saveToOfflineQueue, getUnsyncedItemsForTable, syncOfflineQueue } from '../lib/offlineStorage';
import * as XLSX from 'xlsx';

const MySwal = withReactContent(Swal);

// Di luar (di atas) function LimbahRuangan, di top-level file:
function EmbeddedWrapper({ children }) {
  return <div className="bg-gray-100 min-h-screen">{children}</div>;
}

function FullWrapper({ children }) {
  return <AppLayout title="Limbah Per Ruangan">{children}</AppLayout>;
}

export default function LimbahPadat({ embedded = false }) {
  const user = getCurrentUser();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [page, setPage] = useState(1);
  const [totalData, setTotalData] = useState(0);
  const [filterMonth, setFilterMonth] = useState('');
  const [formEnabled, setFormEnabled] = useState(() => getSettingCached('form_limbah_padat_enabled', true));
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

  const getAccumulatedData = async (targetMonth = null) => {
    let dbPadat = [];
    let dbRuangan = [];

    if (navigator.onLine) {
      try {
        let qPadat = supabase
          .from('limbah_padat')
          .select('id, tanggal, infeksius, jarum_suntik, botol_obat, sitotoksik, petugas, waktu_input');

        let qRuangan = supabase
          .from('limbah_ruangan')
          .select('id, tanggal, ruangan, infeksius, jarum_suntik, botol_obat, sitotoksik, petugas, waktu_input');

        if (targetMonth) {
          const [year, month] = targetMonth.split('-');
          const startOfMonth = `${year}-${month}-01`;
          const lastDay = new Date(year, month, 0).getDate();
          const endOfMonth = `${year}-${month}-${String(lastDay).padStart(2, '0')}`;

          qPadat = qPadat.gte('tanggal', startOfMonth).lte('tanggal', endOfMonth);
          qRuangan = qRuangan.gte('tanggal', startOfMonth).lte('tanggal', endOfMonth);
        }

        const [{ data: pData }, { data: rData }] = await Promise.all([qPadat, qRuangan]);
        dbPadat = pData || [];
        dbRuangan = rData || [];
      } catch (err) {
        console.warn('Network issue fetching accumulated data:', err);
      }
    }

    // Ambil data offline unsynced
    let unsyncedPadat = getUnsyncedItemsForTable('limbah_padat');
    let unsyncedRuangan = getUnsyncedItemsForTable('limbah_ruangan');

    if (targetMonth) {
      unsyncedPadat = unsyncedPadat.filter(i => i.tanggal && i.tanggal.startsWith(targetMonth));
      unsyncedRuangan = unsyncedRuangan.filter(i => i.tanggal && i.tanggal.startsWith(targetMonth));
    }

    const unsyncedPadatIds = new Set(unsyncedPadat.map(u => u.id));
    const filteredDbPadat = dbPadat.filter(d => !unsyncedPadatIds.has(d.id));

    const unsyncedRuanganIds = new Set(unsyncedRuangan.map(u => u.id));
    const filteredDbRuangan = dbRuangan.filter(d => !unsyncedRuanganIds.has(d.id));

    const allRuangan = [...unsyncedRuangan, ...filteredDbRuangan];
    const allPadat = [...unsyncedPadat, ...filteredDbPadat];

    const dateMap = new Map();

    // Akumulasi Limbah Ruangan per tanggal
    allRuangan.forEach(item => {
      const tgl = item.tanggal;
      if (!tgl) return;

      if (!dateMap.has(tgl)) {
        dateMap.set(tgl, {
          id: `agg_${tgl}`,
          tanggal: tgl,
          infeksius: 0,
          jarum_suntik: 0,
          botol_obat: 0,
          sitotoksik: 0,
          ruanganCount: 0,
          ruanganNames: new Set(),
          padatIds: [],
          isOffline: false,
          isRoomAccumulation: true,
          isManual: false
        });
      }

      const entry = dateMap.get(tgl);
      entry.infeksius += parseFloat(item.infeksius || 0);
      entry.jarum_suntik += parseFloat(item.jarum_suntik || 0);
      entry.botol_obat += parseFloat(item.botol_obat || 0);
      entry.sitotoksik += parseFloat(item.sitotoksik || 0);
      entry.ruanganCount += 1;
      if (item.ruangan) entry.ruanganNames.add(item.ruangan);
      if (item.isOffline) entry.isOffline = true;
    });

    // Akumulasi Input Manual Limbah Padat per tanggal
    allPadat.forEach(item => {
      const tgl = item.tanggal;
      if (!tgl) return;

      if (!dateMap.has(tgl)) {
        dateMap.set(tgl, {
          id: item.id || `padat_${tgl}`,
          tanggal: tgl,
          infeksius: 0,
          jarum_suntik: 0,
          botol_obat: 0,
          sitotoksik: 0,
          ruanganCount: 0,
          ruanganNames: new Set(),
          padatIds: [],
          isOffline: false,
          isManual: true
        });
      }

      const entry = dateMap.get(tgl);
      entry.infeksius += parseFloat(item.infeksius || 0);
      entry.jarum_suntik += parseFloat(item.jarum_suntik || 0);
      entry.botol_obat += parseFloat(item.botol_obat || 0);
      entry.sitotoksik += parseFloat(item.sitotoksik || 0);
      entry.isManual = true;
      // Simpan ID asli dari limbah_padat agar bisa dihapus
      if (item.id && !item.isOffline) entry.padatIds.push(item.id);
      if (item.isOffline) entry.isOffline = true;
    });

    return Array.from(dateMap.values());
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const accumulated = await getAccumulatedData(filterMonth);
      accumulated.sort((a, b) => b.tanggal.localeCompare(a.tanggal));

      setTotalData(accumulated.length);

      const from = (page - 1) * itemsPerPage;
      const paginated = accumulated.slice(from, from + itemsPerPage);
      setData(paginated);
    } catch (error) {
      console.error('Error fetching accumulated data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    const handleQueueChange = () => fetchData();
    window.addEventListener('offline-queue-changed', handleQueueChange);
    window.addEventListener('online', handleQueueChange);
    window.addEventListener('offline', handleQueueChange);

    return () => {
      window.removeEventListener('offline-queue-changed', handleQueueChange);
      window.removeEventListener('online', handleQueueChange);
      window.removeEventListener('offline', handleQueueChange);
    };
  }, [page, filterMonth]);

  // Fetch setting form enabled dari DB
  useEffect(() => {
    getSetting('form_limbah_padat_enabled', true).then(val => setFormEnabled(val));

    // Sinkronisasi setting antar tab/komponen via custom event
    const onSettingChange = (e) => {
      if (e.detail?.key === 'form_limbah_padat_enabled') {
        setFormEnabled(e.detail.value);
      }
    };
    window.addEventListener('app-setting-changed', onSettingChange);
    return () => window.removeEventListener('app-setting-changed', onSettingChange);
  }, []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    const payload = {
      tanggal: formData.tanggal,
      petugas: user?.nama || 'Petugas',
      infeksius: parseFloat(formData.infeksius) || 0,
      jarum_suntik: parseFloat(formData.jarum_suntik) || 0,
      botol_obat: parseFloat(formData.botol_obat) || 0,
      sitotoksik: parseFloat(formData.sitotoksik) || 0,
      waktu_input: new Date().toISOString()
    };

    try {
      if (!navigator.onLine) {
        saveToOfflineQueue('limbah_padat', formData.id ? 'update' : 'insert', formData.id ? { ...payload, id: formData.id } : payload, 'Input Limbah Padat');
        MySwal.fire({
          icon: 'info',
          title: 'Tersimpan Offline',
          text: 'Data telah disimpan di HP (Draft). Akan otomatis dikirim saat terhubung internet.',
          confirmButtonColor: '#059669'
        });
      } else {
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
      if (!navigator.onLine || error.message?.includes('Failed to fetch') || error.message?.includes('network')) {
        saveToOfflineQueue('limbah_padat', formData.id ? 'update' : 'insert', formData.id ? { ...payload, id: formData.id } : payload, 'Input Limbah Padat');
        MySwal.fire({
          icon: 'info',
          title: 'Tersimpan Offline',
          text: 'Jaringan terputus. Data telah disimpan di HP (Draft) dan akan dikirim otomatis.',
          confirmButtonColor: '#059669'
        });
        setFormData({
          id: null,
          tanggal: new Date().toISOString().split('T')[0],
          infeksius: '',
          jarum_suntik: '',
          botol_obat: '',
          sitotoksik: ''
        });
      } else {
        MySwal.fire('Gagal', error.message, 'error');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (item) => {
    if (item.isRoomAccumulation && !item.isManual) {
      const roomNamesArr = Array.from(item.ruanganNames || []);
      MySwal.fire({
        icon: 'info',
        title: 'Akumulasi Data Ruangan',
        html: `Data tanggal <strong>${new Date(item.tanggal).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</strong> ini merupakan akumulasi otomatis dari <strong>${item.ruanganCount} ruangan</strong>:<br/><br/>
        <div class="text-left bg-gray-100 p-3 rounded-lg text-xs max-h-40 overflow-y-auto font-mono">
          ${roomNamesArr.map(r => `• ${r}`).join('<br/>')}
        </div><br/>
        <span class="text-xs text-gray-500">Untuk mengedit data rincian per ruangan, silakan gunakan menu <strong>Limbah Per Ruangan</strong>.</span>`,
        confirmButtonColor: '#059669'
      });
      return;
    }

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

  const handleDelete = async (item) => {
    // Baris akumulasi ruangan murni → arahkan ke modul Limbah Per Ruangan
    if (item.isRoomAccumulation && !item.isManual) {
      MySwal.fire({
        icon: 'info',
        title: 'Tidak Bisa Dihapus Langsung',
        text: `Data tanggal ini merupakan akumulasi otomatis dari modul Limbah Per Ruangan. Silakan hapus atau ubah entri spesifik melalui menu "Limbah Per Ruangan".`,
        confirmButtonColor: '#059669'
      });
      return;
    }

    // Tentukan ID yang akan dihapus
    // - Mixed (ruangan + manual): gunakan padatIds yang tersimpan
    // - Manual saja: gunakan item.id langsung
    const isMixed = item.isRoomAccumulation && item.isManual;
    const idsToDelete = isMixed
      ? (item.padatIds || [])
      : (typeof item === 'object' ? [item.id] : [item]);

    if (isMixed && idsToDelete.length === 0) {
      MySwal.fire({
        icon: 'warning',
        title: 'Tidak ada data manual',
        text: 'Tidak ditemukan data input manual pada tanggal ini yang bisa dihapus. Data ruangan harus dihapus dari menu Limbah Per Ruangan.',
        confirmButtonColor: '#059669'
      });
      return;
    }

    const tglLabel = new Date(item.tanggal).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
    const confirmText = isMixed
      ? `Hanya data input manual pada ${tglLabel} yang akan dihapus. Data akumulasi ruangan akan tetap ada.`
      : `Data ${tglLabel} akan dihapus permanen!`;

    const confirm = await MySwal.fire({
      title: 'Hapus Data?',
      text: confirmText,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Ya, Hapus!',
      cancelButtonText: 'Batal'
    });

    if (confirm.isConfirmed) {
      try {
        for (const id of idsToDelete) {
          const { error } = await supabase.from('limbah_padat').delete().eq('id', id);
          if (error) throw error;
        }
        MySwal.fire('Terhapus', isMixed ? 'Data input manual berhasil dihapus.' : 'Data berhasil dihapus.', 'success');
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
             <input id="swal-input-month" type="month" class="swal2-input" value="${filterMonth || new Date().toISOString().slice(0, 7)}">`,
      focusConfirm: false,
      showCancelButton: true,
      confirmButtonText: '<i class="fas fa-file-excel mr-2"></i>Export',
      cancelButtonText: 'Batal',
      preConfirm: () => document.getElementById('swal-input-month').value
    });

    if (!selectedMonth) return;

    MySwal.fire({ title: 'Mengambil Data...', allowOutsideClick: false, didOpen: () => MySwal.showLoading() });

    try {
      const exportData = await getAccumulatedData(selectedMonth);
      exportData.sort((a, b) => a.tanggal.localeCompare(b.tanggal));

      if (!exportData || exportData.length === 0) {
        MySwal.fire('Informasi', 'Tidak ada data untuk bulan ini.', 'info');
        return;
      }

      const [year, month] = selectedMonth.split('-');
      const monthNames = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
      const monthLabel = `${monthNames[parseInt(month) - 1]} ${year}`;

      // Build worksheet rows
      const wsData = [];
      wsData.push(['LAPORAN LIMBAH MEDIS PADAT (AKUMULASI HARIAN)']);
      wsData.push([`Periode: ${monthLabel}`]);
      wsData.push([`Dicetak: ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}`]);
      wsData.push([]); // blank row

      wsData.push(['No.', 'Tanggal', 'Limbah Infeksius (Kg)', 'Jarum Suntik (Kg)', 'Botol Obat (Kg)', 'Sitotoksik (Kg)', 'Total Harian (Kg)', 'Keterangan Sumber']);

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

        let sourceInfo = [];
        if (item.ruanganCount > 0) sourceInfo.push(`Akumulasi ${item.ruanganCount} ruangan (${Array.from(item.ruanganNames).join(', ')})`);
        if (item.isManual) sourceInfo.push('Input Manual');

        wsData.push([
          idx + 1,
          new Date(item.tanggal).toLocaleDateString('id-ID'),
          inf,
          jar,
          bot,
          sit,
          total,
          sourceInfo.join(' & ')
        ]);
      });

      // Total row
      const grandTotal = totalInfeksius + totalJarum + totalBotol + totalSito;
      wsData.push([]);
      wsData.push(['TOTAL BULANAN', '', totalInfeksius, totalJarum, totalBotol, totalSito, grandTotal]);

      const ws = XLSX.utils.aoa_to_sheet(wsData);

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
      ['', 'Petunjuk: Isi tanggal format DD-MM-YYYY, misal: 15-01-2025', '', '', '', ''],
      [1, '01-01-2025', 0.5, 0.2, 0.1, 0.05],
      [2, '02-01-2025', 0.8, 0.3, 0.15, 0.1],
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
        const wb = XLSX.read(binaryStr, { type: 'binary', cellDates: false });
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

  const formatDateFromExcel = (val) => {
    if (!val) return '';

    if (typeof val === 'number') {
      const date = XLSX.SSF.parse_date_code(val);
      if (date) {
        return `${date.y}-${String(date.m).padStart(2, '0')}-${String(date.d).padStart(2, '0')}`;
      }
    }

    const str = String(val).trim();

    // Cek format dd-mm-yyyy atau dd/mm/yyyy
    const matchId = str.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})$/);
    if (matchId) {
      const [, day, month, year] = matchId;
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }

    // Cek format yyyy-mm-dd atau yyyy/mm/dd
    const matchIso = str.match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})$/);
    if (matchIso) {
      const [, year, month, day] = matchIso;
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }

    return '';
  };

  // ─── PRINT PDF ───────────────────────────────────────────────────────────────
  const handlePrint = async () => {
    const { value: formValues } = await MySwal.fire({
      title: 'Pilih Bulan & Tahun',
      html: `<input id="swal-input-month" type="month" class="swal2-input" value="${filterMonth || new Date().toISOString().slice(0, 7)}">`,
      focusConfirm: false,
      preConfirm: () => document.getElementById('swal-input-month').value
    });

    if (!formValues) return;

    try {
      MySwal.fire({ title: 'Mengambil Data...', allowOutsideClick: false, didOpen: () => MySwal.showLoading() });

      const printData = await getAccumulatedData(formValues);
      printData.sort((a, b) => a.tanggal.localeCompare(b.tanggal));

      if (!printData || printData.length === 0) {
        MySwal.fire('Informasi', 'Tidak ada data untuk bulan ini.', 'info');
        return;
      }

      const [year, month] = formValues.split('-');
      let totalInfeksius = 0, totalJarum = 0, totalBotol = 0, totalSitotoksik = 0, grandTotal = 0;
      const rowsHTML = printData.map((item, index) => {
        const itemTotal = (item.infeksius || 0) + (item.jarum_suntik || 0) + (item.botol_obat || 0) + (item.sitotoksik || 0);
        totalInfeksius += (item.infeksius || 0);
        totalJarum += (item.jarum_suntik || 0);
        totalBotol += (item.botol_obat || 0);
        totalSitotoksik += (item.sitotoksik || 0);
        grandTotal += itemTotal;

        let note = '';
        if (item.ruanganCount > 0) {
          note = `<br/><small style="color:#059669;font-size:10px;">(${item.ruanganCount} Ruangan)</small>`;
        }

        return `<tr>
          <td style="text-align:center;">${index + 1}</td>
          <td>${new Date(item.tanggal).toLocaleDateString('id-ID')}${note}</td>
          <td style="text-align:right;">${(item.infeksius || 0).toFixed(2)}</td>
          <td style="text-align:right;">${(item.jarum_suntik || 0).toFixed(2)}</td>
          <td style="text-align:right;">${(item.botol_obat || 0).toFixed(2)}</td>
          <td style="text-align:right;">${(item.sitotoksik || 0).toFixed(2)}</td>
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

  const Wrapper = embedded ? EmbeddedWrapper : FullWrapper;

  return (
    <Wrapper>
      <div className="container mx-auto px-4 py-8">

        {/* ── Form Input ── */}
        {formEnabled && (
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
        )}

        {/* ── Import / Export Toolbar ── */}
        {formEnabled && (
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
              <div className="text-xs text-gray-500 w-full sm:w-auto sm:flex-1 min-w-0">
                <p><i className="fas fa-info-circle text-blue-400 mr-1"></i>
                  <strong>Import:</strong> Download template terlebih dahulu, isi data, lalu upload.</p>
                <p className="mt-0.5"><i className="fas fa-info-circle text-green-500 mr-1"></i>
                  <strong>Export:</strong> Ekspor data per bulan ke file Excel (.xlsx).</p>
              </div>
            </div>
          </div>
        )}

        {/* ── Tabel Data ── */}
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">

          {/* Info Banner: Akumulasi Ruangan */}
          <div className="bg-emerald-50 border-b border-emerald-200 px-5 py-2.5 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs text-gray-700">
            <span className="font-semibold text-emerald-800 flex items-center gap-1.5">
              <i className="fas fa-layer-group text-emerald-600"></i>
              Keterangan Baris:
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-emerald-200 border-l-2 border-emerald-600 inline-block"></span>
              <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-800 border border-emerald-300 px-1.5 py-px rounded-full font-semibold text-[10px]">
                <i className="fas fa-hospital"></i> N Ruangan
              </span>
              Akumulasi otomatis dari input per ruangan
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-sky-200 border-l-2 border-sky-600 inline-block"></span>
              <span className="inline-flex items-center gap-1 bg-sky-100 text-sky-800 border border-sky-300 px-1.5 py-px rounded-full font-semibold text-[10px]">
                <i className="fas fa-edit"></i> + Manual
              </span>
              Akumulasi ruangan + input manual
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-gray-200 border-l-2 border-gray-400 inline-block"></span>
              Input manual (tanpa data ruangan)
            </span>
          </div>

          {/* Banner Peringatan Data Offline Belum Sinkron */}
          {data.some(i => i.isOffline) && (
            <div className="bg-amber-50 border-b border-amber-200 text-amber-900 px-6 py-3 text-xs sm:text-sm font-medium flex flex-col sm:flex-row items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <i className="fas fa-exclamation-triangle text-amber-600 text-base animate-pulse"></i>
                <span>Terdapat <strong>{data.filter(i => i.isOffline).length} data offline</strong> yang tersimpan di HP dan <strong>belum tersinkronisasi</strong> ke server.</span>
              </div>
              {navigator.onLine && (
                <button
                  onClick={() => syncOfflineQueue(true)}
                  className="bg-amber-600 hover:bg-amber-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-xs"
                >
                  <i className="fas fa-cloud-upload-alt"></i> Sinkronkan Sekarang
                </button>
              )}
            </div>
          )}

          <div className="bg-gray-800 text-white px-6 py-4 flex flex-col md:flex-row justify-between items-center gap-4">
            <h2 className="text-lg font-bold">
              <i className="fas fa-table mr-2"></i> Data Limbah Padat
              <span className="ml-3 text-sm font-normal text-gray-300">({totalData} total data)</span>
            </h2>
            <div className="flex items-center gap-3">
              <input
                type="month"
                value={filterMonth}
                onChange={(e) => {
                  setFilterMonth(e.target.value);
                  setPage(1);
                }}
                className="bg-white text-gray-800 px-3 py-1.5 rounded-lg text-sm border focus:ring-2 focus:ring-blue-500 outline-none"
              />
              <button onClick={handlePrint}
                className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded transition font-medium text-sm">
                <i className="fas fa-print mr-2"></i> Cetak PDF
              </button>
            </div>
          </div>

          {/* ── Tabel: md+ ── */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-100 text-gray-700 text-xs border-b">
                  <th className="px-3 py-2.5">No.</th>
                  <th className="px-3 py-2.5">Tanggal</th>
                  <th className="px-3 py-2.5 text-right">Infeksius</th>
                  <th className="px-3 py-2.5 text-right">Jarum</th>
                  <th className="px-3 py-2.5 text-right">Botol</th>
                  <th className="px-3 py-2.5 text-right">Sitotoksik</th>
                  <th className="px-3 py-2.5 text-center">Aksi</th>
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
                    <i className="fas fa-inbox text-4xl mb-2 block"></i>Belum ada data.
                  </td></tr>
                ) : (
                  data.map((item, idx) => {
                    const rowNo = (page - 1) * itemsPerPage + idx + 1;
                    const isRoomOnly = item.isRoomAccumulation && !item.isManual;
                    const isMixed = item.isRoomAccumulation && item.isManual;
                    let rowClass = 'border-b hover:bg-gray-50 transition-colors';
                    if (item.isOffline) rowClass = 'bg-amber-50/70 hover:bg-amber-100/70 border-l-4 border-l-amber-500 border-b transition-colors';
                    else if (isRoomOnly) rowClass = 'bg-emerald-50/60 hover:bg-emerald-100/60 border-l-4 border-l-emerald-500 border-b transition-colors';
                    else if (isMixed) rowClass = 'bg-sky-50/60 hover:bg-sky-100/60 border-l-4 border-l-sky-500 border-b transition-colors';
                    return (
                      <tr key={item.id} className={rowClass}>
                        <td className="px-3 py-2.5 text-gray-400 text-xs">{rowNo}</td>
                        <td className="px-3 py-2.5 font-medium text-gray-800">
                          <div className="flex flex-col gap-0.5">
                            <span className="text-xs whitespace-nowrap">{new Date(item.tanggal).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                            <div className="flex flex-wrap gap-1">
                              {isRoomOnly && <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 px-1.5 py-px rounded-full"><i className="fas fa-hospital"></i>{item.ruanganCount} Ruangan</span>}
                              {isMixed && <><span className="inline-flex items-center gap-1 text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 px-1.5 py-px rounded-full"><i className="fas fa-hospital"></i>{item.ruanganCount}R</span><span className="inline-flex items-center gap-1 text-[10px] font-bold bg-sky-100 text-sky-800 border border-sky-300 px-1.5 py-px rounded-full"><i className="fas fa-edit"></i>+Manual</span></>}
                              {item.isOffline && <span className="inline-flex items-center gap-1 text-[10px] font-extrabold bg-amber-200 text-amber-900 border border-amber-400 px-1.5 py-px rounded-full animate-pulse"><i className="fas fa-wifi-slash"></i>Draft</span>}
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-right text-red-600 font-semibold text-xs">{parseFloat(item.infeksius || 0).toFixed(2)}</td>
                        <td className="px-3 py-2.5 text-right text-orange-600 font-semibold text-xs">{parseFloat(item.jarum_suntik || 0).toFixed(2)}</td>
                        <td className="px-3 py-2.5 text-right text-blue-600 font-semibold text-xs">{parseFloat(item.botol_obat || 0).toFixed(2)}</td>
                        <td className="px-3 py-2.5 text-right text-purple-600 font-semibold text-xs">{parseFloat(item.sitotoksik || 0).toFixed(2)}</td>
                        <td className="px-3 py-2.5 text-center">
                          {isRoomOnly ? (
                            <button onClick={() => handleEdit(item)} className="bg-emerald-100 text-emerald-700 hover:bg-emerald-200 px-2 py-1 rounded text-xs" title="Lihat Detail"><i className="fas fa-eye"></i></button>
                          ) : (
                            <>
                              <button onClick={() => handleEdit(item)} className="bg-blue-100 text-blue-600 hover:bg-blue-200 px-2 py-1 rounded mx-0.5 text-xs"><i className="fas fa-edit"></i></button>
                              <button onClick={() => handleDelete(item)} className="bg-red-100 text-red-600 hover:bg-red-200 px-2 py-1 rounded mx-0.5 text-xs"><i className="fas fa-trash"></i></button>
                            </>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* ── Card list: mobile only ── */}
          <div className="md:hidden divide-y divide-gray-100">
            {loading ? (
              <div className="text-center py-10">
                <i className="fas fa-spinner fa-spin text-blue-500 text-2xl"></i>
                <p className="text-gray-500 text-xs mt-2">Memuat data...</p>
              </div>
            ) : data.length === 0 ? (
              <div className="text-center py-10 text-gray-400">
                <i className="fas fa-inbox text-3xl mb-2 block opacity-50"></i>
                <p className="text-xs">Belum ada data.</p>
              </div>
            ) : (
              data.map((item, idx) => {
                const rowNo = (page - 1) * itemsPerPage + idx + 1;
                const isRoomOnly = item.isRoomAccumulation && !item.isManual;
                const isMixed = item.isRoomAccumulation && item.isManual;
                const borderColor = item.isOffline ? 'border-l-amber-500' : isRoomOnly ? 'border-l-emerald-500' : isMixed ? 'border-l-sky-500' : 'border-l-gray-300';
                return (
                  <div key={item.id} className={`flex items-start gap-3 px-4 py-3 border-l-4 ${borderColor}`}>
                    <span className="text-[10px] text-gray-400 font-bold pt-0.5 w-5 shrink-0">{rowNo}</span>
                    <div className="flex-1 min-w-0">
                      {/* Baris atas: tanggal + badges */}
                      <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
                        <span className="text-xs font-bold text-gray-800">{new Date(item.tanggal).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                        {isRoomOnly && <span className="inline-flex items-center gap-1 text-[9px] font-bold bg-emerald-100 text-emerald-800 px-1.5 py-px rounded-full"><i className="fas fa-hospital"></i>{item.ruanganCount}R</span>}
                        {isMixed && <><span className="inline-flex items-center gap-1 text-[9px] font-bold bg-emerald-100 text-emerald-800 px-1.5 py-px rounded-full"><i className="fas fa-hospital"></i>{item.ruanganCount}R</span><span className="inline-flex items-center gap-1 text-[9px] font-bold bg-sky-100 text-sky-800 px-1.5 py-px rounded-full">+Manual</span></>}
                        {item.isOffline && <span className="inline-flex items-center gap-1 text-[9px] font-bold bg-amber-200 text-amber-900 px-1.5 py-px rounded-full animate-pulse">Draft</span>}
                      </div>
                      {/* Grid nilai 4 kolom */}
                      <div className="grid grid-cols-4 gap-x-2 gap-y-0.5 text-[10px]">
                        <div><span className="text-gray-400">Infeksius</span><br /><span className="font-bold text-red-600">{parseFloat(item.infeksius || 0).toFixed(2)}</span></div>
                        <div><span className="text-gray-400">Jarum</span><br /><span className="font-bold text-orange-600">{parseFloat(item.jarum_suntik || 0).toFixed(2)}</span></div>
                        <div><span className="text-gray-400">Botol</span><br /><span className="font-bold text-blue-600">{parseFloat(item.botol_obat || 0).toFixed(2)}</span></div>
                        <div><span className="text-gray-400">Sito</span><br /><span className="font-bold text-purple-600">{parseFloat(item.sitotoksik || 0).toFixed(2)}</span></div>
                      </div>
                    </div>
                    {/* Aksi */}
                    <div className="flex gap-1 shrink-0">
                      {isRoomOnly ? (
                        <button onClick={() => handleEdit(item)} className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs" title="Lihat Detail"><i className="fas fa-eye"></i></button>
                      ) : (
                        <>
                          <button onClick={() => handleEdit(item)} className="w-7 h-7 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center text-xs"><i className="fas fa-edit"></i></button>
                          <button onClick={() => handleDelete(item)} className="w-7 h-7 rounded-lg bg-red-100 text-red-600 flex items-center justify-center text-xs"><i className="fas fa-trash"></i></button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Pagination */}
          {totalPages > 0 && (
            <div className="flex justify-between items-center px-6 py-4 bg-gray-50 border-t text-sm">
              <div className="flex items-center space-x-2 text-gray-600">
                <span>Halaman</span>
                <input
                  type="number"
                  min="1"
                  max={totalPages}
                  value={page}
                  onChange={(e) => {
                    let val = parseInt(e.target.value);
                    if (isNaN(val) || val < 1) val = 1;
                    if (val > totalPages) val = totalPages;
                    setPage(val);
                  }}
                  className="w-16 px-2 py-1 border rounded text-center outline-none focus:ring-2 focus:ring-blue-500"
                />
                <span>dari {totalPages}</span>
              </div>
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
    </Wrapper>
  );
}