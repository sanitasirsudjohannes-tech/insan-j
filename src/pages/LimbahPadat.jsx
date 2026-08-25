import { useState, useEffect, useRef } from 'react';
import AppLayout from '../components/AppLayout';
import { supabase } from '../lib/supabase';
import Swal from 'sweetalert2';
import withReactContent from 'sweetalert2-react-content';
import { getCurrentUser, getSetting, getSettingCached } from '../lib/api';
import {
  saveToOfflineQueue,
  getOfflineQueue,
  getUnsyncedItemsForTable,
  removeLocalRecordQueue,
  getOfflineDeletedIds,
  getSyncedServerId,
  syncOfflineQueue,
  getCachedServerRows,
  cacheServerRows,
  removeCachedServerRow,
} from '../lib/offlineStorage';
import { loadExcelLibrary } from '../lib/excelLoader';

import PadatForm, { EMPTY_FORM } from '../components/limbah/padat/PadatForm';
import PadatImportExportToolbar from '../components/limbah/padat/PadatImportExportToolbar';
import PadatTable from '../components/limbah/padat/PadatTable';
import OfflineBanner from '../components/limbah/OfflineBanner';
import Pagination from '../components/limbah/Pagination';
import { buildPadatPrintHTML } from '../components/limbah/padat/padatPrintTemplate';
import { printViaHiddenIframe } from '../lib/printHelpers';
import { formatDateFromExcel } from '../lib/excelDateHelpers';
import { getLocalMonthString } from '../lib/localDate';
import { fetchAllSupabaseRows } from '../lib/supabasePagination';
import { isNetworkError } from '../lib/networkErrors';
import {
  escapeImportHTML,
  insertImportRowsAtomically,
  parseNonNegativeImportNumber,
} from '../lib/excelImport';
import {
  deleteRecordWithVersion,
  getRecordBaseVersion,
  isRecordConflictError,
  resolveOfflineRecordConflict,
  updateRecordWithVersion,
} from '../lib/recordVersion';

const MySwal = withReactContent(Swal);

function EmbeddedWrapper({ children }) { return <div className="bg-gray-100 min-h-screen">{children}</div>; }
function FullWrapper({ children }) { return <AppLayout title="Limbah Padat">{children}</AppLayout>; }

const ITEMS_PER_PAGE = 10;

export default function LimbahPadat({ embedded = false }) {
  const user = getCurrentUser();
  const [data, setData] = useState([]);
  const [accumulatedData, setAccumulatedData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [page, setPage] = useState(1);
  const [totalData, setTotalData] = useState(0);
  const [offlineQueueCount, setOfflineQueueCount] = useState(0);
  const [filterMonth, setFilterMonth] = useState(() => getLocalMonthString());
  const [formEnabled, setFormEnabled] = useState(() => getSettingCached('form_limbah_padat_enabled', true));
  const [formData, setFormData] = useState(EMPTY_FORM);
  const importInputRef = useRef(null);
  const printFrameRef = useRef(null);
  const fetchIdRef = useRef(0);

  // ── Akumulasi data (padat + ruangan) ─────────────────────────────────────────
  const getAccumulatedData = async (targetMonth = null) => {
    let dbPadat = [], dbRuangan = [];
    if (navigator.onLine) {
      try {
        let startDate = null;
        let endDate = null;
        if (targetMonth) {
          const [y, m] = targetMonth.split('-');
          startDate = `${y}-${m}-01`;
          endDate = `${y}-${m}-${String(new Date(y, m, 0).getDate()).padStart(2, '0')}`;
        }

        const buildMonthlyQuery = (table, columns) => {
          let query = supabase.from(table)
            .select(columns)
            .order('tanggal', { ascending: true })
            .order('id', { ascending: true });
          if (startDate && endDate) query = query.gte('tanggal', startDate).lte('tanggal', endDate);
          return query;
        };

        [dbPadat, dbRuangan] = await Promise.all([
          fetchAllSupabaseRows(() => buildMonthlyQuery(
            'limbah_padat',
            'id, tanggal, infeksius, jarum_suntik, botol_obat, sitotoksik, petugas, waktu_input'
          )),
          fetchAllSupabaseRows(() => buildMonthlyQuery(
            'limbah_ruangan',
            'id, tanggal, ruangan, infeksius, jarum_suntik, botol_obat, sitotoksik, petugas, waktu_input'
          )),
        ]);
        cacheServerRows('limbah_padat', dbPadat);
        cacheServerRows('limbah_ruangan', dbRuangan);
      } catch (err) {
        console.warn('Network issue fetching accumulated data:', err);
        dbPadat = getCachedServerRows('limbah_padat');
        dbRuangan = getCachedServerRows('limbah_ruangan');
      }
    } else {
      dbPadat = getCachedServerRows('limbah_padat');
      dbRuangan = getCachedServerRows('limbah_ruangan');
    }

    const allUnsyncedP = getUnsyncedItemsForTable('limbah_padat');
    const allUnsyncedR = getUnsyncedItemsForTable('limbah_ruangan');
    let unsyncedP = allUnsyncedP;
    let unsyncedR = allUnsyncedR;
    if (targetMonth) {
      dbPadat = dbPadat.filter(item => item.tanggal?.startsWith(targetMonth));
      dbRuangan = dbRuangan.filter(item => item.tanggal?.startsWith(targetMonth));
      unsyncedP = unsyncedP.filter(i => i.tanggal?.startsWith(targetMonth));
      unsyncedR = unsyncedR.filter(i => i.tanggal?.startsWith(targetMonth));
    }
    const pIds = new Set(allUnsyncedP.map(u => String(u.id)));
    const rIds = new Set(allUnsyncedR.map(u => String(u.id)));

    const delPIds = new Set(getOfflineDeletedIds('limbah_padat'));
    const delRIds = new Set(getOfflineDeletedIds('limbah_ruangan'));

    const allPadat = [...unsyncedP, ...dbPadat.filter(d => !pIds.has(String(d.id)) && !delPIds.has(String(d.id)))];
    const allRuangan = [...unsyncedR, ...dbRuangan.filter(d => !rIds.has(String(d.id)) && !delRIds.has(String(d.id)))];

    const dateMap = new Map();
    allRuangan.forEach(item => {
      const tgl = item.tanggal; if (!tgl) return;
      if (!dateMap.has(tgl)) dateMap.set(tgl, { id: `agg_${tgl}`, tanggal: tgl, infeksius: 0, jarum_suntik: 0, botol_obat: 0, sitotoksik: 0, ruanganCount: 0, ruanganNames: new Set(), padatIds: [], manualRecords: [], isOffline: false, isRoomAccumulation: true, isManual: false });
      const e = dateMap.get(tgl);
      e.infeksius += parseFloat(item.infeksius || 0); e.jarum_suntik += parseFloat(item.jarum_suntik || 0);
      e.botol_obat += parseFloat(item.botol_obat || 0); e.sitotoksik += parseFloat(item.sitotoksik || 0);
      e.ruanganCount += 1; if (item.ruangan) e.ruanganNames.add(item.ruangan);
      if (item.isOffline) e.isOffline = true;
    });
    allPadat.forEach(item => {
      const tgl = item.tanggal; if (!tgl) return;
      if (!dateMap.has(tgl)) dateMap.set(tgl, { id: item.id || `padat_${tgl}`, tanggal: tgl, infeksius: 0, jarum_suntik: 0, botol_obat: 0, sitotoksik: 0, ruanganCount: 0, ruanganNames: new Set(), padatIds: [], manualRecords: [], isOffline: false, isManual: true });
      const e = dateMap.get(tgl);
      e.infeksius += parseFloat(item.infeksius || 0); e.jarum_suntik += parseFloat(item.jarum_suntik || 0);
      e.botol_obat += parseFloat(item.botol_obat || 0); e.sitotoksik += parseFloat(item.sitotoksik || 0);
      e.isManual = true;
      if (item.id && !e.padatIds.includes(item.id)) e.padatIds.push(item.id);
      e.manualRecords.push(item);
      if (item.isOffline) e.isOffline = true;
    });
    return Array.from(dateMap.values());
  };

  // ── fetchData ─────────────────────────────────────────────────────────────────
  const fetchData = async () => {
    const currentFetchId = ++fetchIdRef.current;
    setLoading(true);
    try {
      setOfflineQueueCount(getOfflineQueue().filter(item => (
        item.table === 'limbah_padat' || item.table === 'limbah_ruangan'
      )).length);
      const accumulated = await getAccumulatedData(filterMonth);
      if (currentFetchId !== fetchIdRef.current) return;

      accumulated.sort((a, b) => b.tanggal.localeCompare(a.tanggal));
      setAccumulatedData(accumulated);
      setTotalData(accumulated.length);

      const lastAvailablePage = Math.max(1, Math.ceil(accumulated.length / ITEMS_PER_PAGE));
      setPage(currentPage => Math.min(currentPage, lastAvailablePage));
    } catch (err) {
      console.error('Error fetching accumulated data:', err);
    } finally {
      if (currentFetchId === fetchIdRef.current) setLoading(false);
    }
  };

  // Pagination dilakukan dari hasil bulan yang sudah dimuat. Mengganti halaman
  // tidak lagi meminta seluruh data limbah yang sama ke Supabase.
  useEffect(() => {
    const from = (page - 1) * ITEMS_PER_PAGE;
    setData(accumulatedData.slice(from, from + ITEMS_PER_PAGE));
  }, [accumulatedData, page]);

  useEffect(() => {
    fetchData();
    const h = () => fetchData();
    let queueRefreshTimer;
    const handleQueueChange = (event) => {
      const relevantTables = ['limbah_padat', 'limbah_ruangan'];
      if (event.changedTables?.length && !event.changedTables.some(table => relevantTables.includes(table))) {
        return;
      }

      window.clearTimeout(queueRefreshTimer);
      queueRefreshTimer = window.setTimeout(h, 180);
    };
    window.addEventListener('offline-queue-changed', handleQueueChange);
    window.addEventListener('online', h);
    window.addEventListener('offline', h);

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        h();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      window.clearTimeout(queueRefreshTimer);
      window.removeEventListener('offline-queue-changed', handleQueueChange);
      window.removeEventListener('online', h);
      window.removeEventListener('offline', h);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [filterMonth]);

  useEffect(() => {
    getSetting('form_limbah_padat_enabled', true).then(setFormEnabled);
    const onSetting = (e) => { if (e.detail?.key === 'form_limbah_padat_enabled') setFormEnabled(e.detail.value); };
    window.addEventListener('app-setting-changed', onSetting);
    return () => window.removeEventListener('app-setting-changed', onSetting);
  }, []);

  useEffect(() => {
    return () => { if (printFrameRef.current?.parentNode) printFrameRef.current.parentNode.removeChild(printFrameRef.current); };
  }, []);

  // ── Handlers form ─────────────────────────────────────────────────────────────
  const handleInputChange = (e) => setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault(); setSubmitting(true);
    const payload = { tanggal: formData.tanggal, petugas: user?.nama || 'Petugas', infeksius: parseFloat(formData.infeksius) || 0, jarum_suntik: parseFloat(formData.jarum_suntik) || 0, botol_obat: parseFloat(formData.botol_obat) || 0, sitotoksik: parseFloat(formData.sitotoksik) || 0, waktu_input: new Date().toISOString() };
    let recordId = formData.id;
    let baseUpdatedAt = formData.baseUpdatedAt || null;
    let isLocalDraft = Boolean(recordId) && String(recordId).startsWith('off_');

    try {
      if (isLocalDraft) {
        recordId = getSyncedServerId(formData.id) || formData.id;
        if (navigator.onLine && String(recordId).startsWith('off_')) {
          await syncOfflineQueue(false, true);
          recordId = getSyncedServerId(formData.id) || formData.id;
        }
        isLocalDraft = String(recordId).startsWith('off_');
      }

      if (!navigator.onLine || isLocalDraft) {
        saveToOfflineQueue(
          'limbah_padat',
          formData.id ? 'update' : 'insert',
          formData.id ? { ...payload, id: recordId } : payload,
          'Input Limbah Padat',
          { baseUpdatedAt }
        );
        MySwal.fire({ icon: 'info', title: 'Tersimpan Offline', text: isLocalDraft && navigator.onLine ? 'Perubahan draft tersimpan dan menunggu sinkronisasi.' : 'Data tersimpan di HP dan akan dikirim otomatis saat online.', confirmButtonColor: '#059669' });
      } else if (formData.id) {
        const pendingRecordUpdate = getOfflineQueue().find(item => {
          if (item.table !== 'limbah_padat') return false;
          return [item.serverId, item.payload?.id, item.payload?.serverId]
            .some(reference => reference != null && String(reference) === String(recordId));
        });
        if (pendingRecordUpdate) {
          await syncOfflineQueue(false, true);
          const stillPending = getOfflineQueue().some(item => item.id === pendingRecordUpdate.id);
          if (!stillPending && pendingRecordUpdate.action === 'update') {
            baseUpdatedAt = pendingRecordUpdate.payload?.waktu_input || baseUpdatedAt;
          }
        }

        await updateRecordWithVersion('limbah_padat', recordId, payload, baseUpdatedAt);
        cacheServerRows('limbah_padat', [{ ...payload, id: recordId }]);
        if (pendingRecordUpdate) removeLocalRecordQueue({ id: recordId });
        MySwal.fire('Berhasil', 'Data berhasil diubah', 'success');
      } else {
        const { error } = await supabase.from('limbah_padat').insert([payload]);
        if (error) throw error;
        MySwal.fire('Berhasil', 'Data berhasil ditambahkan', 'success');
      }
      setFormData(EMPTY_FORM); fetchData();
    } catch (error) {
      if (isNetworkError(error)) {
        saveToOfflineQueue(
          'limbah_padat',
          formData.id ? 'update' : 'insert',
          formData.id ? { ...payload, id: recordId } : payload,
          'Input Limbah Padat',
          { baseUpdatedAt }
        );
        MySwal.fire({ icon: 'info', title: 'Tersimpan Offline', text: 'Jaringan terputus. Data tersimpan di HP.', confirmButtonColor: '#059669' });
        setFormData(EMPTY_FORM);
      } else if (isRecordConflictError(error)) {
        MySwal.fire('Data Sudah Berubah', error.message, 'warning');
        fetchData();
      } else { MySwal.fire('Gagal', error.message, 'error'); }
    } finally { setSubmitting(false); }
  };

  const handleEdit = async (item) => {
    if (item.isRoomAccumulation && !item.isManual) {
      const rooms = Array.from(item.ruanganNames || []);
      MySwal.fire({ icon: 'info', title: 'Akumulasi Data Ruangan', html: `Data ini merupakan akumulasi otomatis dari <strong>${item.ruanganCount} ruangan</strong>:<br><br><div class="text-left bg-gray-100 p-3 rounded-lg text-xs max-h-40 overflow-y-auto font-mono">${rooms.map(r => `• ${r}`).join('<br>')}</div><br><span class="text-xs text-gray-500">Untuk mengedit, gunakan menu <strong>Limbah Per Ruangan</strong>.</span>`, confirmButtonColor: '#059669' });
      return;
    }
    const manualRecords = item.manualRecords || [];
    let selectedRecord = manualRecords[0] || item;

    if (manualRecords.length > 1) {
      const inputOptions = Object.fromEntries(manualRecords.map((record, index) => {
        const total = ['infeksius', 'jarum_suntik', 'botol_obat', 'sitotoksik']
          .reduce((sum, field) => sum + (parseFloat(record[field]) || 0), 0);
        return [String(record.id), `Input ${index + 1} — ${total.toFixed(2)} Kg${record.petugas ? ` (${record.petugas})` : ''}`];
      }));

      const { isConfirmed, value } = await MySwal.fire({
        title: 'Pilih Data Manual',
        input: 'select',
        inputOptions,
        inputPlaceholder: 'Pilih data yang ingin diubah',
        showCancelButton: true,
        confirmButtonText: 'Edit Data',
        cancelButtonText: 'Batal',
        inputValidator: selectedId => selectedId ? undefined : 'Pilih salah satu data manual.',
      });
      if (!isConfirmed || !value) return;
      selectedRecord = manualRecords.find(record => String(record.id) === String(value));
      if (!selectedRecord) return;
    }

    try {
      const resolution = await resolveOfflineRecordConflict('limbah_padat', selectedRecord, MySwal);
      if (!resolution) return;
      if (resolution.discardDraft) removeLocalRecordQueue({ id: selectedRecord.id });
      if (!resolution.record) { fetchData(); return; }
      selectedRecord = resolution.record;
      if (resolution.discardDraft) cacheServerRows('limbah_padat', [selectedRecord]);

      setFormData({
        id: selectedRecord.id,
        tanggal: selectedRecord.tanggal,
        infeksius: selectedRecord.infeksius,
        jarum_suntik: selectedRecord.jarum_suntik,
        botol_obat: selectedRecord.botol_obat,
        sitotoksik: selectedRecord.sitotoksik,
        baseUpdatedAt: getRecordBaseVersion(selectedRecord),
      });
    } catch (error) {
      MySwal.fire('Gagal', error.message, 'error');
      return;
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (item) => {
    if (item.isRoomAccumulation && !item.isManual) {
      MySwal.fire({ icon: 'info', title: 'Tidak Bisa Dihapus Langsung', text: 'Data ini akumulasi otomatis dari Limbah Per Ruangan. Hapus melalui menu "Limbah Per Ruangan".', confirmButtonColor: '#059669' });
      return;
    }
    const isMixed = item.isRoomAccumulation && item.isManual;
    const idsToDelete = item.padatIds?.length ? item.padatIds : [item.id];
    if (isMixed && idsToDelete.length === 0) { MySwal.fire({ icon: 'warning', title: 'Tidak ada data manual', text: 'Data ruangan harus dihapus dari menu Limbah Per Ruangan.', confirmButtonColor: '#059669' }); return; }
    const tglLabel = new Date(item.tanggal).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
    const { isConfirmed } = await MySwal.fire({ title: 'Hapus Data?', text: isMixed ? `Hanya data manual pada ${tglLabel} yang dihapus.` : `Data ${tglLabel} akan dihapus permanen!`, icon: 'warning', showCancelButton: true, confirmButtonColor: '#d33', cancelButtonColor: '#3085d6', confirmButtonText: 'Ya, Hapus!' });
    if (!isConfirmed) return;
    try {
      let queuedDelete = false;

      for (const initialId of idsToDelete) {
        let id = getSyncedServerId(initialId) || initialId;
        const originalRecord = (item.manualRecords || []).find(record => (
          String(record.id) === String(initialId)
        )) || item;
        const baseUpdatedAt = getRecordBaseVersion(originalRecord);

        if (String(id).startsWith('off_') && navigator.onLine) {
          await syncOfflineQueue(false, true);
          id = getSyncedServerId(initialId) || initialId;
        }

        if (String(id).startsWith('off_')) {
          removeLocalRecordQueue({ id: String(initialId) });
          continue;
        }

        if (!navigator.onLine) {
          saveToOfflineQueue(
            'limbah_padat',
            'delete',
            { id },
            `Hapus Limbah Padat ${item.tanggal}`,
            { baseUpdatedAt }
          );
          queuedDelete = true;
          continue;
        }

        try {
          await deleteRecordWithVersion('limbah_padat', id, baseUpdatedAt);
          removeLocalRecordQueue({ id: String(id) });
          removeCachedServerRow('limbah_padat', id);
        } catch (error) {
          if (isNetworkError(error)) {
            saveToOfflineQueue(
              'limbah_padat',
              'delete',
              { id },
              `Hapus Limbah Padat ${item.tanggal}`,
              { baseUpdatedAt }
            );
            queuedDelete = true;
            continue;
          }
          throw error;
        }
      }
      MySwal.fire(queuedDelete ? 'Tersimpan Offline' : 'Terhapus', queuedDelete ? 'Perintah hapus disimpan dan akan diproses otomatis.' : (isMixed ? 'Data manual berhasil dihapus.' : 'Data berhasil dihapus.'), queuedDelete ? 'info' : 'success');
      fetchData();
    } catch (error) {
      if (isRecordConflictError(error)) {
        MySwal.fire('Data Sudah Berubah', error.message, 'warning');
        fetchData();
      } else {
        MySwal.fire('Gagal', error.message, 'error');
      }
    }
  };

  // ── Export Excel ──────────────────────────────────────────────────────────────
  const handleExportExcel = async () => {
    const { value: selectedMonth } = await MySwal.fire({ title: 'Export Data Limbah', html: `<div class="text-left mt-4"><label class="block text-sm font-bold text-gray-700 mb-1.5">Bulan & Tahun</label><input id="swal-input-month" type="month" class="w-full border border-gray-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 outline-none text-sm bg-gray-50" value="${filterMonth || getLocalMonthString()}"></div>`, focusConfirm: false, showCancelButton: true, confirmButtonText: '<i class="fas fa-file-excel mr-2"></i>Export', cancelButtonText: 'Batal', confirmButtonColor: '#059669', preConfirm: () => document.getElementById('swal-input-month').value });
    if (!selectedMonth) return;
    MySwal.fire({ title: 'Mengambil Data...', allowOutsideClick: false, didOpen: () => MySwal.showLoading() });
    try {
      const exportData = await getAccumulatedData(selectedMonth);
      exportData.sort((a, b) => a.tanggal.localeCompare(b.tanggal));
      if (!exportData.length) { MySwal.fire('Informasi', 'Tidak ada data untuk bulan ini.', 'info'); return; }
      const [year, month] = selectedMonth.split('-');
      const monthNames = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
      const monthLabel = `${monthNames[parseInt(month)-1]} ${year}`;
      const wsData = [['LAPORAN LIMBAH MEDIS PADAT (AKUMULASI HARIAN)'],[`Periode: ${monthLabel}`],[`Dicetak: ${new Date().toLocaleDateString('id-ID',{day:'numeric',month:'long',year:'numeric'})}`],[],['No.','Tanggal','Limbah Infeksius (Kg)','Jarum Suntik (Kg)','Botol Obat (Kg)','Sitotoksik (Kg)','Total Harian (Kg)','Keterangan Sumber']];
      let tI=0,tJ=0,tB=0,tS=0;
      exportData.forEach((item,idx)=>{ const inf=parseFloat(item.infeksius)||0,jar=parseFloat(item.jarum_suntik)||0,bot=parseFloat(item.botol_obat)||0,sit=parseFloat(item.sitotoksik)||0,tot=inf+jar+bot+sit; tI+=inf;tJ+=jar;tB+=bot;tS+=sit; const src=[]; if(item.ruanganCount>0) src.push(`Akumulasi ${item.ruanganCount} ruangan`); if(item.isManual) src.push('Input Manual'); wsData.push([idx+1,new Date(item.tanggal).toLocaleDateString('id-ID'),inf,jar,bot,sit,tot,src.join(' & ')]); });
      wsData.push([],['TOTAL BULANAN','',tI,tJ,tB,tS,tI+tJ+tB+tS]);
      const XLSX = await loadExcelLibrary();
      const ws = XLSX.utils.aoa_to_sheet(wsData);
      ws['!cols']=[{wch:5},{wch:14},{wch:22},{wch:18},{wch:16},{wch:14},{wch:18}];
      ws['!merges']=[{s:{r:0,c:0},e:{r:0,c:6}},{s:{r:1,c:0},e:{r:1,c:6}},{s:{r:2,c:0},e:{r:2,c:6}}];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb,ws,`Limbah ${monthLabel}`);
      XLSX.writeFile(wb,`Laporan_Limbah_Padat_${monthLabel.replace(' ','_')}.xlsx`);
      MySwal.fire({ icon:'success', title:'Export Berhasil!', text:`${exportData.length} data berhasil diekspor.`, timer:2000, showConfirmButton:false });
    } catch (error) { MySwal.fire('Gagal','Terjadi kesalahan: '+error.message,'error'); }
  };

  // ── Download Template ─────────────────────────────────────────────────────────
  const handleDownloadTemplate = async () => {
    const XLSX = await loadExcelLibrary();
    const ws = XLSX.utils.aoa_to_sheet([['No.','Tanggal','Limbah Infeksius (Kg)','Jarum Suntik (Kg)','Botol Obat (Kg)','Sitotoksik (Kg)'],['','Petunjuk: Isi tanggal format DD-MM-YYYY, misal: 15-01-2025','','','',''],[1,'01-01-2025',0.5,0.2,0.1,0.05],[2,'02-01-2025',0.8,0.3,0.15,0.1]]);
    ws['!cols']=[{wch:5},{wch:20},{wch:22},{wch:18},{wch:16},{wch:14}];
    const wb=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb,ws,'Template'); XLSX.writeFile(wb,'Template_Import_Limbah_Padat.xlsx');
  };

  // ── Import Excel ──────────────────────────────────────────────────────────────
  const handleImportFile = (e) => {
    const file = e.target.files[0]; if (!file) return; e.target.value='';
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const XLSX = await loadExcelLibrary();
        const wb = XLSX.read(evt.target.result, { type:'binary', cellDates:false });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, { header:1, defval:'' });
        let headerIdx=-1;
        for(let i=0;i<rows.length;i++){ if(rows[i].join('').toLowerCase().includes('tanggal')){ headerIdx=i; break; } }
        if(headerIdx===-1){ MySwal.fire('Format Salah','Tidak ditemukan header "Tanggal". Gunakan template yang tersedia.','error'); return; }
        const dataRows = rows.slice(headerIdx + 1)
          .map((row, index) => ({ row, rowNumber: headerIdx + index + 2 }))
          .filter(({ row }) => {
            const dateText = String(row[1] ?? '').trim().toLowerCase();
            const hasAnyData = row.slice(1, 6).some(value => String(value ?? '').trim() !== '');
            return hasAnyData && !dateText.includes('petunjuk') && !dateText.includes('total');
          });
        if(!dataRows.length){ MySwal.fire('Tidak Ada Data','Tidak ditemukan baris data yang valid.','warning'); return; }
        const payloads = [];
        const validationErrors = [];
        const importTime = new Date().toISOString();

        dataRows.forEach(({ row, rowNumber }) => {
          const tanggal = formatDateFromExcel(row[1], XLSX);
          const numberFields = [
            ['Infeksius', row[2], 'infeksius'],
            ['Jarum Suntik', row[3], 'jarum_suntik'],
            ['Botol Obat', row[4], 'botol_obat'],
            ['Sitotoksik', row[5], 'sitotoksik'],
          ];
          const parsedNumbers = {};
          const rowErrors = [];

          if (!tanggal) rowErrors.push(`tanggal "${String(row[1] ?? '').trim()}" tidak valid`);
          numberFields.forEach(([label, rawValue, key]) => {
            const parsed = parseNonNegativeImportNumber(rawValue);
            if (parsed.error) rowErrors.push(`${label} ${parsed.error}`);
            else parsedNumbers[key] = parsed.value;
          });

          if (rowErrors.length > 0) {
            validationErrors.push(`Baris ${rowNumber}: ${rowErrors.join('; ')}`);
            return;
          }

          payloads.push({
            tanggal,
            petugas: user?.nama || 'Petugas',
            ...parsedNumbers,
            waktu_input: importTime,
          });
        });

        if (validationErrors.length > 0) {
          const shownErrors = validationErrors.slice(0, 10);
          const remaining = validationErrors.length - shownErrors.length;
          MySwal.fire({
            icon: 'error',
            title: 'Data Excel Belum Valid',
            html: `<div class="text-left text-sm"><p class="mb-3">Perbaiki data berikut, lalu impor kembali. Tidak ada data yang disimpan.</p><ul class="list-disc pl-5 space-y-1 max-h-64 overflow-y-auto">${shownErrors.map(error => `<li>${escapeImportHTML(error)}</li>`).join('')}</ul>${remaining > 0 ? `<p class="mt-3 font-semibold">Dan ${remaining} kesalahan lainnya.</p>` : ''}</div>`,
            confirmButtonColor: '#dc2626',
          });
          return;
        }

        const { isConfirmed } = await MySwal.fire({ title:'Konfirmasi Import', html:`<p>Ditemukan <strong>${payloads.length} baris data</strong>. Lanjutkan import?</p>`, icon:'question', showCancelButton:true, confirmButtonColor:'#16a34a', confirmButtonText:'Ya, Import!' });
        if(!isConfirmed) return;
        setImporting(true); MySwal.fire({ title:'Mengimport Data...', allowOutsideClick:false, didOpen:()=>MySwal.showLoading() });
        const inserted = await insertImportRowsAtomically(supabase, 'limbah_padat', payloads);
        await fetchData(); MySwal.fire({ icon:'success', title:'Import Berhasil!', text:`${inserted} data berhasil diimport.`, timer:2500, showConfirmButton:false });
      } catch(err){ MySwal.fire('Gagal Import',err.message||'Terjadi kesalahan saat membaca file.','error'); }
      finally{ setImporting(false); }
    };
    reader.readAsBinaryString(file);
  };

  // ── Print ─────────────────────────────────────────────────────────────────────
  const handlePrint = async () => {
    const { value: formValues } = await MySwal.fire({ title:'Cetak Laporan', html:`<div class="text-left mt-4"><label class="block text-sm font-bold text-gray-700 mb-1.5">Bulan & Tahun</label><input id="swal-input-month" type="month" class="w-full border border-gray-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 outline-none text-sm bg-gray-50" value="${filterMonth||new Date().toISOString().slice(0,7)}"></div>`, focusConfirm:false, showCancelButton:true, confirmButtonText:'<i class="fas fa-print mr-2"></i>Cetak', cancelButtonText:'Batal', confirmButtonColor:'#2563eb', preConfirm:()=>{ const i=document.getElementById('swal-input-month'); return i?i.value:''; } });
    if(!formValues) return;
    MySwal.fire({ title:'Menyiapkan Laporan...', text:'Mohon tunggu sebentar', allowOutsideClick:false, allowEscapeKey:false, didOpen:()=>MySwal.showLoading() });
    try {
      const printData = await getAccumulatedData(formValues);
      printData.sort((a,b)=>a.tanggal.localeCompare(b.tanggal));
      if(!printData.length){ MySwal.fire({ icon:'info', title:'Tidak Ada Data', text:'Tidak ada data limbah untuk bulan yang dipilih.', confirmButtonColor:'#2563eb' }); return; }
      const kepalaUnit = await getSetting('kepala_unit_sanitasi', null);
      const html = buildPadatPrintHTML(printData, formValues, kepalaUnit);
      MySwal.close();
      const success = await printViaHiddenIframe(html, printFrameRef);
      if(!success) MySwal.fire({ icon:'error', title:'Gagal Membuka Cetakan', text:'Browser tidak mendukung cetak langsung. Coba Chrome/Safari terbaru.', confirmButtonColor:'#2563eb' });
    } catch(error){ MySwal.fire({ icon:'error', title:'Gagal', text:'Terjadi kesalahan saat mengambil data cetak: '+(error.message||error), confirmButtonColor:'#dc2626' }); }
  };

  const totalPages = Math.ceil(totalData / ITEMS_PER_PAGE);
  const Wrapper = embedded ? EmbeddedWrapper : FullWrapper;

  return (
    <Wrapper>
      <div className="container mx-auto px-4 py-8">

        {formEnabled && (
          <PadatForm
            formData={formData}
            setFormData={setFormData}
            handleInputChange={handleInputChange}
            handleSubmit={handleSubmit}
            submitting={submitting}
            user={user}
          />
        )}

        {formEnabled && (
          <PadatImportExportToolbar
            importing={importing}
            importInputRef={importInputRef}
            onDownloadTemplate={handleDownloadTemplate}
            onImportFile={handleImportFile}
            onExportExcel={handleExportExcel}
          />
        )}

        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          <OfflineBanner data={data} totalOfflineCount={offlineQueueCount} />
          <PadatTable
            data={data}
            loading={loading}
            page={page}
            itemsPerPage={ITEMS_PER_PAGE}
            totalData={totalData}
            filterMonth={filterMonth}
            setFilterMonth={setFilterMonth}
            setPage={setPage}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onPrint={handlePrint}
          />
          <Pagination page={page} totalPages={totalPages} onPageChange={setPage} accentColor="emerald" />
        </div>

      </div>
    </Wrapper>
  );
}
