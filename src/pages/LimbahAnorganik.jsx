import { useCallback, useEffect, useRef, useState } from 'react';
import AppLayout from '../components/AppLayout';
import { supabase } from '../lib/supabase';
import Swal from 'sweetalert2';
import withReactContent from 'sweetalert2-react-content';
import { getCurrentUser, fetchDaftarRuangan, getSetting } from '../lib/api';
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

import AnorganikForm from '../components/limbah/anorganik/AnorganikForm';
import AnorganikTable from '../components/limbah/anorganik/AnorganikTable';
import OfflineBanner from '../components/limbah/OfflineBanner';
import Pagination from '../components/limbah/Pagination';
import { buildAnorganikPrintHTML } from '../components/limbah/anorganik/anorganikPrintTemplate';
import { printViaHiddenIframe } from '../lib/printHelpers';
import { getLocalDateString, getLocalMonthString } from '../lib/localDate';
import { isNetworkError } from '../lib/networkErrors';
import { fetchAllSupabaseRows } from '../lib/supabasePagination';
import {
  deleteRecordWithVersion,
  getRecordBaseVersion,
  isRecordConflictError,
  resolveOfflineRecordConflict,
  updateRecordWithVersion,
} from '../lib/recordVersion';

const MySwal = withReactContent(Swal);

function EmbeddedWrapper({ children }) {
  return <div className="bg-gray-100 min-h-screen">{children}</div>;
}
function FullWrapper({ children }) {
  return <AppLayout title="Limbah Anorganik">{children}</AppLayout>;
}

const ITEMS_PER_PAGE = 10;
const FETCH_BATCH_SIZE = 500;

// Keep the same ordering as the Supabase query so offline drafts/updates are
// merged into the correct global position before slicing the current page.
const compareAnorganikRows = (a, b) => {
  const dateA = a?.tanggal || '';
  const dateB = b?.tanggal || '';
  if (dateA !== dateB) return dateB.localeCompare(dateA);

  const waktuA = a?.waktu_input || '';
  const waktuB = b?.waktu_input || '';
  return waktuB.localeCompare(waktuA);
};

export default function LimbahAnorganik({ embedded = false }) {
  const user = getCurrentUser();
  const isMahasiswa = user?.role?.toLowerCase() === 'mahasiswa';
  const [data, setData] = useState([]);
  const [ruanganList, setRuanganList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [page, setPage] = useState(1);
  const [totalData, setTotalData] = useState(0);
  const [offlineQueueCount, setOfflineQueueCount] = useState(0);
  const [filterMonth, setFilterMonth] = useState('');
  const [filterRuangan, setFilterRuangan] = useState('');
  const [showRuanganSheet, setShowRuanganSheet] = useState(false);
  const fetchIdRef = useRef(0);

  const emptyForm = {
    id: null,
    tanggal: getLocalDateString(),
    ruangan: '',
    infus: '',
    jerigen: '',
    kertas: '',
    kardus: '',
    botol_mineral: '',
    bayclin_dll: '',
    keterangan: '',
  };
  const [formData, setFormData] = useState(emptyForm);

  useEffect(() => {
    fetchDaftarRuangan().then(setRuanganList);
  }, []);

  const fetchData = useCallback(async () => {
    const currentFetchId = ++fetchIdRef.current;
    setLoading(true);
    try {
      let dbData = [];
      let count = 0;
      setOfflineQueueCount(getOfflineQueue().filter(item => item.table === 'limbah_anorganik').length);

      // Hide every stale server version, even when its offline replacement
      // moved to a different room or month and no longer matches this filter.
      const allUnsynced = getUnsyncedItemsForTable('limbah_anorganik');
      let unsynced = allUnsynced;
      if (filterMonth) unsynced = unsynced.filter(i => i.tanggal?.startsWith(filterMonth));
      if (filterRuangan) unsynced = unsynced.filter(i => i.ruangan === filterRuangan);

      const delIds = new Set(getOfflineDeletedIds('limbah_anorganik'));
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
        let queryCount = supabase
          .from('limbah_anorganik')
          .select('id', { count: 'exact', head: true });

        if (filterMonth) {
          const [year, month] = filterMonth.split('-');
          const start = `${year}-${month}-01`;
          const end = `${year}-${month}-${String(new Date(year, month, 0).getDate()).padStart(2, '0')}`;
          queryCount = queryCount.gte('tanggal', start).lte('tanggal', end);
        }
        if (filterRuangan) queryCount = queryCount.eq('ruangan', filterRuangan);
        if (excludedIds) queryCount = queryCount.not('id', 'in', excludedIds);

        const { count: c, error: countError } = await queryCount;
        if (countError) throw countError;
        count = c || 0;

        const pageStartIndex = (page - 1) * ITEMS_PER_PAGE;
        dbStartIndex = Math.max(0, pageStartIndex - unsynced.length);
        const dbEndIndex = pageStartIndex + ITEMS_PER_PAGE - 1;

        for (let from = dbStartIndex; from <= dbEndIndex; from += FETCH_BATCH_SIZE) {
          const to = Math.min(from + FETCH_BATCH_SIZE - 1, dbEndIndex);
          let queryData = supabase
            .from('limbah_anorganik')
            .select('id, tanggal, ruangan, infus, jerigen, kertas, kardus, botol_mineral, bayclin_dll, keterangan, petugas, waktu_input, created_by')
            .order('tanggal', { ascending: false })
            .order('waktu_input', { ascending: false })
            .range(from, to);

          if (filterMonth) {
            const [year, month] = filterMonth.split('-');
            const start = `${year}-${month}-01`;
            const end = `${year}-${month}-${String(new Date(year, month, 0).getDate()).padStart(2, '0')}`;
            queryData = queryData.gte('tanggal', start).lte('tanggal', end);
          }
          if (filterRuangan) queryData = queryData.eq('ruangan', filterRuangan);
          if (excludedIds) queryData = queryData.not('id', 'in', excludedIds);

          const { data: result, error } = await queryData;
          if (error) throw error;

          const batch = result || [];
          dbData.push(...batch);
          if (batch.length < to - from + 1) break;
        }

        cacheServerRows('limbah_anorganik', dbData);
        dbFetchSucceeded = true;
      } catch (e) {
        console.warn('Handling offline/network error fetching limbah anorganik:', e);
        dbData = getCachedServerRows('limbah_anorganik').filter(item => {
          if (hiddenServerIds.has(String(item.id))) return false;
          if (filterMonth && !item.tanggal?.startsWith(filterMonth)) return false;
          if (filterRuangan && item.ruangan !== filterRuangan) return false;
          return true;
        });
        count = dbData.length;
      }

      if (currentFetchId !== fetchIdRef.current) return;

      const filteredDb = dbData.filter(item => !hiddenServerIds.has(String(item.id)));
      const mergedData = [...unsynced, ...filteredDb].sort(compareAnorganikRows);
      const adjustedTotal = Math.max(0, count + unsynced.length);
      setTotalData(adjustedTotal);

      const lastAvailablePage = Math.max(1, Math.ceil(adjustedTotal / ITEMS_PER_PAGE));
      if (page > lastAvailablePage) {
        setPage(lastAvailablePage);
        return;
      }

      const fromIndex = (page - 1) * ITEMS_PER_PAGE;
      const localStartIndex = dbFetchSucceeded ? fromIndex - dbStartIndex : fromIndex;
      setData(mergedData.slice(localStartIndex, localStartIndex + ITEMS_PER_PAGE));
    } catch (error) {
      console.error('Error fetching limbah anorganik:', error);
    } finally {
      if (currentFetchId === fetchIdRef.current) setLoading(false);
    }
  }, [filterMonth, filterRuangan, page]);

  useEffect(() => {
    fetchData();
    const handleQueueChange = (event) => {
      if (event.type === 'offline-queue-changed' && event.changedTables?.length &&
        !event.changedTables.includes('limbah_anorganik')) {
        return;
      }
      fetchData();
    };
    window.addEventListener('offline-queue-changed', handleQueueChange);
    window.addEventListener('online', handleQueueChange);
    window.addEventListener('offline', handleQueueChange);
    return () => {
      window.removeEventListener('offline-queue-changed', handleQueueChange);
      window.removeEventListener('online', handleQueueChange);
      window.removeEventListener('offline', handleQueueChange);
    };
  }, [fetchData]);

  // Reset to the first page whenever a filter changes so a previously selected
  // page cannot become empty after the result set shrinks.
  useEffect(() => {
    setPage(1);
  }, [filterMonth, filterRuangan]);

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
    if (!Number.isInteger(Number(formData.jerigen)) || Number(formData.jerigen) < 0) {
      MySwal.fire('Peringatan', 'Jumlah jerigen harus berupa bilangan bulat karena dihitung per buah.', 'warning');
      return;
    }
    setSubmitting(true);

    const payload = {
      tanggal: formData.tanggal,
      ruangan: formData.ruangan,
      petugas: user?.nama || 'Petugas',
      infus: parseFloat(formData.infus) || 0,
      jerigen: parseFloat(formData.jerigen) || 0,
      kertas: parseFloat(formData.kertas) || 0,
      kardus: parseFloat(formData.kardus) || 0,
      botol_mineral: parseFloat(formData.botol_mineral) || 0,
      bayclin_dll: parseFloat(formData.bayclin_dll) || 0,
      keterangan: formData.keterangan || '',
      waktu_input: new Date().toISOString(),
    };
    const insertPayload = { ...payload, created_by: user?.id };
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
        saveToOfflineQueue('limbah_anorganik', formData.id ? 'update' : 'insert',
          formData.id ? { ...payload, id: recordId } : insertPayload,
          `Input Limbah Anorganik ${formData.ruangan}`,
          { baseUpdatedAt });
        MySwal.fire({
          icon: 'info',
          title: 'Tersimpan Offline',
          text: isLocalDraft && navigator.onLine
            ? 'Perubahan draft tersimpan dan menunggu sinkronisasi.'
            : 'Data telah disimpan di HP (Draft). Akan otomatis dikirim saat terhubung internet.',
          confirmButtonColor: '#0891b2',
        });
      } else {
        if (formData.id) {
          const pendingRecordUpdate = getOfflineQueue().find(item => {
            if (item.table !== 'limbah_anorganik') return false;
            const references = [item.serverId, item.payload?.id, item.payload?.serverId];
            return references.some(reference => reference != null && String(reference) === String(recordId));
          });

          if (pendingRecordUpdate) {
            await syncOfflineQueue(false, true);
            const stillPending = getOfflineQueue().some(item => item.id === pendingRecordUpdate.id);
            if (!stillPending && pendingRecordUpdate.action === 'update') {
              baseUpdatedAt = pendingRecordUpdate.payload?.waktu_input || baseUpdatedAt;
            }
          }

          await updateRecordWithVersion('limbah_anorganik', recordId, payload, baseUpdatedAt);
          cacheServerRows('limbah_anorganik', [{ ...payload, id: recordId }]);
          if (pendingRecordUpdate) removeLocalRecordQueue({ id: recordId });
          MySwal.fire('Berhasil', 'Data limbah anorganik berhasil diubah', 'success');
        } else {
          const { error } = await supabase.from('limbah_anorganik').insert([insertPayload]);
          if (error) throw error;
          MySwal.fire('Berhasil', 'Data limbah anorganik berhasil ditambahkan', 'success');
        }
      }
      setFormData(emptyForm);
      fetchData();
    } catch (error) {
      if (isNetworkError(error)) {
        saveToOfflineQueue('limbah_anorganik', formData.id ? 'update' : 'insert',
          formData.id ? { ...payload, id: recordId } : insertPayload,
          `Input Limbah Anorganik ${formData.ruangan}`,
          { baseUpdatedAt });
        MySwal.fire({ icon: 'info', title: 'Tersimpan Offline', text: 'Jaringan terputus. Data telah disimpan di HP (Draft) dan akan dikirim otomatis.', confirmButtonColor: '#0891b2' });
        setFormData(emptyForm);
      } else if (isRecordConflictError(error)) {
        MySwal.fire('Data Sudah Berubah', error.message, 'warning');
        fetchData();
      } else {
        MySwal.fire('Gagal', error.message, 'error');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = async (item) => {
    try {
      const resolution = await resolveOfflineRecordConflict('limbah_anorganik', item, MySwal);
      if (!resolution) return;
      if (resolution.discardDraft) removeLocalRecordQueue({ id: item.id });
      if (!resolution.record) { fetchData(); return; }
      item = resolution.record;
      if (resolution.discardDraft) cacheServerRows('limbah_anorganik', [item]);
    } catch (error) {
      MySwal.fire('Gagal', error.message, 'error');
      return;
    }

    setFormData({
      id: item.id,
      tanggal: item.tanggal,
      ruangan: item.ruangan || '',
      infus: item.infus,
      jerigen: item.jerigen,
      kertas: item.kertas,
      kardus: item.kardus,
      botol_mineral: item.botol_mineral,
      bayclin_dll: item.bayclin_dll,
      keterangan: item.keterangan || '',
      baseUpdatedAt: getRecordBaseVersion(item),
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (item) => {
    const confirm = await MySwal.fire({
      title: 'Hapus Data Limbah Anorganik?',
      text: 'Data yang dihapus tidak dapat dikembalikan!',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Ya, Hapus!',
    });
    if (!confirm.isConfirmed) return;

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
          'limbah_anorganik',
          'delete',
          item,
          `Hapus Limbah Anorganik ${item.ruangan || ''}`,
          { baseUpdatedAt: getRecordBaseVersion(item) }
        );
        MySwal.fire({ icon: 'info', title: 'Tersimpan Offline', text: 'Perintah hapus disimpan di HP. Akan diproses otomatis saat terhubung internet.', confirmButtonColor: '#0891b2' });
        fetchData();
        return;
      }

      await deleteRecordWithVersion('limbah_anorganik', item.id, getRecordBaseVersion(item));

      removeLocalRecordQueue(item);
      removeCachedServerRow('limbah_anorganik', item.id);
      MySwal.fire('Terhapus', 'Data berhasil dihapus', 'success');
      fetchData();
    } catch (error) {
      if (isNetworkError(error)) {
        saveToOfflineQueue(
          'limbah_anorganik',
          'delete',
          item,
          `Hapus Limbah Anorganik ${item.ruangan || ''}`,
          { baseUpdatedAt: getRecordBaseVersion(item) }
        );
        MySwal.fire({ icon: 'info', title: 'Tersimpan Offline', text: 'Jaringan terputus. Perintah hapus disimpan dan akan diproses otomatis.', confirmButtonColor: '#0891b2' });
        fetchData();
      } else if (isRecordConflictError(error)) {
        MySwal.fire('Data Sudah Berubah', error.message, 'warning');
        fetchData();
      } else {
        MySwal.fire('Gagal', error.message, 'error');
      }
    }
  };

  // ── Print ─────────────────────────────────────────────────────────────────
  const handlePrint = async () => {
    const currentMonth = filterMonth || getLocalMonthString();
    const { value: fv } = await MySwal.fire({
      title: 'Cetak Laporan Limbah Anorganik',
      html: `<div class="text-left mt-4 space-y-4"><div><label class="block text-sm font-bold text-gray-700 mb-1.5">Bulan &amp; Tahun</label><input id="swal-print-month" type="month" class="w-full border border-gray-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-cyan-500 outline-none text-sm bg-gray-50" value="${currentMonth}"/></div><div><label class="block text-sm font-bold text-gray-700 mb-1.5">Ruangan (Opsional)</label><select id="swal-print-ruangan" class="w-full border border-gray-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-cyan-500 outline-none text-sm bg-gray-50 appearance-none"><option value="">-- Semua Ruangan --</option>${ruanganList.map(r => `<option value="${r}">${r}</option>`).join('')}</select></div></div>`,
      focusConfirm: false,
      showCancelButton: true,
      confirmButtonText: '<i class="fas fa-print mr-2"></i>Cetak',
      cancelButtonText: 'Batal',
      confirmButtonColor: '#2563eb',
      preConfirm: () => {
        const mi = document.getElementById('swal-print-month');
        if (!mi?.value) { Swal.showValidationMessage('Silakan pilih bulan terlebih dahulu.'); return false; }
        return { month: mi.value, ruangan: document.getElementById('swal-print-ruangan')?.value || '' };
      },
    });
    if (!fv) return;
    const { month: sel, ruangan: selR } = fv;
    const [y, m] = sel.split('-');
    const s = `${y}-${m}-01`;
    const en = `${y}-${m}-${String(new Date(+y, +m, 0).getDate()).padStart(2, '0')}`;
    const MONTH_NAMES = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
    const periodeText = `${MONTH_NAMES[+m - 1]} ${y}`;
    const ruanganText = selR ? `Ruangan: ${selR}` : 'Semua Ruangan';
    const printedDate = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
    try {
      MySwal.fire({ title: 'Menyiapkan Laporan...', html: 'Mohon tunggu, data sedang diproses.', allowOutsideClick: false, allowEscapeKey: false, didOpen: () => MySwal.showLoading() });
      const printData = await fetchAllSupabaseRows(() => {
        let query = supabase.from('limbah_anorganik')
          .select('tanggal, ruangan, infus, jerigen, kertas, kardus, botol_mineral, bayclin_dll, petugas, keterangan')
          .gte('tanggal', s)
          .lte('tanggal', en)
          .order('tanggal', { ascending: true })
          .order('ruangan', { ascending: true })
          .order('id', { ascending: true });
        if (selR) query = query.eq('ruangan', selR);
        return query;
      });
      if (!printData?.length) {
        MySwal.fire({ icon: 'info', title: 'Tidak Ada Data', text: 'Tidak ada data limbah anorganik untuk periode dan ruangan yang dipilih.', confirmButtonColor: '#2563eb' });
        return;
      }
      const kepalaUnit = await getSetting('kepala_unit_sanitasi', null);
      const html = buildAnorganikPrintHTML(printData, periodeText, ruanganText, printedDate, kepalaUnit);
      MySwal.close();
      const printed = await printViaHiddenIframe(html);
      if (!printed) {
        MySwal.fire('Gagal', 'Browser tidak dapat membuka dialog cetak.', 'error');
      }
    } catch (error) {
      MySwal.fire({ icon: 'error', title: 'Gagal Mencetak', text: 'Terjadi kesalahan: ' + error.message, confirmButtonColor: '#dc2626' });
    }
  };

  const totalPages = Math.ceil(totalData / ITEMS_PER_PAGE);
  const Wrapper = embedded ? EmbeddedWrapper : FullWrapper;

  return (
    <Wrapper>
      <div className="container mx-auto px-4 py-8">
        <div className="bg-linear-to-r from-cyan-600 via-sky-600 to-blue-700 text-white rounded-2xl shadow-xl p-6 mb-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-black tracking-tight flex items-center gap-3">
                <span className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                  <i className="fas fa-recycle text-xl" />
                </span>
                Input Data Limbah Anorganik
              </h1>
              <p className="text-cyan-100 text-sm mt-1">
                Catat timbulan limbah anorganik per ruangan/unit (infus, jerigen, kertas, kardus, botol mineral, bayclin dll).
              </p>
            </div>
            <div className="flex items-center gap-2 bg-white/10 backdrop-blur-md px-4 py-2 rounded-xl border border-white/20 self-start md:self-auto">
              <i className="fas fa-hospital text-cyan-200" />
              <span className="text-xs font-bold uppercase tracking-wider">{ruanganList.length} Ruangan Terdaftar</span>
            </div>
          </div>
        </div>

        <AnorganikForm
          formData={formData}
          emptyForm={emptyForm}
          setFormData={setFormData}
          handleInputChange={handleInputChange}
          handleSubmit={handleSubmit}
          submitting={submitting}
          user={user}
          ruanganList={ruanganList}
          showRuanganSheet={showRuanganSheet}
          setShowRuanganSheet={setShowRuanganSheet}
        />

        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
          <OfflineBanner data={data} totalOfflineCount={offlineQueueCount} />
          <AnorganikTable
            data={data}
            loading={loading}
            page={page}
            itemsPerPage={ITEMS_PER_PAGE}
            filterMonth={filterMonth}
            filterRuangan={filterRuangan}
            ruanganList={ruanganList}
            totalData={totalData}
            setFilterMonth={setFilterMonth}
            setFilterRuangan={setFilterRuangan}
            setPage={setPage}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onPrint={isMahasiswa ? undefined : handlePrint}
          />
          <Pagination
            page={page}
            totalPages={totalPages}
            onPageChange={setPage}
            accentColor="cyan"
          />
        </div>
      </div>
    </Wrapper>
  );
}
