import { useState, useEffect, useRef } from 'react';
import AppLayout from '../components/AppLayout';
import { supabase } from '../lib/supabase';
import Swal from 'sweetalert2';
import withReactContent from 'sweetalert2-react-content';
import { getCurrentUser, fetchDaftarRuangan } from '../lib/api';
import { saveToOfflineQueue, getUnsyncedItemsForTable, syncOfflineQueue, removeOfflineQueueItem, removeLocalRecordQueue } from '../lib/offlineStorage';
import * as XLSX from 'xlsx';
import SearchableBottomSheet from '../components/SearchableBottomSheet';

const MySwal = withReactContent(Swal);

// Di luar (di atas) function LimbahRuangan, di top-level file:
function EmbeddedWrapper({ children }) {
  return <div className="bg-gray-100 min-h-screen">{children}</div>;
}

function FullWrapper({ children }) {
  return <AppLayout title="Limbah Per Ruangan">{children}</AppLayout>;
}

export default function LimbahRuangan({ embedded = false }) {
  const user = getCurrentUser();
  const [data, setData] = useState([]);
  const [ruanganList, setRuanganList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [page, setPage] = useState(1);
  const [totalData, setTotalData] = useState(0);
  const [filterMonth, setFilterMonth] = useState('');
  const [filterRuangan, setFilterRuangan] = useState('');
  const itemsPerPage = 10;
  const importInputRef = useRef(null);
  const [showRuanganSheet, setShowRuanganSheet] = useState(false);

  // Form State
  const emptyForm = {
    id: null,
    tanggal: new Date().toISOString().split('T')[0],
    ruangan: '',
    infeksius: '',
    jarum_suntik: '',
    botol_obat: '',
    sitotoksik: '',
    keterangan: ''
  };

  const [formData, setFormData] = useState(emptyForm);

  // Fetch daftar ruangan dinamis dari tabel database 'ruangan'
  const fetchRuanganList = async () => {
    const list = await fetchDaftarRuangan();
    setRuanganList(list);
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      let dbData = [];
      let count = 0;

      try {
        let queryCount = supabase
          .from('limbah_ruangan')
          .select('id', { count: 'exact', head: true });

        if (filterMonth) {
          const [year, month] = filterMonth.split('-');
          const startOfMonth = `${year}-${month}-01`;
          const lastDay = new Date(year, month, 0).getDate();
          const endOfMonth = `${year}-${month}-${String(lastDay).padStart(2, '0')}`;
          queryCount = queryCount.gte('tanggal', startOfMonth).lte('tanggal', endOfMonth);
        }

        if (filterRuangan) {
          queryCount = queryCount.eq('ruangan', filterRuangan);
        }

        const { count: c } = await queryCount;
        count = c || 0;

        const from = (page - 1) * itemsPerPage;
        const to = from + itemsPerPage - 1;

        let queryData = supabase
          .from('limbah_ruangan')
          .select('id, tanggal, ruangan, infeksius, jarum_suntik, botol_obat, sitotoksik, petugas, keterangan, waktu_input')
          .order('tanggal', { ascending: false })
          .order('waktu_input', { ascending: false })
          .range(from, to);

        if (filterMonth) {
          const [year, month] = filterMonth.split('-');
          const startOfMonth = `${year}-${month}-01`;
          const lastDay = new Date(year, month, 0).getDate();
          const endOfMonth = `${year}-${month}-${String(lastDay).padStart(2, '0')}`;
          queryData = queryData.gte('tanggal', startOfMonth).lte('tanggal', endOfMonth);
        }

        if (filterRuangan) {
          queryData = queryData.eq('ruangan', filterRuangan);
        }

        const { data: result, error } = await queryData;
        if (!error) dbData = result || [];
      } catch (e) {
        console.warn('Handling offline or network error during DB fetch:', e);
      }

      // Ambil data offline queue yang belum tersinkron
      let unsynced = getUnsyncedItemsForTable('limbah_ruangan');

      if (filterMonth) {
        unsynced = unsynced.filter(item => item.tanggal && item.tanggal.startsWith(filterMonth));
      }
      if (filterRuangan) {
        unsynced = unsynced.filter(item => item.ruangan === filterRuangan);
      }

      const unsyncedIds = new Set(unsynced.map(u => String(u.id)));
      const filteredDbData = dbData.filter(d => !unsyncedIds.has(String(d.id)));

      const combined = [...unsynced, ...filteredDbData];
      setData(combined);
      setTotalData((count || 0) + unsynced.length);
    } catch (error) {
      console.error('Error fetching limbah ruangan data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRuanganList();
  }, []);

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
  }, [page, filterMonth, filterRuangan]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.ruangan) {
      MySwal.fire('Peringatan', 'Silakan pilih ruangan terlebih dahulu!', 'warning');
      return;
    }

    setSubmitting(true);

    const payload = {
      tanggal: formData.tanggal,
      ruangan: formData.ruangan,
      petugas: user?.nama || 'Petugas',
      infeksius: parseFloat(formData.infeksius) || 0,
      jarum_suntik: parseFloat(formData.jarum_suntik) || 0,
      botol_obat: parseFloat(formData.botol_obat) || 0,
      sitotoksik: parseFloat(formData.sitotoksik) || 0,
      keterangan: formData.keterangan || '',
      waktu_input: new Date().toISOString()
    };

    try {
      if (!navigator.onLine) {
        saveToOfflineQueue('limbah_ruangan', formData.id ? 'update' : 'insert', formData.id ? { ...payload, id: formData.id } : payload, `Input Limbah Ruangan ${formData.ruangan}`);
        MySwal.fire({
          icon: 'info',
          title: 'Tersimpan Offline',
          text: 'Data telah disimpan di HP (Draft). Akan otomatis dikirim saat terhubung internet.',
          confirmButtonColor: '#059669'
        });
      } else {
        if (formData.id) {
          const { error } = await supabase
            .from('limbah_ruangan')
            .update(payload)
            .eq('id', formData.id);
          if (error) throw error;
          MySwal.fire('Berhasil', 'Data limbah ruangan berhasil diubah', 'success');
        } else {
          const { error } = await supabase
            .from('limbah_ruangan')
            .insert([payload]);
          if (error) throw error;
          MySwal.fire('Berhasil', 'Data limbah ruangan berhasil ditambahkan', 'success');
        }
      }

      setFormData(emptyForm);
      fetchData();
    } catch (error) {
      if (!navigator.onLine || error.message?.includes('Failed to fetch') || error.message?.includes('network')) {
        saveToOfflineQueue('limbah_ruangan', formData.id ? 'update' : 'insert', formData.id ? { ...payload, id: formData.id } : payload, `Input Limbah Ruangan ${formData.ruangan}`);
        MySwal.fire({
          icon: 'info',
          title: 'Tersimpan Offline',
          text: 'Jaringan terputus. Data telah disimpan di HP (Draft) dan akan dikirim otomatis.',
          confirmButtonColor: '#059669'
        });
        setFormData(emptyForm);
      } else {
        MySwal.fire('Gagal', error.message, 'error');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (item) => {
    setFormData({
      id: item.id,
      tanggal: item.tanggal,
      ruangan: item.ruangan,
      infeksius: item.infeksius,
      jarum_suntik: item.jarum_suntik,
      botol_obat: item.botol_obat,
      sitotoksik: item.sitotoksik,
      keterangan: item.keterangan || ''
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (item) => {
    const confirm = await MySwal.fire({
      title: 'Hapus Data Limbah Ruangan?',
      text: "Data yang dihapus tidak dapat dikembalikan!",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Ya, Hapus!'
    });

    if (!confirm.isConfirmed) return;

    try {
      // Jika ini adalah draft insert (belum ada di server), hapus sepenuhnya dari lokal
      if (item.isOffline && item.offlineAction === 'insert') {
        removeLocalRecordQueue(item);
        MySwal.fire('Terhapus', 'Draft offline berhasil dihapus', 'success');
        fetchData();
        return;
      }

      // Bersihkan antrean update offline agar tidak konflik dengan delete
      removeLocalRecordQueue(item);

      if (!navigator.onLine) {
        saveToOfflineQueue('limbah_ruangan', 'delete', { id: item.id }, `Hapus Limbah Ruangan ${item.ruangan || ''}`);
        MySwal.fire({
          icon: 'info',
          title: 'Tersimpan Offline',
          text: 'Perintah hapus disimpan di HP. Akan diproses otomatis saat terhubung internet.',
          confirmButtonColor: '#059669'
        });
        fetchData();
        return;
      }

      const { error } = await supabase.from('limbah_ruangan').delete().eq('id', item.id);
      if (error) throw error;
      MySwal.fire('Terhapus', 'Data berhasil dihapus', 'success');
      fetchData();
    } catch (error) {
      if (!navigator.onLine || error.message?.includes('Failed to fetch') || error.message?.includes('network')) {
        saveToOfflineQueue('limbah_ruangan', 'delete', { id: item.id }, `Hapus Limbah Ruangan ${item.ruangan || ''}`);
        MySwal.fire({
          icon: 'info',
          title: 'Tersimpan Offline',
          text: 'Jaringan terputus. Perintah hapus disimpan dan akan diproses otomatis.',
          confirmButtonColor: '#059669'
        });
        fetchData();
      } else {
        MySwal.fire('Gagal', error.message, 'error');
      }
    }
  };

  // ─── EXPORT EXCEL ────────────────────────────────────────────────────────────
  const handleExportExcel = async () => {
    const { value: formValues } = await MySwal.fire({
      title: 'Export Data Limbah Per Ruangan',
      html: `
        <div class="text-left space-y-3">
          <div>
            <label class="block text-xs font-bold text-gray-600 mb-1">Pilih Bulan & Tahun:</label>
            <input id="swal-export-month" type="month" class="swal2-input w-full m-0" value="${new Date().toISOString().slice(0, 7)}">
          </div>
          <div>
            <label class="block text-xs font-bold text-gray-600 mb-1">Filter Ruangan (Opsional):</label>
            <select id="swal-export-ruangan" class="swal2-select w-full m-0">
              <option value="">-- Semua Ruangan --</option>
              ${ruanganList.map(r => `<option value="${r}">${r}</option>`).join('')}
            </select>
          </div>
        </div>
      `,
      focusConfirm: false,
      showCancelButton: true,
      confirmButtonText: '<i class="fas fa-file-excel mr-2"></i>Export Excel',
      cancelButtonText: 'Batal',
      preConfirm: () => {
        return {
          month: document.getElementById('swal-export-month').value,
          ruangan: document.getElementById('swal-export-ruangan').value
        };
      }
    });

    if (!formValues || !formValues.month) return;

    const { month: selectedMonth, ruangan: selectedRuangan } = formValues;
    const [year, month] = selectedMonth.split('-');
    const startOfMonth = `${year}-${month}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const endOfMonth = `${year}-${month}-${String(lastDay).padStart(2, '0')}`;

    MySwal.fire({ title: 'Mengambil Data...', allowOutsideClick: false, didOpen: () => MySwal.showLoading() });

    try {
      let query = supabase
        .from('limbah_ruangan')
        .select('tanggal, ruangan, infeksius, jarum_suntik, botol_obat, sitotoksik, petugas, keterangan')
        .gte('tanggal', startOfMonth)
        .lte('tanggal', endOfMonth)
        .order('tanggal', { ascending: true });

      if (selectedRuangan) {
        query = query.eq('ruangan', selectedRuangan);
      }

      const { data: exportData, error } = await query;

      if (error) throw error;

      if (!exportData || exportData.length === 0) {
        MySwal.fire('Informasi', 'Tidak ada data untuk filter yang dipilih.', 'info');
        return;
      }

      const monthNames = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
      const monthLabel = `${monthNames[parseInt(month) - 1]} ${year}`;

      const wsData = [];
      wsData.push(['LAPORAN LIMBAH MEDIS PADAT PER RUANGAN']);
      wsData.push([`Periode: ${monthLabel}` + (selectedRuangan ? ` | Ruangan: ${selectedRuangan}` : '')]);
      wsData.push([`Dicetak: ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}`]);
      wsData.push([]);

      wsData.push(['No.', 'Tanggal', 'Ruangan', 'Infeksius (Kg)', 'Jarum Suntik (Kg)', 'Botol Obat (Kg)', 'Sitotoksik (Kg)', 'Total (Kg)', 'Petugas', 'Keterangan']);

      let totalInf = 0, totalJar = 0, totalBot = 0, totalSit = 0;

      exportData.forEach((item, idx) => {
        const inf = parseFloat(item.infeksius) || 0;
        const jar = parseFloat(item.jarum_suntik) || 0;
        const bot = parseFloat(item.botol_obat) || 0;
        const sit = parseFloat(item.sitotoksik) || 0;
        const total = inf + jar + bot + sit;

        totalInf += inf;
        totalJar += jar;
        totalBot += bot;
        totalSit += sit;

        wsData.push([
          idx + 1,
          new Date(item.tanggal).toLocaleDateString('id-ID'),
          item.ruangan,
          inf,
          jar,
          bot,
          sit,
          total,
          item.petugas || '',
          item.keterangan || ''
        ]);
      });

      wsData.push([
        '', 'TOTAL', '',
        totalInf, totalJar, totalBot, totalSit,
        totalInf + totalJar + totalBot + totalSit,
        '', ''
      ]);

      const ws = XLSX.utils.aoa_to_sheet(wsData);

      ws['!cols'] = [
        { wch: 5 }, { wch: 14 }, { wch: 24 }, { wch: 16 }, { wch: 18 },
        { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 18 }, { wch: 24 }
      ];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, `Limbah Ruangan ${monthLabel}`);
      XLSX.writeFile(wb, `Laporan_Limbah_Ruangan_${selectedRuangan ? selectedRuangan + '_' : ''}${monthLabel.replace(' ', '_')}.xlsx`);

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
    const exampleRoom = ruanganList[0] || 'Poli Jantung';
    const exampleRoom2 = ruanganList[1] || 'Cempaka';

    const templateData = [
      ['No.', 'Tanggal', 'Ruangan', 'Limbah Infeksius (Kg)', 'Jarum Suntik (Kg)', 'Botol Obat (Kg)', 'Sitotoksik (Kg)', 'Keterangan'],
      ['', 'Format: YYYY-MM-DD (contoh: 2025-01-15)', 'Pilih dari daftar ruangan yang valid', '', '', '', '', ''],
      [1, '2025-01-15', exampleRoom, 1.5, 0.5, 0.2, 0, 'Rutin'],
      [2, '2025-01-15', exampleRoom2, 2.0, 0.8, 0.4, 0.1, 'Rutin']
    ];

    const ws = XLSX.utils.aoa_to_sheet(templateData);
    ws['!cols'] = [
      { wch: 5 }, { wch: 16 }, { wch: 24 }, { wch: 22 }, { wch: 18 }, { wch: 16 }, { wch: 16 }, { wch: 20 }
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Template Limbah Ruangan');
    XLSX.writeFile(wb, 'Template_Import_Limbah_Ruangan.xlsx');
  };

  // ─── IMPORT EXCEL ────────────────────────────────────────────────────────────
  const handleImportFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    e.target.value = '';

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const binaryStr = evt.target.result;
        const wb = XLSX.read(binaryStr, { type: 'binary', cellDates: false });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

        let headerIdx = -1;
        for (let i = 0; i < rows.length; i++) {
          const rowStr = rows[i].join('').toLowerCase();
          if (rowStr.includes('tanggal') && rowStr.includes('ruangan')) {
            headerIdx = i;
            break;
          }
        }

        if (headerIdx === -1) {
          MySwal.fire('Format Salah', 'Header Tanggal dan Ruangan tidak ditemukan. Gunakan template yang disediakan.', 'error');
          return;
        }

        const dataRows = rows.slice(headerIdx + 1).filter(row => {
          const tgl = row[1];
          const rng = row[2];
          return tgl && String(tgl).trim() !== '' && rng && String(rng).trim() !== '' &&
            !String(tgl).toLowerCase().includes('format') && !String(tgl).toLowerCase().includes('total');
        });

        if (dataRows.length === 0) {
          MySwal.fire('Tidak Ada Data', 'Tidak ditemukan baris data yang valid di file.', 'warning');
          return;
        }

        const parseDate = (val) => {
          if (!val) return '';
          if (typeof val === 'number') {
            const date = XLSX.SSF.parse_date_code(val);
            if (date) return `${date.y}-${String(date.m).padStart(2, '0')}-${String(date.d).padStart(2, '0')}`;
          }
          const str = String(val).trim();
          const matchId = str.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})$/);
          if (matchId) return `${matchId[3]}-${matchId[2].padStart(2, '0')}-${matchId[1].padStart(2, '0')}`;
          const matchIso = str.match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})$/);
          if (matchIso) return `${matchIso[1]}-${matchIso[2].padStart(2, '0')}-${matchIso[3].padStart(2, '0')}`;
          return '';
        };

        const payloads = dataRows.map(row => ({
          tanggal: parseDate(row[1]),
          ruangan: String(row[2]).trim(),
          infeksius: parseFloat(row[3]) || 0,
          jarum_suntik: parseFloat(row[4]) || 0,
          botol_obat: parseFloat(row[5]) || 0,
          sitotoksik: parseFloat(row[6]) || 0,
          keterangan: row[7] ? String(row[7]).trim() : '',
          petugas: user?.nama || 'Petugas',
          waktu_input: new Date().toISOString()
        })).filter(p => p.tanggal && p.ruangan);

        if (payloads.length === 0) {
          MySwal.fire('Gagal', 'Tidak ada baris dengan tanggal dan ruangan yang valid.', 'error');
          return;
        }

        const { isConfirmed } = await MySwal.fire({
          title: 'Konfirmasi Import',
          html: `<p>Ditemukan <strong>${payloads.length} data limbah ruangan</strong>. Lanjutkan import ke database?</p>`,
          icon: 'question',
          showCancelButton: true,
          confirmButtonColor: '#059669',
          confirmButtonText: 'Ya, Import!'
        });

        if (!isConfirmed) return;

        setImporting(true);
        MySwal.fire({ title: 'Mengimport Data...', allowOutsideClick: false, didOpen: () => MySwal.showLoading() });

        const batchSize = 50;
        let inserted = 0;
        for (let i = 0; i < payloads.length; i += batchSize) {
          const batch = payloads.slice(i, i + batchSize);
          const { error } = await supabase.from('limbah_ruangan').insert(batch);
          if (error) throw error;
          inserted += batch.length;
        }

        fetchData();
        MySwal.fire({
          icon: 'success',
          title: 'Import Berhasil!',
          text: `${inserted} data limbah ruangan berhasil diimport.`,
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

  // ─── PRINT PDF ───────────────────────────────────────────────────────────────
  // ─── PRINT PDF ───────────────────────────────────────────────────────────────
  const handlePrint = async () => {
    const currentMonth =
      filterMonth || new Date().toISOString().slice(0, 7);

    const { value: formValues } = await MySwal.fire({
      title: 'Cetak Laporan Limbah Ruangan',
      html: `
      <div style="text-align:left">
        <p style="font-size:13px;color:#6b7280;margin-bottom:12px">
          Pilih periode dan ruangan yang ingin dicetak.
        </p>

        <label
          for="swal-print-month"
          style="display:block;font-size:12px;font-weight:700;color:#374151;margin-bottom:5px"
        >
          Bulan & Tahun
        </label>

        <input
          id="swal-print-month"
          type="month"
          class="swal2-input"
          style="width:100%;margin:0 0 14px 0"
          value="${currentMonth}"
        />

        <label
          for="swal-print-ruangan"
          style="display:block;font-size:12px;font-weight:700;color:#374151;margin-bottom:5px"
        >
          Ruangan
        </label>

        <select
          id="swal-print-ruangan"
          class="swal2-select"
          style="width:100%;margin:0"
        >
          <option value="">-- Semua Ruangan --</option>
          ${ruanganList
          .map(
            (r) =>
              `<option value="${String(r)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')}">
                  ${String(r)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')}
                </option>`
          )
          .join('')}
        </select>
      </div>
    `,
      focusConfirm: false,
      showCancelButton: true,
      confirmButtonText: '<i class="fas fa-print"></i> Cetak',
      cancelButtonText: 'Batal',
      confirmButtonColor: '#2563eb',

      preConfirm: () => {
        const monthInput =
          document.getElementById('swal-print-month');

        const ruanganInput =
          document.getElementById('swal-print-ruangan');

        if (!monthInput?.value) {
          Swal.showValidationMessage(
            'Silakan pilih bulan terlebih dahulu.'
          );
          return false;
        }

        return {
          month: monthInput.value,
          ruangan: ruanganInput?.value || ''
        };
      }
    });

    if (!formValues) return;

    const {
      month: selectedMonth,
      ruangan: selectedRuangan
    } = formValues;

    const [year, month] = selectedMonth.split('-');

    const startOfMonth = `${year}-${month}-01`;

    const lastDay = new Date(
      Number(year),
      Number(month),
      0
    ).getDate();

    const endOfMonth =
      `${year}-${month}-${String(lastDay).padStart(2, '0')}`;

    try {
      MySwal.fire({
        title: 'Menyiapkan Laporan...',
        html: 'Mohon tunggu, data sedang diproses.',
        allowOutsideClick: false,
        allowEscapeKey: false,
        didOpen: () => {
          MySwal.showLoading();
        }
      });

      // =========================================================
      // AMBIL DATA
      // =========================================================

      let query = supabase
        .from('limbah_ruangan')
        .select(`
        tanggal,
        ruangan,
        infeksius,
        jarum_suntik,
        botol_obat,
        sitotoksik,
        petugas,
        keterangan
      `)
        .gte('tanggal', startOfMonth)
        .lte('tanggal', endOfMonth)
        .order('tanggal', { ascending: true })
        .order('ruangan', { ascending: true });

      if (selectedRuangan) {
        query = query.eq('ruangan', selectedRuangan);
      }

      const {
        data: printData,
        error
      } = await query;

      if (error) throw error;

      if (!printData || printData.length === 0) {
        MySwal.fire({
          icon: 'info',
          title: 'Tidak Ada Data',
          text: 'Tidak ada data limbah untuk periode dan ruangan yang dipilih.',
          confirmButtonColor: '#2563eb'
        });

        return;
      }

      // =========================================================
      // HELPER
      // =========================================================

      const numberValue = (value) => {
        const n = parseFloat(value);
        return Number.isFinite(n) ? n : 0;
      };

      const escapeHTML = (value) => {
        return String(value ?? '')
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#039;');
      };

      const formatNumber = (value) => {
        return numberValue(value).toFixed(2);
      };

      const formatDate = (dateString) => {
        if (!dateString) return '-';

        const date = new Date(`${dateString}T00:00:00`);

        if (Number.isNaN(date.getTime())) {
          return escapeHTML(dateString);
        }

        return date.toLocaleDateString('id-ID', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric'
        });
      };

      // =========================================================
      // HITUNG TOTAL
      // =========================================================

      let totalInf = 0;
      let totalJar = 0;
      let totalBot = 0;
      let totalSit = 0;
      let grandTotal = 0;

      // =========================================================
      // BUAT BARIS TABEL
      // =========================================================

      const rowsHTML = printData
        .map((item, index) => {
          const inf = numberValue(item.infeksius);
          const jar = numberValue(item.jarum_suntik);
          const bot = numberValue(item.botol_obat);
          const sit = numberValue(item.sitotoksik);

          const totalHarian =
            inf + jar + bot + sit;

          totalInf += inf;
          totalJar += jar;
          totalBot += bot;
          totalSit += sit;
          grandTotal += totalHarian;

          return `
          <tr>
            <td class="center">${index + 1}</td>

            <td class="nowrap">
              ${formatDate(item.tanggal)}
            </td>

            <td class="room">
              ${escapeHTML(item.ruangan || '-')}
            </td>

            <td class="number infeksius">
              ${formatNumber(inf)}
            </td>

            <td class="number jarum">
              ${formatNumber(jar)}
            </td>

            <td class="number botol">
              ${formatNumber(bot)}
            </td>

            <td class="number sitotoksik">
              ${formatNumber(sit)}
            </td>

            <td class="number total">
              <strong>${formatNumber(totalHarian)}</strong>
            </td>

            <td>
              ${escapeHTML(item.petugas || '-')}
            </td>

            <td>
              ${escapeHTML(item.keterangan || '-')}
            </td>
          </tr>
        `;
        })
        .join('');

      // =========================================================
      // NAMA BULAN
      // =========================================================

      const monthNames = [
        'Januari',
        'Februari',
        'Maret',
        'April',
        'Mei',
        'Juni',
        'Juli',
        'Agustus',
        'September',
        'Oktober',
        'November',
        'Desember'
      ];

      const monthName =
        monthNames[Number(month) - 1];

      const periodeText =
        `${monthName} ${year}`;

      const ruanganText =
        selectedRuangan
          ? `Ruangan: ${escapeHTML(selectedRuangan)}`
          : 'Semua Ruangan';

      const printedDate =
        new Date().toLocaleDateString('id-ID', {
          day: 'numeric',
          month: 'long',
          year: 'numeric'
        });

      // =========================================================
      // HTML LAPORAN
      // =========================================================

      const printHTML = `
<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="UTF-8">

<title>
Laporan Limbah Ruangan - ${periodeText}
</title>

<style>

* {
  box-sizing: border-box;
}

html,
body {
  margin: 0;
  padding: 0;
}

body {
  font-family: Arial, Helvetica, sans-serif;
  color: #111827;
  font-size: 11px;
  line-height: 1.4;
  background: white;
}

.container {
  width: 100%;
  padding: 15mm;
}

/* ==============================
   HEADER
============================== */

.header {
  text-align: center;
  margin-bottom: 15px;
}

.header h1 {
  margin: 0;
  font-size: 17px;
  font-weight: 700;
  text-transform: uppercase;
}

.header h2 {
  margin: 4px 0 0;
  font-size: 14px;
  font-weight: 700;
}

.header p {
  margin: 3px 0;
  font-size: 10px;
  color: #374151;
}

.line {
  border-top: 2px solid #111827;
  margin-top: 10px;
}

/* ==============================
   INFO
============================== */

.info {
  display: flex;
  justify-content: space-between;
  gap: 20px;
  margin-bottom: 10px;
  font-size: 10px;
}

.info-left,
.info-right {
  flex: 1;
}

.info-right {
  text-align: right;
}

/* ==============================
   TABLE
============================== */

table {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
}

thead {
  display: table-header-group;
}

tfoot {
  display: table-footer-group;
}

tr {
  page-break-inside: avoid;
  break-inside: avoid;
}

th,
td {
  border: 1px solid #000;
  padding: 5px 4px;
  vertical-align: middle;
}

th {
  text-align: center;
  font-weight: 700;
  background: #e5e7eb;
}

.center {
  text-align: center;
}

.number {
  text-align: right;
  white-space: nowrap;
}

.nowrap {
  white-space: nowrap;
}

.room {
  font-weight: 600;
}

.total {
  font-weight: 700;
}

.totals {
  font-weight: 700;
  background: #e5e7eb;
}

.totals td {
  border-top: 2px solid #000;
}

/* ==============================
   FOOTER
============================== */

.signature-wrapper {
  margin-top: 35px;
  display: flex;
  justify-content: flex-end;
}

.signature {
  width: 230px;
  text-align: center;
}

.signature .space {
  height: 65px;
}

.signature .name {
  font-weight: 700;
}

/* ==============================
   PRINT
============================== */

@page {
  size: A4 landscape;
  margin: 10mm;
}

@media print {

  body {
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  .container {
    padding: 0;
  }

  .no-print {
    display: none !important;
  }

}

</style>
</head>

<body>

<div class="container">

  <!-- HEADER -->

  <div class="header">

    <h1>
      LAPORAN LIMBAH MEDIS PADAT PER RUANGAN
    </h1>

    <h2>
      RSUD Prof. Dr. W.Z. Johannes Kupang
    </h2>

    <p>
      Periode ${periodeText}
    </p>

    <div class="line"></div>

  </div>

  <!-- INFORMASI -->

  <div class="info">

    <div class="info-left">
      <strong>Periode:</strong>
      ${periodeText}
      <br>

      <strong>Filter:</strong>
      ${ruanganText}
    </div>

    <div class="info-right">
      <strong>Jumlah Data:</strong>
      ${printData.length} data
      <br>

      <strong>Tanggal Cetak:</strong>
      ${printedDate}
    </div>

  </div>

  <!-- TABLE -->

  <table>

    <colgroup>
      <col style="width:4%">
      <col style="width:9%">
      <col style="width:15%">
      <col style="width:9%">
      <col style="width:9%">
      <col style="width:9%">
      <col style="width:9%">
      <col style="width:10%">
      <col style="width:12%">
      <col style="width:14%">
    </colgroup>

    <thead>

      <tr>

        <th rowspan="2">
          No.
        </th>

        <th rowspan="2">
          Tanggal
        </th>

        <th rowspan="2">
          Ruangan
        </th>

        <th colspan="4">
          Jenis Limbah (Kg)
        </th>

        <th rowspan="2">
          Total Harian<br>(Kg)
        </th>

        <th rowspan="2">
          Petugas
        </th>

        <th rowspan="2">
          Keterangan
        </th>

      </tr>

      <tr>

        <th>
          Infeksius
        </th>

        <th>
          Jarum Suntik
        </th>

        <th>
          Botol Obat
        </th>

        <th>
          Sitotoksik
        </th>

      </tr>

    </thead>

    <tbody>

      ${rowsHTML}

    </tbody>

    <tfoot>

      <tr class="totals">

        <td
          colspan="3"
          class="center"
        >
          TOTAL DALAM SEBULAN
        </td>

        <td class="number">
          ${formatNumber(totalInf)}
        </td>

        <td class="number">
          ${formatNumber(totalJar)}
        </td>

        <td class="number">
          ${formatNumber(totalBot)}
        </td>

        <td class="number">
          ${formatNumber(totalSit)}
        </td>

        <td class="number">
          ${formatNumber(grandTotal)}
        </td>

        <td></td>

        <td></td>

      </tr>

    </tfoot>

  </table>

  <!-- TANDA TANGAN -->

  <div class="signature-wrapper">

    <div class="signature">

      <div>
        Mengetahui,
      </div>

      <div class="space"></div>

      <div class="name">
        __________________________
      </div>

      <div>
        Petugas Sanitasi
      </div>

    </div>

  </div>

</div>

<script>

window.onload = function () {

  setTimeout(function () {

    window.focus();

    window.print();

  }, 300);

};

window.onafterprint = function () {

  setTimeout(function () {

    window.close();

  }, 300);

};

</script>

</body>
</html>
`;

      // =========================================================
      // CETAK MENGGUNAKAN IFRAME
      // =========================================================

      MySwal.close();

      const iframe =
        document.createElement('iframe');

      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';
      iframe.style.visibility = 'hidden';

      document.body.appendChild(iframe);

      const iframeDoc =
        iframe.contentWindow.document;

      iframeDoc.open();
      iframeDoc.write(printHTML);
      iframeDoc.close();

      iframe.onload = () => {

        setTimeout(() => {

          try {

            iframe.contentWindow.focus();
            iframe.contentWindow.print();

          } catch (printError) {

            console.error(
              'Print error:',
              printError
            );

            MySwal.fire(
              'Gagal',
              'Browser tidak dapat membuka dialog cetak.',
              'error'
            );

          }

          setTimeout(() => {

            if (iframe.parentNode) {
              iframe.parentNode.removeChild(iframe);
            }

          }, 1500);

        }, 500);

      };

    } catch (error) {

      console.error(
        'Error mencetak laporan:',
        error
      );

      MySwal.fire({
        icon: 'error',
        title: 'Gagal Mencetak',
        text:
          'Terjadi kesalahan saat mengambil data: ' +
          error.message,
        confirmButtonColor: '#dc2626'
      });

    }
  };

  const totalPages = Math.ceil(totalData / itemsPerPage);

  const Wrapper = embedded ? EmbeddedWrapper : FullWrapper;

  return (
    <Wrapper>
      <div className="container mx-auto px-4 py-8">

        {/* Header Title Banner */}
        <div className="bg-linear-to-r from-emerald-600 via-teal-600 to-cyan-700 text-white rounded-2xl shadow-xl p-6 mb-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-black tracking-tight flex items-center gap-3">
                <span className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                  <i className="fas fa-door-open text-xl"></i>
                </span>
                Input Data Limbah Per Ruangan
              </h1>
              <p className="text-emerald-100 text-sm mt-1">
                Catat timbulan limbah medis padat per unit/ruangan rumah sakit.
              </p>
            </div>
            <div className="flex items-center gap-2 bg-white/10 backdrop-blur-md px-4 py-2 rounded-xl border border-white/20 self-start md:self-auto">
              <i className="fas fa-hospital text-emerald-200"></i>
              <span className="text-xs font-bold uppercase tracking-wider">{ruanganList.length} Ruangan Terdaftar</span>
            </div>
          </div>
        </div>

        {/* Form Input */}
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 mb-6 overflow-hidden">
          <div className="bg-emerald-600 text-white px-6 py-4 flex items-center justify-between">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <i className="fas fa-edit"></i>
              {formData.id ? 'Edit Data Limbah Ruangan' : 'Form Input Limbah Ruangan'}
            </h2>
            {formData.id && (
              <span className="text-xs bg-amber-400 text-slate-900 font-bold px-2.5 py-1 rounded-full uppercase">
                Mode Edit
              </span>
            )}
          </div>

          <div className="p-6">
            <form onSubmit={handleSubmit}>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div>
                  <label className="block text-gray-700 font-bold text-sm mb-1">Tanggal</label>
                  <input
                    type="date"
                    name="tanggal"
                    value={formData.tanggal}
                    onChange={handleInputChange}
                    required
                    className="w-full border border-gray-300 rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none text-sm"
                  />
                </div>

                <div>
                  <label className="block text-gray-700 font-bold text-sm mb-1">Ruangan / Unit</label>
                  <button
                    type="button"
                    onClick={() => setShowRuanganSheet(true)}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-left flex items-center justify-between text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none bg-white"
                  >
                    <span className={formData.ruangan ? 'text-gray-800 font-medium' : 'text-gray-400'}>
                      {formData.ruangan || '-- Ketik atau pilih ruangan --'}
                    </span>
                    <i className="fas fa-chevron-down text-gray-400 text-xs" />
                  </button>
                </div>

                <div>
                  <label className="block text-gray-700 font-bold text-sm mb-1">Petugas Input</label>
                  <input
                    type="text"
                    value={user?.nama || 'Petugas'}
                    readOnly
                    className="w-full border border-gray-200 bg-gray-100 text-gray-500 rounded-xl px-3 py-2.5 cursor-not-allowed text-sm font-medium"
                  />
                </div>
              </div>

              {/* Timbulan Limbah per jenis (Kg) */}
              <div className="mb-4">
                <label className="block text-gray-800 font-bold text-sm mb-2">
                  Jumlah Timbulan Limbah (Kg)
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-sm font-semibold text-red-600 mb-1">Infeksius</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      name="infeksius"
                      value={formData.infeksius}
                      onChange={handleInputChange}
                      required
                      placeholder="0.0"
                      className="w-full border border-gray-300 rounded-xl px-3 py-2 focus:ring-2 focus:ring-red-400 outline-none text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-orange-600 mb-1">Jarum Suntik</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      name="jarum_suntik"
                      value={formData.jarum_suntik}
                      onChange={handleInputChange}
                      required
                      placeholder="0.0"
                      className="w-full border border-gray-300 rounded-xl px-3 py-2 focus:ring-2 focus:ring-orange-400 outline-none text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-blue-600 mb-1">Botol Obat</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      name="botol_obat"
                      value={formData.botol_obat}
                      onChange={handleInputChange}
                      required
                      placeholder="0.0"
                      className="w-full border border-gray-300 rounded-xl px-3 py-2 focus:ring-2 focus:ring-blue-400 outline-none text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-purple-600 mb-1">Sitotoksik</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      name="sitotoksik"
                      value={formData.sitotoksik}
                      onChange={handleInputChange}
                      required
                      placeholder="0.0"
                      className="w-full border border-gray-300 rounded-xl px-3 py-2 focus:ring-2 focus:ring-purple-400 outline-none text-sm"
                    />
                  </div>
                </div>
              </div>

              <div className="mb-6">
                <label className="block text-gray-700 font-bold text-sm mb-1">Keterangan (Opsional)</label>
                <input
                  type="text"
                  name="keterangan"
                  value={formData.keterangan}
                  onChange={handleInputChange}
                  placeholder="Catatan khusus, kondisi tempat sampah, dll."
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
                />
              </div>

              <div className="flex justify-end gap-3">
                {formData.id && (
                  <button
                    type="button"
                    onClick={() => setFormData(emptyForm)}
                    className="bg-gray-500 hover:bg-gray-600 text-white px-5 py-2.5 rounded-xl transition text-sm font-semibold"
                  >
                    Batal Edit
                  </button>
                )}
                <button
                  type="submit"
                  disabled={submitting}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white px-7 py-2.5 rounded-xl font-bold transition shadow-md disabled:opacity-50 flex items-center gap-2 text-sm"
                >
                  {submitting ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-save"></i>}
                  {formData.id ? 'Update Data' : 'Simpan Data'}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Toolbar Import / Export Excel */}
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 mb-6 overflow-hidden">
          <div className="bg-teal-700 text-white px-6 py-3 flex items-center justify-between">
            <h2 className="text-base font-bold flex items-center gap-2">
              <i className="fas fa-file-excel"></i> Import & Export Data Excel
            </h2>
          </div>
          <div className="p-5 flex flex-wrap gap-3 items-center">
            <button
              onClick={handleDownloadTemplate}
              className="flex items-center gap-2 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 px-4 py-2.5 rounded-xl font-semibold text-xs sm:text-sm transition active:scale-95 shadow-xs"
            >
              <i className="fas fa-download"></i> Download Template
            </button>

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
                className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl font-semibold text-xs sm:text-sm transition active:scale-95 shadow-xs disabled:opacity-60"
              >
                {importing
                  ? <><i className="fas fa-spinner fa-spin"></i> Mengimport...</>
                  : <><i className="fas fa-upload"></i> Import Excel</>}
              </button>
            </div>

            <button
              onClick={handleExportExcel}
              className="flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white px-4 py-2.5 rounded-xl font-semibold text-xs sm:text-sm transition active:scale-95 shadow-xs"
            >
              <i className="fas fa-file-excel"></i> Export Excel
            </button>
          </div>
        </div>

        {/* Data Table */}
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
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

          <div className="bg-slate-800 text-white px-6 py-4 flex flex-col md:flex-row justify-between items-center gap-4">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <i className="fas fa-table"></i> Data Limbah Per Ruangan
              <span className="ml-2 text-xs font-normal text-slate-300">({totalData} total data)</span>
            </h2>

            <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
              {/* Filter Ruangan */}
              <select
                value={filterRuangan}
                onChange={(e) => {
                  setFilterRuangan(e.target.value);
                  setPage(1);
                }}
                className="bg-white text-gray-800 px-3 py-2 rounded-xl text-xs sm:text-sm border outline-none font-medium max-w-[180px] truncate"
              >
                <option value="">Semua Ruangan</option>
                {ruanganList.map(r => <option key={r} value={r}>{r}</option>)}
              </select>

              {/* Filter Bulan */}
              <input
                type="month"
                value={filterMonth}
                onChange={(e) => {
                  setFilterMonth(e.target.value);
                  setPage(1);
                }}
                className="bg-white text-gray-800 px-3 py-2 rounded-xl text-xs sm:text-sm border outline-none font-medium"
              />

              <button
                onClick={handlePrint}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl transition text-xs sm:text-sm font-semibold flex items-center gap-1.5 shadow-sm"
              >
                <i className="fas fa-print"></i> Cetak PDF
              </button>
            </div>
          </div>

          {/* ── Tabel: md+ ── */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-100 text-gray-700 text-xs uppercase tracking-wider border-b">
                  <th className="px-3 py-2.5 font-bold">No.</th>
                  <th className="px-3 py-2.5 font-bold">Tanggal</th>
                  <th className="px-3 py-2.5 font-bold">Ruangan</th>
                  <th className="px-3 py-2.5 font-bold text-right">Infeksius</th>
                  <th className="px-3 py-2.5 font-bold text-right">Jarum</th>
                  <th className="px-3 py-2.5 font-bold text-right">Botol</th>
                  <th className="px-3 py-2.5 font-bold text-right">Sitotoksik</th>
                  <th className="px-3 py-2.5 font-bold text-right">Total</th>
                  <th className="px-3 py-2.5 font-bold">Petugas</th>
                  <th className="px-3 py-2.5 font-bold text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-xs">
                {loading ? (
                  <tr><td colSpan="10" className="text-center py-10">
                    <i className="fas fa-spinner fa-spin text-emerald-500 text-2xl mb-2 block"></i>
                    <span className="text-gray-500 text-xs font-semibold">Memuat data...</span>
                  </td></tr>
                ) : data.length === 0 ? (
                  <tr><td colSpan="10" className="text-center py-12 text-gray-400">
                    <i className="fas fa-inbox text-4xl mb-3 block opacity-40"></i>Belum ada data limbah ruangan.
                  </td></tr>
                ) : (
                  data.map((item, idx) => {
                    const rowNo = (page - 1) * itemsPerPage + idx + 1;
                    const inf = parseFloat(item.infeksius || 0);
                    const jar = parseFloat(item.jarum_suntik || 0);
                    const bot = parseFloat(item.botol_obat || 0);
                    const sit = parseFloat(item.sitotoksik || 0);
                    const total = inf + jar + bot + sit;
                    return (
                      <tr key={item.id} className={item.isOffline ? "bg-amber-50/70 hover:bg-amber-100/70 border-l-4 border-l-amber-500 transition-colors" : "hover:bg-emerald-50/40 transition-colors"}>
                        <td className="px-3 py-2 text-gray-400 font-medium">{rowNo}</td>
                        <td className="px-3 py-2 font-medium text-gray-800 whitespace-nowrap">
                          {new Date(item.tanggal).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                          {item.isOffline && <span className="ml-1.5 inline-flex items-center gap-1 text-[9px] font-extrabold bg-amber-200 text-amber-900 border border-amber-400 px-1.5 py-px rounded-full shadow-2xs animate-pulse"><i className="fas fa-wifi-slash text-amber-700"></i>Draft</span>}
                        </td>
                        <td className="px-3 py-2 font-bold text-emerald-700">
                          <span className="inline-block bg-emerald-100 text-emerald-800 text-[10px] px-2 py-0.5 rounded-lg">{item.ruangan}</span>
                        </td>
                        <td className="px-3 py-2 text-right text-red-600 font-semibold">{inf.toFixed(2)}</td>
                        <td className="px-3 py-2 text-right text-orange-600 font-semibold">{jar.toFixed(2)}</td>
                        <td className="px-3 py-2 text-right text-blue-600 font-semibold">{bot.toFixed(2)}</td>
                        <td className="px-3 py-2 text-right text-purple-600 font-semibold">{sit.toFixed(2)}</td>
                        <td className="px-3 py-2 text-right font-black text-slate-800">{total.toFixed(2)} Kg</td>
                        <td className="px-3 py-2 text-gray-600">{item.petugas || '-'}</td>
                        <td className="px-3 py-2 text-center whitespace-nowrap">
                          <button onClick={() => handleEdit(item)} className="bg-blue-100 text-blue-600 hover:bg-blue-200 px-2 py-1 rounded-lg mx-0.5 transition active:scale-95 text-xs"><i className="fas fa-edit"></i></button>
                          <button onClick={() => handleDelete(item)} className="bg-red-100 text-red-600 hover:bg-red-200 px-2 py-1 rounded-lg mx-0.5 transition active:scale-95 text-xs"><i className="fas fa-trash"></i></button>
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
                <i className="fas fa-spinner fa-spin text-emerald-500 text-2xl"></i>
                <p className="text-gray-500 text-xs mt-2">Memuat data...</p>
              </div>
            ) : data.length === 0 ? (
              <div className="text-center py-10 text-gray-400">
                <i className="fas fa-inbox text-3xl mb-2 block opacity-50"></i>
                <p className="text-xs">Belum ada data limbah ruangan.</p>
              </div>
            ) : (
              data.map((item, idx) => {
                const rowNo = (page - 1) * itemsPerPage + idx + 1;
                const inf = parseFloat(item.infeksius || 0);
                const jar = parseFloat(item.jarum_suntik || 0);
                const bot = parseFloat(item.botol_obat || 0);
                const sit = parseFloat(item.sitotoksik || 0);
                const total = inf + jar + bot + sit;
                return (
                  <div key={item.id} className={`flex items-start gap-3 px-4 py-3 border-l-4 ${item.isOffline ? 'border-l-amber-500 bg-amber-50/60' : 'border-l-emerald-400'}`}>
                    <span className="text-[10px] text-gray-400 font-bold pt-0.5 w-5 shrink-0">{rowNo}</span>
                    <div className="flex-1 min-w-0">
                      {/* Tanggal + ruangan */}
                      <div className="flex items-center gap-1.5 flex-wrap mb-1">
                        <span className="text-xs font-bold text-gray-800">{new Date(item.tanggal).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                        <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-px rounded-full">{item.ruangan}</span>
                        {item.isOffline && <span className="text-[9px] font-bold bg-amber-200 text-amber-900 px-1.5 py-px rounded-full animate-pulse">Draft</span>}
                      </div>
                      {/* Grid 4 nilai + total */}
                      <div className="grid grid-cols-5 gap-x-1 gap-y-0.5 text-[10px]">
                        <div><span className="text-gray-400">Infeksius</span><br /><span className="font-bold text-red-600">{inf.toFixed(2)}</span></div>
                        <div><span className="text-gray-400">Jarum</span><br /><span className="font-bold text-orange-600">{jar.toFixed(2)}</span></div>
                        <div><span className="text-gray-400">Botol</span><br /><span className="font-bold text-blue-600">{bot.toFixed(2)}</span></div>
                        <div><span className="text-gray-400">Sito</span><br /><span className="font-bold text-purple-600">{sit.toFixed(2)}</span></div>
                        <div><span className="text-gray-400">Total</span><br /><span className="font-black text-slate-800">{total.toFixed(2)}</span></div>
                      </div>
                    </div>
                    {/* Aksi */}
                    <div className="flex gap-1 shrink-0">
                      <button onClick={() => handleEdit(item)} className="w-7 h-7 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center text-xs"><i className="fas fa-edit"></i></button>
                      <button onClick={() => handleDelete(item)} className="w-7 h-7 rounded-lg bg-red-100 text-red-600 flex items-center justify-center text-xs"><i className="fas fa-trash"></i></button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Pagination */}
          {totalPages > 0 && (
            <div className="flex flex-col sm:flex-row justify-between items-center px-6 py-4 bg-gray-50 border-t text-sm gap-3">
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
                  className="w-16 px-2 py-1 border rounded-lg text-center outline-none focus:ring-2 focus:ring-emerald-500 font-bold bg-white text-xs"
                />
                <span>dari {totalPages}</span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-3.5 py-1.5 bg-white border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-100 disabled:opacity-50 transition text-xs font-semibold"
                >
                  Sebelumnya
                </button>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="px-3.5 py-1.5 bg-white border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-100 disabled:opacity-50 transition text-xs font-semibold"
                >
                  Selanjutnya
                </button>
              </div>
            </div>
          )}
        </div>

      </div>
      <SearchableBottomSheet
        isOpen={showRuanganSheet}
        onClose={() => setShowRuanganSheet(false)}
        options={ruanganList}
        value={formData.ruangan}
        onChange={(val) => setFormData(prev => ({ ...prev, ruangan: val }))}
        label="Pilih Ruangan / Unit"
        placeholder="Cari ruangan atau unit..."
        accentColor="emerald"
      />
    </Wrapper>
  );
}
