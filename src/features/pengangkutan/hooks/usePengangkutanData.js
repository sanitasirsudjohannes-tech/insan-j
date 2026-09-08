import { useCallback, useEffect, useRef, useState } from 'react';
import {
  cacheServerRows, getCachedServerRows, getOfflineDeletedIds, getOfflineQueue,
  getUnsyncedItemsForTable
} from '../../../lib/offlineStorage';
import {
  countPengangkutan,
  fetchPengangkutanPage
} from '../services/pengangkutanService';

const ITEMS_PER_PAGE = 10;
const FETCH_BATCH_SIZE = 500;

const comparePengangkutanRows = (a, b) => {
  const dateComparison = String(b?.tanggal || '').localeCompare(String(a?.tanggal || ''));
  if (dateComparison) return dateComparison;
  return String(b?.waktu_input || '').localeCompare(String(a?.waktu_input || ''));
};

export default function usePengangkutanData() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalData, setTotalData] = useState(0);
  const [offlineQueueCount, setOfflineQueueCount] = useState(0);
  const [filterMonth, setFilterMonth] = useState('');
  const fetchIdRef = useRef(0);

    const fetchData = useCallback(async () => {
        const currentFetchId = ++fetchIdRef.current;
        setLoading(true);
        try {
            let dbData = [];
            let count = 0;
            setOfflineQueueCount(
                getOfflineQueue().filter(item => item.table === 'pengangkutan_limbah').length
            );

            const allUnsynced = getUnsyncedItemsForTable('pengangkutan_limbah');
            let unsynced = allUnsynced;
            if (filterMonth) {
                unsynced = unsynced.filter(item => item.tanggal?.startsWith(filterMonth));
            }

            const deletedIds = new Set(getOfflineDeletedIds('pengangkutan_limbah'));
            const hiddenServerIds = new Set([
                ...allUnsynced
                    .filter(item => item.offlineAction === 'update')
                    .map(item => String(item.id)),
                ...deletedIds,
            ]);
            const excludedIds = hiddenServerIds.size > 0
                ? `(${Array.from(hiddenServerIds).join(',')})`
                : null;

            let dbFetchSucceeded = false;
            let dbStartIndex = 0;
            try {
                if (!navigator.onLine) throw new Error('Perangkat sedang offline.');

                count = await countPengangkutan(filterMonth, excludedIds);

                const pageStartIndex = (page - 1) * ITEMS_PER_PAGE;
                dbStartIndex = Math.max(0, pageStartIndex - unsynced.length);
                const dbEndIndex = pageStartIndex + ITEMS_PER_PAGE - 1;

                for (let from = dbStartIndex; from <= dbEndIndex; from += FETCH_BATCH_SIZE) {
                    const to = Math.min(from + FETCH_BATCH_SIZE - 1, dbEndIndex);
                    const batch = await fetchPengangkutanPage({
                        from, to, monthValue: filterMonth, excludedIds
                    });
                    dbData.push(...batch);
                    if (batch.length < to - from + 1) break;
                }

                cacheServerRows('pengangkutan_limbah', dbData);
                dbFetchSucceeded = true;
            } catch (e) {
                console.warn('Handling offline DB error in PengangkutanLimbah:', e);
                dbData = getCachedServerRows('pengangkutan_limbah').filter(item => {
                    if (hiddenServerIds.has(String(item.id))) return false;
                    return !filterMonth || item.tanggal?.startsWith(filterMonth);
                });
                count = dbData.length;
            }

            if (currentFetchId !== fetchIdRef.current) return;

            const mergedData = [
                ...unsynced,
                ...dbData.filter(item => !hiddenServerIds.has(String(item.id))),
            ].sort(comparePengangkutanRows);
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
        } catch (e) {
            console.error('Gagal mengambil data pengangkutan:', e);
        } finally {
            if (currentFetchId === fetchIdRef.current) setLoading(false);
        }
    }, [filterMonth, page]);

    useEffect(() => {
        fetchData();

        let queueRefreshTimer;
        const handleQueueChange = (event) => {
            if (event.syncInProgress) return;
            const changedTables = event.changedTables || event.detail?.changedTables;
            if (changedTables?.length && !changedTables.includes('pengangkutan_limbah')) return;
            window.clearTimeout(queueRefreshTimer);
            queueRefreshTimer = window.setTimeout(fetchData, 180);
        };
        const handleVisibility = () => {
            if (document.visibilityState === 'visible') fetchData();
        };
        window.addEventListener('offline-queue-changed', handleQueueChange);
        window.addEventListener('offline-sync-finished', handleQueueChange);
        window.addEventListener('offline', handleQueueChange);
        document.addEventListener('visibilitychange', handleVisibility);

        return () => {
            window.clearTimeout(queueRefreshTimer);
            window.removeEventListener('offline-queue-changed', handleQueueChange);
            window.removeEventListener('offline-sync-finished', handleQueueChange);
            window.removeEventListener('offline', handleQueueChange);
            document.removeEventListener('visibilitychange', handleVisibility);
        };
    }, [fetchData]);


  return {
    data, loading, page, setPage, totalData, offlineQueueCount,
    filterMonth, setFilterMonth, fetchData,
    itemsPerPage: ITEMS_PER_PAGE,
    totalPages: Math.ceil(totalData / ITEMS_PER_PAGE)
  };
}
