import { ITEMS_PER_PAGE, FETCH_BATCH_SIZE } from '../../lib/limbah/constants';
import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { fetchDaftarRuangan } from '../../lib/api';
import { getOfflineQueue, getUnsyncedItemsForTable, getOfflineDeletedIds, getCachedServerRows, cacheServerRows } from '../../lib/offlineStorage';
import { compareWasteRows } from '../../lib/limbah/rowOrder';

export default function useRuanganData() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalData, setTotalData] = useState(0);
  const [offlineQueueCount, setOfflineQueueCount] = useState(0);
  const [filterMonth, setFilterMonth] = useState('');
  const fetchIdRef = useRef(0);
  const [ruanganList, setRuanganList] = useState([]);
  const [filterRuangan, setFilterRuangan] = useState('');
  const [filterDate, setFilterDate] = useState('');
  useEffect(() => {
    fetchDaftarRuangan().then(setRuanganList);
  }, []);
  const fetchData = useCallback(async () => {
    const currentFetchId = ++fetchIdRef.current;
    setLoading(true);
    try {
      let dbData = [],
        count = 0;

      // Overlay offline dibaca lebih dulu karena baris ini harus ikut serta
      // dalam penghitungan halaman (bukan ditempel begitu saja di setiap
      // halaman hasil query DB).
      const tableQueue = getOfflineQueue().filter(item => item.table === 'limbah_ruangan');
      setOfflineQueueCount(tableQueue.length);
      const allUnsynced = getUnsyncedItemsForTable('limbah_ruangan');
      let unsynced = allUnsynced;
      if (filterDate) unsynced = unsynced.filter(i => i.tanggal === filterDate);else if (filterMonth) unsynced = unsynced.filter(i => i.tanggal?.startsWith(filterMonth));
      if (filterRuangan) unsynced = unsynced.filter(i => i.ruangan === filterRuangan);
      const delIds = new Set(getOfflineDeletedIds('limbah_ruangan'));
      // Semua versi server yang sudah diedit offline harus disembunyikan,
      // termasuk ketika versi barunya tidak lagi cocok dengan filter aktif.
      const hiddenServerIds = new Set([...allUnsynced.filter(item => item.offlineAction === 'update').map(item => String(item.id)), ...delIds]);
      const excludedIds = hiddenServerIds.size > 0 ? `(${Array.from(hiddenServerIds).join(',')})` : null;
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
          let qData = supabase.from('limbah_ruangan').select('id, tanggal, ruangan, infeksius, jarum_suntik, botol_obat, sitotoksik, petugas, keterangan, waktu_input, created_by', {
            count: 'exact'
          }).order('tanggal', {
            ascending: false
          }).order('waktu_input', {
            ascending: false
          }).range(from, to);
          if (filterDate) {
            qData = qData.eq('tanggal', filterDate);
          } else if (filterMonth) {
            const [y, m] = filterMonth.split('-');
            const s = `${y}-${m}-01`,
              en = `${y}-${m}-${String(new Date(y, m, 0).getDate()).padStart(2, '0')}`;
            qData = qData.gte('tanggal', s).lte('tanggal', en);
          }
          if (filterRuangan) qData = qData.eq('ruangan', filterRuangan);
          if (excludedIds) qData = qData.not('id', 'in', excludedIds);
          const {
            data: result,
            count: queryCount,
            error
          } = await qData;
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
      const mergedData = [...unsynced, ...filteredDb].sort(compareWasteRows);

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
  }, [page, filterMonth, filterDate, filterRuangan]);
  useEffect(() => {
    fetchData();
    const h = () => fetchData();
    let queueRefreshTimer;
    const handleQueueChange = event => {
      if (event.syncInProgress) return;
      const changedTables = event.changedTables || event.detail?.changedTables;
      if (changedTables?.length && !changedTables.includes('limbah_ruangan')) return;
      window.clearTimeout(queueRefreshTimer);
      queueRefreshTimer = window.setTimeout(h, 180);
    };
    window.addEventListener('offline-queue-changed', handleQueueChange);
    window.addEventListener('offline-sync-finished', handleQueueChange);
    window.addEventListener('offline', h);
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') h();
    };
    document.addEventListener('visibilitychange', handleVisibility);
    const {
      data: {
        subscription
      }
    } = supabase.auth.onAuthStateChange(event => {
      if (['INITIAL_SESSION', 'SIGNED_IN', 'TOKEN_REFRESHED'].includes(event)) h();
    });
    return () => {
      window.clearTimeout(queueRefreshTimer);
      window.removeEventListener('offline-queue-changed', handleQueueChange);
      window.removeEventListener('offline-sync-finished', handleQueueChange);
      window.removeEventListener('offline', h);
      document.removeEventListener('visibilitychange', handleVisibility);
      subscription?.unsubscribe();
    };
  }, [fetchData]);

  // ── Handlers form ─────────────────────────────────────────────────────────────

  return {
    data,
    loading,
    page,
    setPage,
    totalData,
    offlineQueueCount,
    filterMonth,
    setFilterMonth,
    fetchData,
    ruanganList,
    filterRuangan,
    setFilterRuangan,
    filterDate,
    setFilterDate,
    setData,
    setTotalData,
    setOfflineQueueCount
  };
}
