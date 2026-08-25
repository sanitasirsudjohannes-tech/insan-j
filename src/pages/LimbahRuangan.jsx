import { useState, useEffect, useRef } from 'react';
import AppLayout from '../components/AppLayout';
import { supabase } from '../lib/supabase';
import Swal from 'sweetalert2';
import withReactContent from 'sweetalert2-react-content';
import { getCurrentUser, fetchDaftarRuangan, getSetting } from '../lib/api';
import {
  saveToOfflineQueue,
  saveInsertBatchToOfflineQueue,
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

import RuanganForm from '../components/limbah/ruangan/RuanganForm';
import RuanganImportExportToolbar from '../components/limbah/ruangan/RuanganImportExportToolbar';
import RuanganTable from '../components/limbah/ruangan/RuanganTable';
import OfflineBanner from '../components/limbah/OfflineBanner';
import Pagination from '../components/limbah/Pagination';
import { buildRuanganPrintHTML } from '../components/limbah/ruangan/ruanganPrintTemplate';
import { formatDateFromExcel } from '../lib/excelDateHelpers';
import { printViaHiddenIframe } from '../lib/printHelpers';
import { getLocalDateString, getLocalMonthString } from '../lib/localDate';
import { isNetworkError } from '../lib/networkErrors';
import { notifyDatabaseTablesChanged } from '../lib/databaseAggregations';
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
function FullWrapper({ children }) { return <AppLayout title="Limbah Per Ruangan">{children}</AppLayout>; }

const ITEMS_PER_PAGE = 10;
const FETCH_BATCH_SIZE = 500;

const fetchRuanganReportRows = async ({ startDate, endDate, ruangan }) => {
  const rows = [];
  let from = 0;

  while (true) {
    let query = supabase.from('limbah_ruangan')
      .select('tanggal,ruangan,infeksius,jarum_suntik,botol_obat,sitotoksik,petugas,keterangan')
      .gte('tanggal', startDate)
      .lte('tanggal', endDate)
      .order('tanggal', { ascending: true })
      .order('ruangan', { ascending: true })
      .order('id', { ascending: true })
      .range(from, from + FETCH_BATCH_SIZE - 1);

    if (ruangan) query = query.eq('ruangan', ruangan);

    const { data, error } = await query;
    if (error) throw error;

    const batch = data || [];
    rows.push(...batch);
    if (batch.length < FETCH_BATCH_SIZE) return rows;

    from += batch.length;
  }
};

// Urutan harus konsisten dengan query Supabase agar draft/update offline
// tergabung ke posisi global yang benar sebelum di-slice per halaman.
const compareRuanganRows = (a, b) => {
  const dateA = a?.tanggal || '';
  const dateB = b?.tanggal || '';
  if (dateA !== dateB) return dateB.localeCompare(dateA);

  const waktuA = a?.waktu_input || '';
  const waktuB = b?.waktu_input || '';
  return waktuB.localeCompare(waktuA);
};

const EMPTY_FORM = {
  id: null,
  tanggal: getLocalDateString(),
  ruangan: '', infeksius: '', jarum_suntik: '', botol_obat: '', sitotoksik: '', keterangan: '',
  isDistribusi: false,
  distribusiDates: []
};

export default function LimbahRuangan({ embedded = false }) {
  const user = getCurrentUser();
  const isMahasiswa = user?.role?.toLowerCase() === 'mahasiswa';
  const [data, setData] = useState([]);
  const [ruanganList, setRuanganList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [page, setPage] = useState(1);
  const [totalData, setTotalData] = useState(0);
  const [offlineQueueCount, setOfflineQueueCount] = useState(0);
  const [filterMonth, setFilterMonth] = useState('');
  const [filterRuangan, setFilterRuangan] = useState('');
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [showRuanganSheet, setShowRuanganSheet] = useState(false);
  const [filterDate, setFilterDate] = useState('');
  const importInputRef = useRef(null);
  const fetchIdRef = useRef(0);

  useEffect(() => { fetchDaftarRuangan().then(setRuanganList); }, []);

  // ── fetchData ─────────────────────────────────────────────────────────────────
  const fetchData = async () => {
    const currentFetchId = ++fetchIdRef.current;
    setLoading(true);
    try {
      let dbData = [], count = 0;

      // Overlay offline dibaca lebih dulu karena baris ini harus ikut serta
      // dalam penghitungan halaman (bukan ditempel begitu saja di setiap
      // halaman hasil query DB).
      const tableQueue = getOfflineQueue().filter(item => item.table === 'limbah_ruangan');
      setOfflineQueueCount(tableQueue.length);
      const allUnsynced = getUnsyncedItemsForTable('limbah_ruangan');
      let unsynced = allUnsynced;
      if (filterDate) unsynced = unsynced.filter(i => i.tanggal === filterDate);
      else if (filterMonth) unsynced = unsynced.filter(i => i.tanggal?.startsWith(filterMonth));
      if (filterRuangan) unsynced = unsynced.filter(i => i.ruangan === filterRuangan);

      const delIds = new Set(getOfflineDeletedIds('limbah_ruangan'));
      // Semua versi server yang sudah diedit offline harus disembunyikan,
      // termasuk ketika versi barunya tidak lagi cocok dengan filter aktif.
      const hiddenServerIds = new Set([
        ...allUnsynced.filter(item => item.offlineAction === 'update').map(item => String(item.id)),
        ...delIds,
      ]);
      const excludedIds = hiddenServerIds.size > 0
        ? `(${Array.from(hiddenServerIds).join(',')})`
        : null;

      let dbFetchSucceeded = false;
      let dbStartIndex = 0;
      try {
        if (!navigator.onLine) throw new Error('Perangkat sedang offline.');

        // Ambil hanya jendela baris DB yang mungkin masuk ke halaman aktif.
        // Maksimal seluruh draft offline dapat menggeser posisi awal halaman;
        // baris DB sebelumnya tidak perlu diunduh ulang dari indeks nol.
        const pageStartIndex = (page - 1) * ITEMS_PER_PAGE;
        dbStartIndex = Math.max(0, pageStartIndex - unsynced.length);
        const dbEndIndex = pageStartIndex + ITEMS_PER_PAGE - 1;

        for (let from = dbStartIndex; from <= dbEndIndex; from += FETCH_BATCH_SIZE) {
          const to = Math.min(from + FETCH_BATCH_SIZE - 1, dbEndIndex);
          let qData = supabase.from('limbah_ruangan')
            .select('id, tanggal, ruangan, infeksius, jarum_suntik, botol_obat, sitotoksik, petugas, keterangan, waktu_input, created_by', { count: 'exact' })
            .order('tanggal', { ascending: false })
            .order('waktu_input', { ascending: false })
            .range(from, to);
          if (filterDate) { qData = qData.eq('tanggal', filterDate); }
          else if (filterMonth) { const [y, m] = filterMonth.split('-'); const s = `${y}-${m}-01`, en = `${y}-${m}-${String(new Date(y, m, 0).getDate()).padStart(2, '0')}`; qData = qData.gte('tanggal', s).lte('tanggal', en); }
          if (filterRuangan) qData = qData.eq('ruangan', filterRuangan);
          if (excludedIds) qData = qData.not('id', 'in', excludedIds);

          const { data: result, count: queryCount, error } = await qData;
          if (error) throw error;
          if (typeof queryCount === 'number') count = queryCount;
          const batch = result || [];
          dbData.push(...batch);
          if (batch.length < to - from + 1) break;
        }

        cacheServerRows('limbah_ruangan', dbData);
        dbFetchSucceeded = true;
      } catch (e) {
        console.warn('Handling offline/network error during DB fetch:', e);
        // Gabungkan data server yang pernah dimuat dengan draft agar riwayat
        // tetap dapat dibuka ketika koneksi terputus atau tidak stabil.
        dbData = getCachedServerRows('limbah_ruangan').filter(item => {
          if (hiddenServerIds.has(String(item.id))) return false;
          if (filterDate && item.tanggal !== filterDate) return false;
          if (!filterDate && filterMonth && !item.tanggal?.startsWith(filterMonth)) return false;
          if (filterRuangan && item.ruangan !== filterRuangan) return false;
          return true;
        });
        count = dbData.length;
      }

      if (currentFetchId !== fetchIdRef.current) return;

      // Gabungkan baris DB dengan overlay offline, buang yang sudah dihapus
      // secara offline, urutkan ulang secara global, baru ambil slice sesuai
      // halaman aktif.
      const filteredDb = dbData.filter(d => !hiddenServerIds.has(String(d.id)));
      const mergedData = [...unsynced, ...filteredDb].sort(compareRuanganRows);

      // Query server sudah mengecualikan seluruh versi lama yang diedit atau
      // dihapus. Tambahkan semua overlay yang sesuai filter: insert maupun
      // update yang berpindah tanggal/ruangan.
      const adjustedTotal = Math.max(0, (count || 0) + unsynced.length);
      setTotalData(adjustedTotal);

      // Jika halaman terakhir hilang setelah hapus data, perubahan filter,
      // atau perpindahan offline, kembali ke halaman yang masih tersedia.
      const lastAvailablePage = Math.max(1, Math.ceil(adjustedTotal / ITEMS_PER_PAGE));
      if (page > lastAvailablePage) {
        setPage(lastAvailablePage);
        return;
      }

      const fromIndex = (page - 1) * ITEMS_PER_PAGE;
      const localStartIndex = dbFetchSucceeded ? fromIndex - dbStartIndex : fromIndex;
      setData(mergedData.slice(localStartIndex, localStartIndex + ITEMS_PER_PAGE));
    } catch (error) {
      console.error('Error fetching limbah ruangan data:', error);
    } finally {
      if (currentFetchId === fetchIdRef.current) setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const h = () => fetchData();
    let queueRefreshTimer;
    const handleQueueChange = (event) => {
      if (event.syncInProgress) return;
      const changedTables = event.changedTables || event.detail?.changedTables;
      if (changedTables?.length && !changedTables.includes('limbah_ruangan')) return;
      window.clearTimeout(queueRefreshTimer);
      queueRefreshTimer = window.setTimeout(h, 180);
    };
    window.addEventListener('offline-queue-changed', handleQueueChange);
    window.addEventListener('offline-sync-complete', handleQueueChange);
    window.addEventListener('online', h);
    window.addEventListener('offline', h);
    
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') h();
    };
    document.addEventListener('visibilitychange', handleVisibility);

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (['INITIAL_SESSION', 'SIGNED_IN', 'TOKEN_REFRESHED'].includes(event)) h();
    });

    return () => { 
      window.clearTimeout(queueRefreshTimer);
      window.removeEventListener('offline-queue-changed', handleQueueChange);
      window.removeEventListener('offline-sync-complete', handleQueueChange);
      window.removeEventListener('online', h); 
      window.removeEventListener('offline', h); 
      document.removeEventListener('visibilitychange', handleVisibility);
      subscription?.unsubscribe();
    };
  }, [page, filterMonth, filterDate, filterRuangan]);

  // ── Handlers form ─────────────────────────────────────────────────────────────
  const handleInputChange = (e) => setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.ruangan) { MySwal.fire('Peringatan', 'Silakan pilih ruangan terlebih dahulu!', 'warning'); return; }
    if (formData.isDistribusi && (!formData.distribusiDates || formData.distribusiDates.length === 0)) {
      MySwal.fire('Peringatan', 'Silakan tambah minimal 1 tanggal distribusi!', 'warning'); return;
    }
    if (formData.isDistribusi && !formData.id) {
      const extraDates = (formData.distribusiDates || []).filter(Boolean);
      if (extraDates.some(date => date === formData.tanggal)) {
        MySwal.fire('Peringatan', 'Tanggal distribusi tidak boleh sama dengan tanggal utama.', 'warning'); return;
      }
      if (new Set(extraDates).size !== extraDates.length) {
        MySwal.fire('Peringatan', 'Tanggal distribusi tidak boleh dipilih lebih dari satu kali.', 'warning'); return;
      }
    }
    setSubmitting(true);

    // Hitung tanggal dan pembagian jika distribusi aktif
    let datesToSave = [formData.tanggal];
    if (formData.isDistribusi && !formData.id) {
      const extra = (formData.distribusiDates || []).filter(d => d && d !== formData.tanggal);
      datesToSave = [formData.tanggal, ...new Set(extra)];
    }
    const totalHari = datesToSave.length;

    const distributeValue = (total, days) => {
      if (!total || days <= 0) return Array(days).fill(0);
      const parsed = parseFloat(total);
      if (isNaN(parsed) || parsed === 0) return Array(days).fill(0);

      // Mengubah ke integer agar tidak ada floating point bug (misal: kalikan 100)
      const totalInt = Math.round(parsed * 100);
      const baseShareInt = Math.floor(totalInt / days);
      const remainderInt = totalInt - (baseShareInt * days);

      const result = Array(days).fill(baseShareInt / 100);
      // Selisih pembulatan diberikan ke tanggal terakhir
      result[days - 1] = (baseShareInt + remainderInt) / 100;

      return result;
    };

    const arrInf = distributeValue(formData.infeksius, totalHari);
    const arrJar = distributeValue(formData.jarum_suntik, totalHari);
    const arrBot = distributeValue(formData.botol_obat, totalHari);
    const arrSit = distributeValue(formData.sitotoksik, totalHari);

    const payloads = datesToSave.map((tgl, idx) => ({
      tanggal: tgl,
      ruangan: formData.ruangan,
      petugas: user?.nama || 'Petugas',
      infeksius: arrInf[idx],
      jarum_suntik: arrJar[idx],
      botol_obat: arrBot[idx],
      sitotoksik: arrSit[idx],
      keterangan: formData.keterangan || '',
      waktu_input: new Date().toISOString()
    }));
    const insertPayloads = payloads.map((payload) => ({ ...payload, created_by: user?.id }));
    let recordId = formData.id;
    let baseUpdatedAt = formData.baseUpdatedAt || null;
    let isLocalDraft = Boolean(recordId) && String(recordId).startsWith('off_');

    try {
      if (!formData.id && formData.isDistribusi) {
        const queuedItems = saveInsertBatchToOfflineQueue(
          'limbah_ruangan',
          insertPayloads,
          `Distribusi Limbah Ruangan ${formData.ruangan}`
        );
        const visibleRows = queuedItems
          .map(item => ({
            ...item.payload,
            id: item.localId,
            isOffline: true,
            offlineId: item.localId,
            offlineAction: 'insert',
          }))
          .filter(item => {
            if (filterDate && item.tanggal !== filterDate) return false;
            if (!filterDate && filterMonth && !item.tanggal?.startsWith(filterMonth)) return false;
            return !filterRuangan || item.ruangan === filterRuangan;
          });

        if (page === 1 && visibleRows.length > 0) {
          setData(current => [...visibleRows, ...current]
            .sort(compareRuanganRows)
            .slice(0, ITEMS_PER_PAGE));
        }
        setTotalData(current => current + visibleRows.length);
        setOfflineQueueCount(current => current + queuedItems.length);
        setFormData({
          ...EMPTY_FORM,
          tanggal: formData.tanggal,
          isDistribusi: formData.isDistribusi,
          distribusiDates: formData.distribusiDates,
        });

        MySwal.fire({
          icon: 'success',
          title: 'Distribusi Tersimpan',
          text: navigator.onLine
            ? `${totalHari} tanggal sedang dikirim ke database.`
            : `${totalHari} tanggal tersimpan di HP dan menunggu koneksi.`,
          toast: true,
          position: 'top-end',
          showConfirmButton: false,
          timer: 2200,
        });

        if (navigator.onLine) {
          const batchId = queuedItems[0]?.batchId;
          window.setTimeout(() => {
            syncOfflineQueue(false)
              .then(result => {
                const ownBatchStillPending = getOfflineQueue().some(item => item.batchId === batchId);
                if (ownBatchStillPending && result.failed === 0) return syncOfflineQueue(false);
                return result;
              })
              .catch(error => console.error('Gagal mengirim distribusi limbah:', error));
          }, 0);
        }
        return;
      }

      if (isLocalDraft) {
        recordId = getSyncedServerId(formData.id) || formData.id;

        // Tunggu auto-sync yang sedang berjalan agar edit tidak memakai ID
        // lokal yang baru saja diganti dengan ID asli dari Supabase.
        if (navigator.onLine && String(recordId).startsWith('off_')) {
          await syncOfflineQueue(false, true);
          recordId = getSyncedServerId(formData.id) || formData.id;
        }

        isLocalDraft = String(recordId).startsWith('off_');
      }

      if (!navigator.onLine || isLocalDraft) {
        if (formData.id) {
          saveToOfflineQueue(
            'limbah_ruangan',
            'update',
            { ...payloads[0], id: recordId },
            `Update Limbah Ruangan ${formData.ruangan}`,
            { baseUpdatedAt }
          );
        } else {
          insertPayloads.forEach(p => saveToOfflineQueue('limbah_ruangan', 'insert', p, `Input Limbah Ruangan ${formData.ruangan}`));
        }
        MySwal.fire({ icon: 'info', title: 'Tersimpan Offline', text: isLocalDraft && navigator.onLine ? 'Perubahan draft tersimpan dan menunggu sinkronisasi.' : 'Data tersimpan di HP dan akan dikirim otomatis saat online.', confirmButtonColor: '#059669' });
      } else if (formData.id) {
        const pendingRecordUpdate = getOfflineQueue().find(item => {
          if (item.table !== 'limbah_ruangan') return false;
          const references = [item.serverId, item.payload?.id, item.payload?.serverId];
          return references.some(reference => reference != null && String(reference) === String(recordId));
        });

        // Selesaikan perubahan lama terlebih dahulu agar auto-sync tidak
        // datang belakangan dan menimpa nilai terbaru yang sedang disimpan.
        if (pendingRecordUpdate) {
          await syncOfflineQueue(false, true);
          const stillPending = getOfflineQueue().some(item => item.id === pendingRecordUpdate.id);
          if (!stillPending && pendingRecordUpdate.action === 'update') {
            baseUpdatedAt = pendingRecordUpdate.payload?.waktu_input || baseUpdatedAt;
          }
        }

        await updateRecordWithVersion('limbah_ruangan', recordId, payloads[0], baseUpdatedAt);
        cacheServerRows('limbah_ruangan', [{ ...payloads[0], id: recordId }]);

        // Jika percobaan sync lama gagal tetapi update terbaru berhasil,
        // antrean lama tidak boleh menimpa nilai yang baru saja tersimpan.
        if (pendingRecordUpdate) removeLocalRecordQueue({ id: recordId });
        MySwal.fire('Berhasil', 'Data limbah ruangan berhasil diubah', 'success');
      } else {
        const { error } = await supabase.from('limbah_ruangan').insert(insertPayloads);
        if (error) throw error;
        notifyDatabaseTablesChanged('limbah_ruangan');
        MySwal.fire('Berhasil', `Data berhasil disimpan untuk ${totalHari} hari (dibagi rata)`, `success`);
      }

      // Retain date and distribution settings for next input
      setFormData({
        ...EMPTY_FORM,
        tanggal: formData.tanggal,
        isDistribusi: formData.isDistribusi,
        distribusiDates: formData.distribusiDates
      });
      fetchData();
    } catch (error) {
      if (isNetworkError(error)) {
        if (formData.id) {
          saveToOfflineQueue(
            'limbah_ruangan',
            'update',
            { ...payloads[0], id: recordId },
            `Update Limbah Ruangan ${formData.ruangan}`,
            { baseUpdatedAt }
          );
        } else {
          insertPayloads.forEach(p => saveToOfflineQueue('limbah_ruangan', 'insert', p, `Input Limbah Ruangan ${formData.ruangan}`));
        }
        MySwal.fire({ icon: 'info', title: 'Tersimpan Offline', text: 'Jaringan terputus. Data tersimpan di HP.', confirmButtonColor: '#059669' });

        setFormData({
          ...EMPTY_FORM,
          tanggal: formData.tanggal,
          isDistribusi: formData.isDistribusi,
          distribusiDates: formData.distribusiDates
        });
      } else if (isRecordConflictError(error)) {
        MySwal.fire('Data Sudah Berubah', error.message, 'warning');
        fetchData();
      } else { MySwal.fire('Gagal', error.message, 'error'); }
    } finally { setSubmitting(false); }
  };

  const handleEdit = async (item) => {
    try {
      const resolution = await resolveOfflineRecordConflict('limbah_ruangan', item, MySwal);
      if (!resolution) return;
      if (resolution.discardDraft) removeLocalRecordQueue({ id: item.id });
      if (!resolution.record) { fetchData(); return; }
      item = resolution.record;
      if (resolution.discardDraft) cacheServerRows('limbah_ruangan', [item]);
    } catch (error) {
      MySwal.fire('Gagal', error.message, 'error');
      return;
    }

    setFormData({
      id: item.id,
      tanggal: item.tanggal,
      ruangan: item.ruangan,
      infeksius: item.infeksius,
      jarum_suntik: item.jarum_suntik,
      botol_obat: item.botol_obat,
      sitotoksik: item.sitotoksik,
      keterangan: item.keterangan || '',
      // Reset state distribusi peninggalan dari input sebelumnya agar
      // tidak ikut terbawa ke sesi edit ini.
      isDistribusi: false,
      distribusiDates: [],
      baseUpdatedAt: getRecordBaseVersion(item),
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (item) => {
    const { isConfirmed } = await MySwal.fire({ title: 'Hapus Data Limbah Ruangan?', text: 'Data yang dihapus tidak dapat dikembalikan!', icon: 'warning', showCancelButton: true, confirmButtonColor: '#d33', cancelButtonColor: '#3085d6', confirmButtonText: 'Ya, Hapus!' });
    if (!isConfirmed) return;
    try {
      if (item.isOffline && item.offlineAction === 'insert') {
        let syncedServerId = getSyncedServerId(item.id);
        if (!syncedServerId && navigator.onLine) {
          await syncOfflineQueue(false, true);
          syncedServerId = getSyncedServerId(item.id);
        }
        if (syncedServerId) {
          item = { ...item, id: syncedServerId };
        } else {
          removeLocalRecordQueue(item);
          MySwal.fire('Terhapus', 'Draft offline berhasil dihapus', 'success');
          fetchData();
          return;
        }
      }
      if (!navigator.onLine) {
        saveToOfflineQueue(
          'limbah_ruangan',
          'delete',
          item,
          `Hapus Limbah Ruangan ${item.ruangan || ''}`,
          { baseUpdatedAt: getRecordBaseVersion(item) }
        );
        MySwal.fire({ icon: 'info', title: 'Tersimpan Offline', text: 'Perintah hapus akan diproses otomatis saat online.', confirmButtonColor: '#059669' });
        fetchData(); return;
      }
      await deleteRecordWithVersion('limbah_ruangan', item.id, getRecordBaseVersion(item));
      // Antrean edit hanya boleh dibuang setelah penghapusan benar-benar
      // dikonfirmasi berhasil oleh server.
      removeLocalRecordQueue(item);
      removeCachedServerRow('limbah_ruangan', item.id);
      MySwal.fire('Terhapus', 'Data berhasil dihapus', 'success'); fetchData();
    } catch (error) {
      if (isNetworkError(error)) {
        saveToOfflineQueue(
          'limbah_ruangan',
          'delete',
          item,
          `Hapus Limbah Ruangan ${item.ruangan || ''}`,
          { baseUpdatedAt: getRecordBaseVersion(item) }
        );
        MySwal.fire({ icon: 'info', title: 'Tersimpan Offline', text: 'Perintah hapus disimpan dan akan diproses otomatis.', confirmButtonColor: '#059669' });
        fetchData();
      } else if (isRecordConflictError(error)) {
        MySwal.fire('Data Sudah Berubah', error.message, 'warning');
        fetchData();
      } else { MySwal.fire('Gagal', error.message, 'error'); }
    }
  };

  // ── Export Excel ──────────────────────────────────────────────────────────────
  const handleExportExcel = async () => {
    const { value: fv } = await MySwal.fire({ title: 'Export Data Limbah', html: `<div class="text-left mt-4 space-y-4"><div><label class="block text-sm font-bold text-gray-700 mb-1.5">Bulan & Tahun</label><input id="swal-export-month" type="month" class="w-full border border-gray-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-emerald-500 outline-none text-sm bg-gray-50" value="${getLocalMonthString()}"/></div><div><label class="block text-sm font-bold text-gray-700 mb-1.5">Filter Ruangan (Opsional)</label><select id="swal-export-ruangan" class="w-full border border-gray-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-emerald-500 outline-none text-sm bg-gray-50 appearance-none"><option value="">-- Semua Ruangan --</option>${ruanganList.map(r => `<option value="${r}">${r}</option>`).join('')}</select></div></div>`, focusConfirm: false, showCancelButton: true, confirmButtonText: '<i class="fas fa-file-excel mr-2"></i>Export Excel', cancelButtonText: 'Batal', confirmButtonColor: '#059669', preConfirm: () => ({ month: document.getElementById('swal-export-month').value, ruangan: document.getElementById('swal-export-ruangan').value }) });
    if (!fv || !fv.month) return;
    const { month: sel, ruangan: selR } = fv;
    const [y, m] = sel.split('-'); const s = `${y}-${m}-01`, en = `${y}-${m}-${String(new Date(y, m, 0).getDate()).padStart(2, '0')}`;
    MySwal.fire({ title: 'Mengambil Data...', allowOutsideClick: false, didOpen: () => MySwal.showLoading() });
    try {
      const exportData = await fetchRuanganReportRows({ startDate: s, endDate: en, ruangan: selR });
      if (!exportData?.length) { MySwal.fire('Informasi', 'Tidak ada data untuk filter yang dipilih.', 'info'); return; }
      const monthNames = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
      const mLabel = `${monthNames[parseInt(m) - 1]} ${y}`;
      const wsData = [['LAPORAN LIMBAH MEDIS PADAT PER RUANGAN'], [`Periode: ${mLabel}` + (selR ? ` | Ruangan: ${selR}` : '')], [`Dicetak: ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}`], [], ['No.', 'Tanggal', 'Ruangan', 'Infeksius (Kg)', 'Jarum Suntik (Kg)', 'Botol Obat (Kg)', 'Sitotoksik (Kg)', 'Total (Kg)', 'Petugas', 'Keterangan']];
      let tI = 0, tJ = 0, tB = 0, tS = 0;
      exportData.forEach((item, idx) => { const inf = parseFloat(item.infeksius) || 0, jar = parseFloat(item.jarum_suntik) || 0, bot = parseFloat(item.botol_obat) || 0, sit = parseFloat(item.sitotoksik) || 0, tot = inf + jar + bot + sit; tI += inf; tJ += jar; tB += bot; tS += sit; wsData.push([idx + 1, new Date(item.tanggal).toLocaleDateString('id-ID'), item.ruangan, inf, jar, bot, sit, tot, item.petugas || '', item.keterangan || '']); });
      wsData.push(['', 'TOTAL', '', tI, tJ, tB, tS, tI + tJ + tB + tS, '', '']);
      const XLSX = await loadExcelLibrary();
      const ws = XLSX.utils.aoa_to_sheet(wsData); ws['!cols'] = [{ wch: 5 }, { wch: 14 }, { wch: 24 }, { wch: 16 }, { wch: 18 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 18 }, { wch: 24 }];
      const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, `Limbah Ruangan ${mLabel}`);
      XLSX.writeFile(wb, `Laporan_Limbah_Ruangan_${selR ? selR + '_' : ''}${mLabel.replace(' ', '_')}.xlsx`);
      MySwal.fire({ icon: 'success', title: 'Export Berhasil!', text: `${exportData.length} data berhasil diekspor.`, timer: 2000, showConfirmButton: false });
    } catch (error) { MySwal.fire('Gagal', 'Terjadi kesalahan: ' + error.message, 'error'); }
  };

  // ── Download Template ─────────────────────────────────────────────────────────
  const handleDownloadTemplate = async () => {
    const XLSX = await loadExcelLibrary();
    const r1 = ruanganList[0] || 'Poli Jantung', r2 = ruanganList[1] || 'Cempaka';
    const ws = XLSX.utils.aoa_to_sheet([['No.', 'Tanggal', 'Ruangan', 'Limbah Infeksius (Kg)', 'Jarum Suntik (Kg)', 'Botol Obat (Kg)', 'Sitotoksik (Kg)', 'Keterangan'], ['', 'Format: YYYY-MM-DD', 'Pilih dari daftar ruangan yang valid', '', '', '', '', ''], [1, '2025-01-15', r1, 1.5, 0.5, 0.2, 0, 'Rutin'], [2, '2025-01-15', r2, 2.0, 0.8, 0.4, 0.1, 'Rutin']]);
    ws['!cols'] = [{ wch: 5 }, { wch: 16 }, { wch: 24 }, { wch: 22 }, { wch: 18 }, { wch: 16 }, { wch: 16 }, { wch: 20 }];
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Template Limbah Ruangan'); XLSX.writeFile(wb, 'Template_Import_Limbah_Ruangan.xlsx');
  };

  // ── Import Excel ──────────────────────────────────────────────────────────────
  const handleImportFile = (e) => {
    const file = e.target.files[0]; if (!file) return; e.target.value = '';
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const XLSX = await loadExcelLibrary();
        const wb = XLSX.read(evt.target.result, { type: 'binary', cellDates: false });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
        let headerIdx = -1;
        for (let i = 0; i < rows.length; i++) { const s = rows[i].join('').toLowerCase(); if (s.includes('tanggal') && s.includes('ruangan')) { headerIdx = i; break; } }
        if (headerIdx === -1) { MySwal.fire('Format Salah', 'Header Tanggal dan Ruangan tidak ditemukan. Gunakan template yang disediakan.', 'error'); return; }
        const dataRows = rows.slice(headerIdx + 1)
          .map((row, index) => ({ row, rowNumber: headerIdx + index + 2 }))
          .filter(({ row: r }) => {
            const dateText = String(r[1] ?? '').trim().toLowerCase();
            const hasAnyData = r.slice(1, 8).some(value => String(value ?? '').trim() !== '');
            return hasAnyData && !dateText.includes('format') && !dateText.includes('total');
          });
        if (!dataRows.length) { MySwal.fire('Tidak Ada Data', 'Tidak ditemukan baris data yang valid.', 'warning'); return; }
        const officialRooms = new Map(ruanganList.map(room => [room.trim().toLocaleLowerCase('id-ID'), room]));
        const payloads = [];
        const validationErrors = [];

        dataRows.forEach(({ row: r, rowNumber }) => {
          const tanggal = formatDateFromExcel(r[1], XLSX);
          const rawRuangan = String(r[2] ?? '').trim();
          const ruangan = officialRooms.get(rawRuangan.toLocaleLowerCase('id-ID'));
          const numberFields = [
            ['Infeksius', r[3], 'infeksius'],
            ['Jarum Suntik', r[4], 'jarum_suntik'],
            ['Botol Obat', r[5], 'botol_obat'],
            ['Sitotoksik', r[6], 'sitotoksik'],
          ];
          const parsedNumbers = {};
          const rowErrors = [];

          if (!tanggal) rowErrors.push(`tanggal "${String(r[1] ?? '').trim()}" tidak valid`);
          if (!ruangan) rowErrors.push(`ruangan "${rawRuangan}" tidak terdaftar`);

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
            ruangan,
            ...parsedNumbers,
            keterangan: r[7] ? String(r[7]).trim() : '',
            petugas: user?.nama || 'Petugas',
            waktu_input: new Date().toISOString(),
            created_by: user?.id,
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

        if (!payloads.length) { MySwal.fire('Gagal', 'Tidak ada baris data yang dapat diimpor.', 'error'); return; }
        const { isConfirmed } = await MySwal.fire({ title: 'Konfirmasi Import', html: `<p>Ditemukan <strong>${payloads.length} data limbah ruangan</strong>. Lanjutkan import?</p>`, icon: 'question', showCancelButton: true, confirmButtonColor: '#059669', confirmButtonText: 'Ya, Import!' });
        if (!isConfirmed) return;
        setImporting(true); MySwal.fire({ title: 'Mengimport Data...', allowOutsideClick: false, didOpen: () => MySwal.showLoading() });
        await insertImportRowsAtomically(supabase, 'limbah_ruangan', payloads);
        fetchData(); MySwal.fire({ icon: 'success', title: 'Import Berhasil!', text: `${payloads.length} data berhasil diimport.`, timer: 2500, showConfirmButton: false });
      } catch (err) { MySwal.fire('Gagal Import', err.message || 'Terjadi kesalahan saat membaca file.', 'error'); }
      finally { setImporting(false); }
    };
    reader.readAsBinaryString(file);
  };

  // ── Print ─────────────────────────────────────────────────────────────────────
  const handlePrint = async () => {
    const currentMonth = filterMonth || getLocalMonthString();
    const { value: fv } = await MySwal.fire({ title: 'Cetak Laporan Limbah', html: `<div class="text-left mt-4 space-y-4"><div><label class="block text-sm font-bold text-gray-700 mb-1.5">Bulan & Tahun</label><input id="swal-print-month" type="month" class="w-full border border-gray-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 outline-none text-sm bg-gray-50" value="${currentMonth}"/></div><div><label class="block text-sm font-bold text-gray-700 mb-1.5">Ruangan (Opsional)</label><select id="swal-print-ruangan" class="w-full border border-gray-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 outline-none text-sm bg-gray-50 appearance-none"><option value="">-- Semua Ruangan --</option>${ruanganList.map(r => `<option value="${r}">${r}</option>`).join('')}</select></div></div>`, focusConfirm: false, showCancelButton: true, confirmButtonText: '<i class="fas fa-print mr-2"></i>Cetak', cancelButtonText: 'Batal', confirmButtonColor: '#2563eb', preConfirm: () => { const mi = document.getElementById('swal-print-month'); if (!mi?.value) { Swal.showValidationMessage('Silakan pilih bulan terlebih dahulu.'); return false; } return { month: mi.value, ruangan: document.getElementById('swal-print-ruangan')?.value || '' }; } });
    if (!fv) return;
    const { month: sel, ruangan: selR } = fv;
    const [y, m] = sel.split('-'); const s = `${y}-${m}-01`, en = `${y}-${m}-${String(new Date(+y, +m, 0).getDate()).padStart(2, '0')}`;
    try {
      MySwal.fire({ title: 'Menyiapkan Laporan...', html: 'Mohon tunggu, data sedang diproses.', allowOutsideClick: false, allowEscapeKey: false, didOpen: () => MySwal.showLoading() });
      const printData = await fetchRuanganReportRows({ startDate: s, endDate: en, ruangan: selR });
      if (!printData?.length) { MySwal.fire({ icon: 'info', title: 'Tidak Ada Data', text: 'Tidak ada data limbah untuk periode dan ruangan yang dipilih.', confirmButtonColor: '#2563eb' }); return; }
      const monthNames = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
      const periodeText = `${monthNames[+m - 1]} ${y}`;
      const ruanganText = selR ? `Ruangan: ${selR}` : 'Semua Ruangan';
      const printedDate = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
      const kepalaUnit = await getSetting('kepala_unit_sanitasi', null);
      const html = buildRuanganPrintHTML(printData, periodeText, ruanganText, printedDate, kepalaUnit);
      MySwal.close();
      const printed = await printViaHiddenIframe(html);
      if (!printed) {
        MySwal.fire('Gagal', 'Browser tidak dapat membuka dialog cetak.', 'error');
      }
    } catch (error) { MySwal.fire({ icon: 'error', title: 'Gagal Mencetak', text: 'Terjadi kesalahan saat mengambil data: ' + error.message, confirmButtonColor: '#dc2626' }); }
  };

  const totalPages = Math.ceil(totalData / ITEMS_PER_PAGE);
  const Wrapper = embedded ? EmbeddedWrapper : FullWrapper;

  return (
    <Wrapper>
      <div className="container mx-auto px-4 py-8">

        {/* Header */}
        <div className="bg-linear-to-r from-emerald-600 via-teal-600 to-cyan-700 text-white rounded-2xl shadow-xl p-6 mb-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-black tracking-tight flex items-center gap-3">
                <span className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center"><i className="fas fa-door-open text-xl" /></span>
                Input Data Limbah Per Ruangan
              </h1>
              <p className="text-emerald-100 text-sm mt-1">Catat timbulan limbah medis padat per unit/ruangan rumah sakit.</p>
            </div>
            <div className="flex items-center gap-2 bg-white/10 backdrop-blur-md px-4 py-2 rounded-xl border border-white/20 self-start md:self-auto">
              <i className="fas fa-hospital text-emerald-200" />
              <span className="text-xs font-bold uppercase tracking-wider">{ruanganList.length} Ruangan Terdaftar</span>
            </div>
          </div>
        </div>

        {/* Form */}
        <RuanganForm
          formData={formData}
          emptyForm={EMPTY_FORM}
          setFormData={setFormData}
          handleInputChange={handleInputChange}
          handleSubmit={handleSubmit}
          submitting={submitting}
          user={user}
          ruanganList={ruanganList}
          showRuanganSheet={showRuanganSheet}
          setShowRuanganSheet={setShowRuanganSheet}
        />

        {/* Toolbar */}
        {!isMahasiswa && (
          <RuanganImportExportToolbar
            importing={importing}
            importInputRef={importInputRef}
            onDownloadTemplate={handleDownloadTemplate}
            onImportFile={handleImportFile}
            onExportExcel={handleExportExcel}
          />
        )}

        {/* Tabel */}
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
          <OfflineBanner
            data={data}
            totalOfflineCount={offlineQueueCount}
          />
          <RuanganTable
            data={data}
            loading={loading}
            page={page}
            itemsPerPage={ITEMS_PER_PAGE}
            totalData={totalData}
            filterMonth={filterMonth}
            filterDate={filterDate}
            filterRuangan={filterRuangan}
            ruanganList={ruanganList}
            setFilterMonth={setFilterMonth}
            setFilterDate={setFilterDate}
            setFilterRuangan={setFilterRuangan}
            setPage={setPage}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onPrint={isMahasiswa ? undefined : handlePrint}
          />
          <Pagination page={page} totalPages={totalPages} onPageChange={setPage} accentColor="emerald" />
        </div>

      </div>
    </Wrapper>
  );
}
