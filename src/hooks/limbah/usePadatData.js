import { ITEMS_PER_PAGE } from '../../lib/limbah/constants';
import { useState, useEffect, useRef, useCallback } from 'react';
import { getOfflineQueue } from '../../lib/offlineStorage';
import { getLocalMonthString } from '../../lib/localDate';
import { getAccumulatedData } from '../../lib/limbah/padatData';

export default function usePadatData() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalData, setTotalData] = useState(0);
  const [offlineQueueCount, setOfflineQueueCount] = useState(0);
  const [filterMonth, setFilterMonth] = useState(() => getLocalMonthString());
  const fetchIdRef = useRef(0);
  const [accumulatedData, setAccumulatedData] = useState([]);
  const fetchData = useCallback(async () => {
    const currentFetchId = ++fetchIdRef.current;
    setLoading(true);
    try {
      setOfflineQueueCount(getOfflineQueue().filter(item => item.table === 'limbah_padat' || item.table === 'limbah_ruangan').length);
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
  }, [filterMonth]);

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
    const handleQueueChange = event => {
      if (event.syncInProgress) return;
      const relevantTables = ['limbah_padat', 'limbah_ruangan'];
      const changedTables = event.changedTables || event.detail?.changedTables;
      if (changedTables?.length && !changedTables.some(table => relevantTables.includes(table))) {
        return;
      }
      window.clearTimeout(queueRefreshTimer);
      queueRefreshTimer = window.setTimeout(h, 180);
    };
    window.addEventListener('offline-queue-changed', handleQueueChange);
    window.addEventListener('offline-sync-finished', handleQueueChange);
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
      window.removeEventListener('offline-sync-finished', handleQueueChange);
      window.removeEventListener('offline', h);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [fetchData]);
  return {
    data,
    loading,
    page,
    setPage,
    totalData,
    offlineQueueCount,
    filterMonth,
    setFilterMonth,
    fetchData
  };
}
