import { supabase } from '../supabase';
import { getUnsyncedItemsForTable, getOfflineDeletedIds, getCachedServerRows, cacheServerRows } from '../offlineStorage';
import { fetchAllSupabaseRows } from '../supabasePagination';
import { accumulatePadatRows } from './padatAggregation';

export const getAccumulatedData = async (targetMonth = null) => {
  let dbPadat = [],
    dbRuangan = [];
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
        let query = supabase.from(table).select(columns).order('tanggal', {
          ascending: true
        }).order('id', {
          ascending: true
        });
        if (startDate && endDate) query = query.gte('tanggal', startDate).lte('tanggal', endDate);
        return query;
      };
      [dbPadat, dbRuangan] = await Promise.all([fetchAllSupabaseRows(() => buildMonthlyQuery('limbah_padat', 'id, tanggal, infeksius, jarum_suntik, botol_obat, sitotoksik, petugas, waktu_input')), fetchAllSupabaseRows(() => buildMonthlyQuery('limbah_ruangan', 'id, tanggal, ruangan, infeksius, jarum_suntik, botol_obat, sitotoksik, petugas, waktu_input'))]);
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
  return accumulatePadatRows(allPadat, allRuangan);
};
