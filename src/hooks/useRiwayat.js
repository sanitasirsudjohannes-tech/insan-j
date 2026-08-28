import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { getUnsyncedItemsForTable, getOfflineDeletedIds } from '../lib/offlineStorage';

const RIWAYAT_TABLES = [
  { name: 'ruang_bangunan', formName: 'Ruang Bangunan', formId: 'ruang_bangunan' },
  { name: 'limbah_medis', formName: 'Pengolahan Limbah', formId: 'pengolahan_limbah' },
  { name: 'pemeriksaan_toilet', formName: 'Kebersihan Toilet', formId: 'toilet' },
  { name: 'pemeriksaan_reservoir', formName: 'Kebersihan Bak Reservoir', formId: 'reservoir' },
  { name: 'pemeriksaan_gizi', formName: 'Ceklist Gizi', formId: 'gizi' }
];

const RIWAYAT_TABLE_NAMES = new Set(RIWAYAT_TABLES.map(table => table.name));

export function useRiwayat({ user, isAdmin, selectedMonth }) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchRiwayat = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const promises = RIWAYAT_TABLES.map(async (table) => {
        let query = supabase
          .from(table.name)
          .select('id, tanggal_pemeriksaan, ruangan, total, nilai_maks, persen, petugas, waktu_input');

        if (!isAdmin) {
          query = query.eq('petugas', user?.nama);
        }

        if (selectedMonth) {
          const startDate = `${selectedMonth}-01`;
          const dateObj = new Date(startDate);
          dateObj.setMonth(dateObj.getMonth() + 1);
          const endDate = dateObj.toISOString().split('T')[0];
          query = query.gte('tanggal_pemeriksaan', startDate).lt('tanggal_pemeriksaan', endDate);
        }

        let dbData = [];
        try {
          const { data: resData, error: err } = await query;
          if (err) throw new Error(err.message);
          dbData = resData || [];
        } catch (e) {
          console.warn(`Offline or network error fetching ${table.name}`, e);
        }

        let unsynced = getUnsyncedItemsForTable(table.name);
        const delIds = new Set(getOfflineDeletedIds(table.name));
        const unsyncedIds = new Set(unsynced.map(u => String(u.id)));

        if (!isAdmin) {
          unsynced = unsynced.filter(item => item.petugas === user?.nama);
        }

        if (selectedMonth) {
          unsynced = unsynced.filter(item => item.tanggal_pemeriksaan && item.tanggal_pemeriksaan.startsWith(selectedMonth));
        }

        const combinedData = [
          ...unsynced,
          ...dbData.filter(d => !unsyncedIds.has(String(d.id)) && !delIds.has(String(d.id)))
        ];

        return combinedData.map(item => ({
          // Pertahankan nilai checklist dan metadata antrean. Tanpa metadata
          // ini, draft off_... keliru dianggap sebagai record Supabase.
          ...item,
          id: `${table.name}_${item.id}`,
          originalId: item.id,
          tanggal: item.tanggal_pemeriksaan,
          formName: table.formName,
          formId: table.formId,
          tableName: table.name,
          lokasi: item.ruangan,
          nilai: item.total,
          maksimal: item.nilai_maks,
          persentase: item.persen ? parseFloat(item.persen) : 0,
          petugas: item.petugas,
          waktu_input: item.waktu_input,
          isOffline: Boolean(item.isOffline),
          offlineId: item.offlineId || null,
          offlineAction: item.offlineAction || null,
          offlineBaseUpdatedAt: item.offlineBaseUpdatedAt || null,
          offlineSyncAttempts: Number(item.offlineSyncAttempts) || 0,
          offlineSyncError: item.offlineSyncError || null,
          offlineNextRetryAt: item.offlineNextRetryAt || null,
          offlineRequiresManualRetry: Boolean(item.offlineRequiresManualRetry),
          offlineHasConflict: Boolean(item.offlineHasConflict)
        }));
      });

      const results = await Promise.all(promises);
      const allData = results.flat().sort((a, b) => {
        const dateA = new Date(a.tanggal).getTime();
        const dateB = new Date(b.tanggal).getTime();
        if (dateB !== dateA) return dateB - dateA;

        const timeA = new Date(a.waktu_input || 0).getTime();
        const timeB = new Date(b.waktu_input || 0).getTime();
        return timeB - timeA;
      });

      setData(allData);
    } catch (err) {
      console.error(err);
      setError('Gagal memuat data dari server Supabase. ' + err.message);
    } finally {
      setLoading(false);
    }
  }, [user?.nama, isAdmin, selectedMonth]);

  useEffect(() => {
    fetchRiwayat();
  }, [fetchRiwayat]);

  useEffect(() => {
    let refreshTimer;
    const refreshAfterQueueChange = event => {
      if (event.syncInProgress) return;
      const changedTables = event.changedTables || event.detail?.changedTables;
      if (changedTables?.length && !changedTables.some(table => RIWAYAT_TABLE_NAMES.has(table))) {
        return;
      }

      window.clearTimeout(refreshTimer);
      refreshTimer = window.setTimeout(fetchRiwayat, 180);
    };

    window.addEventListener('offline-queue-changed', refreshAfterQueueChange);
    window.addEventListener('offline-sync-finished', refreshAfterQueueChange);

    return () => {
      window.clearTimeout(refreshTimer);
      window.removeEventListener('offline-queue-changed', refreshAfterQueueChange);
      window.removeEventListener('offline-sync-finished', refreshAfterQueueChange);
    };
  }, [fetchRiwayat]);

  return { data, loading, error, fetchRiwayat, setData };
}
