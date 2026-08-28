import { supabase } from './supabase';
import { fetchAllSupabaseRows } from './supabasePagination';
import { fetchSharedCachedResource } from './databaseAggregations';

/**
 * Fetches raw waste rows from both `limbah_padat` and `limbah_ruangan` tables in parallel.
 * Returns an object containing { padatRows, ruanganRows }.
 */
export async function fetchWasteRows({ startDate = null, endDate = null } = {}) {
  const buildQuery = table => {
    let query = supabase
      .from(table)
      .select('tanggal, infeksius, jarum_suntik, botol_obat, sitotoksik')
      .order('tanggal', { ascending: true })
      .order('id', { ascending: true });

    if (startDate) query = query.gte('tanggal', startDate);
    if (endDate) query = query.lt('tanggal', endDate);
    return query;
  };

  return fetchSharedCachedResource('legacy:waste-rows', async () => {
    const [padatRows, ruanganRows] = await Promise.all([
      fetchAllSupabaseRows(() => buildQuery('limbah_padat')),
      fetchAllSupabaseRows(() => buildQuery('limbah_ruangan')),
    ]);

    return { padatRows, ruanganRows };
  }, {
    parameters: { startDate, endDate },
    tables: ['limbah_padat', 'limbah_ruangan'],
  });
}

/**
 * Fetches and aggregates total daily waste from both `limbah_padat` and `limbah_ruangan`.
 * Returns a map of date => totalKg.
 */
export async function fetchCombinedLimbahDailyTotals() {
  const { padatRows, ruanganRows } = await fetchWasteRows();

  const limbahMap = {};
  const accumulate = (rows) => {
    rows.forEach(row => {
      const key = row.tanggal;
      if (!key) return;
      const total =
        (parseFloat(row.infeksius) || 0) +
        (parseFloat(row.jarum_suntik) || 0) +
        (parseFloat(row.botol_obat) || 0) +
        (parseFloat(row.sitotoksik) || 0);
      limbahMap[key] = (limbahMap[key] || 0) + total;
    });
  };

  accumulate(padatRows);
  accumulate(ruanganRows);

  return limbahMap;
}
