import { ITEMS_PER_PAGE, FETCH_BATCH_SIZE } from '../../lib/limbah/constants';
import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { fetchDaftarRuangan } from '../../lib/api';
import { getOfflineQueue, getUnsyncedItemsForTable, getOfflineDeletedIds, getCachedServerRows, cacheServerRows } from '../../lib/offlineStorage';
import { getLocalMonthString } from '../../lib/localDate';
import { compareWasteRows } from '../../lib/limbah/rowOrder';

export default function useAnorganikData() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalData, setTotalData] = useState(0);
  const [offlineQueueCount, setOfflineQueueCount] = useState(0);
  const [filterMonth, setFilterMonth] = useState(() => getLocalMonthString());
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
      let dbData = [];
      let count = 0;
      setOfflineQueueCount(getOfflineQueue().filter(item => item.table === 'limbah_anorganik').length);

      // Hide every stale server version, even when its offline replacement
      // moved to a different room/date/month and no longer matches this filter.
      const allUnsynced = getUnsyncedItemsForTable('limbah_anorganik');
      let unsynced = allUnsynced;
      if (filterDate) {
        unsynced = unsynced.filter(i => i.tanggal === filterDate);
      } else if (filterMonth) {
        unsynced = unsynced.filter(i => i.tanggal?.startsWith(filterMonth));
      }
      if (filterRuangan) unsynced = unsynced.filter(i => i.ruangan === filterRuangan);

      const delIds = new Set(getOfflineDeletedIds('limbah_anorganik'));
      const hiddenServerIds = new Set([
        ...allUnsynced.filter(item => item.offlineAction === 'update').map(item => String(item.id)),
        ...delIds
      ]);
      const excludedIds = hiddenServerIds.size > 0 ? `(${Array.from(hiddenServerIds).join(',')})` : null;
      let dbFetchSucceeded = false;
      let dbStartIndex = 0;

      try {
        if (!navigator.onLine) throw new Error('Perangkat sedang offline.');

        let queryCount = supabase.from('limbah_anorganik').select('id', {
          count: 'exact',
          head: true
        });
        if (filterDate) {
          queryCount = queryCount.eq('tanggal', filterDate);
        } else if (filterMonth) {
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

          if (filterDate) {
            queryData = queryData.eq('tanggal', filterDate);
          } else if (filterMonth) {
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
          if (filterDate && item.tanggal !== filterDate) return false;
          if (!filterDate && filterMonth && !item.tanggal?.startsWith(filterMonth)) return false;
          if (filterRuangan && item.ruangan !== filterRuangan) return false;
          return true;
        });
        count = dbData.length;
      }

      if (currentFetchId !== fetchIdRef.current) return;
      const filteredDb = dbData.filter(item => !hiddenServerIds.has(String(item.id)));
      const mergedData = [...unsynced, ...filteredDb].sort(compareWasteRows);
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
  }, [filterMonth, filterDate, filterRuangan, page]);

  useEffect(() => {
    fetchData();
    let queueRefreshTimer;
    const handleQueueChange = event => {
      if (event.syncInProgress) return;
      const changedTables = event.changedTables || event.detail?.changedTables;
      if (changedTables?.length && !changedTables.includes('limbah_anorganik')) return;
      window.clearTimeout(queueRefreshTimer);
      queueRefreshTimer = window.setTimeout(fetchData, 180);
    };
    window.addEventListener('offline-queue-changed', handleQueueChange);
    window.addEventListener('offline-sync-finished', handleQueueChange);
    window.addEventListener('offline', handleQueueChange);
    return () => {
      window.clearTimeout(queueRefreshTimer);
      window.removeEventListener('offline-queue-changed', handleQueueChange);
      window.removeEventListener('offline-sync-finished', handleQueueChange);
      window.removeEventListener('offline', handleQueueChange);
    };
  }, [fetchData]);

  useEffect(() => {
    setPage(1);
  }, [filterMonth, filterDate, filterRuangan]);

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
    setFilterDate
  };
}
