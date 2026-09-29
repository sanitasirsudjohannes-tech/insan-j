import { supabase } from '../../../lib/supabase';
import { getUnsyncedItemsForTable, getOfflineDeletedIds } from '../../../lib/offlineStorage';
import { fetchAllSupabaseRows } from '../../../lib/supabasePagination';
import { fetchDatabaseAggregation } from '../../../lib/databaseAggregations';

/**
 * Fetches all waste records (limbah_padat, limbah_ruangan, pengangkutan_limbah)
 * from Supabase and merges with local offline queue.
 */
export async function fetchAllRekapData(selectedYear = new Date().getFullYear()) {
  const padatUnsynced = getUnsyncedItemsForTable('limbah_padat');
  const ruanganUnsynced = getUnsyncedItemsForTable('limbah_ruangan');
  const angkutUnsynced = getUnsyncedItemsForTable('pengangkutan_limbah');
  const padatDelIds = new Set(getOfflineDeletedIds('limbah_padat'));
  const ruanganDelIds = new Set(getOfflineDeletedIds('limbah_ruangan'));
  const angkutDelIds = new Set(getOfflineDeletedIds('pengangkutan_limbah'));

  const getExcludedServerIds = (unsyncedRows, deletedIds) => [...new Set([
    ...unsyncedRows
      .filter(row => row.offlineAction === 'update' && !String(row.id).startsWith('off_'))
      .map(row => String(row.id)),
    ...Array.from(deletedIds, String),
  ])];

  try {
    const excludedParameters = {
      excluded_padat_ids: getExcludedServerIds(padatUnsynced, padatDelIds),
      excluded_ruangan_ids: getExcludedServerIds(ruanganUnsynced, ruanganDelIds),
      excluded_pengangkutan_ids: getExcludedServerIds(angkutUnsynced, angkutDelIds),
    };
    const yearlyAggregation = await fetchDatabaseAggregation('rekap_limbah_yearly_summary', {
      requested_year: Number(selectedYear),
      ...excludedParameters,
    });
    const aggregated = yearlyAggregation || await fetchDatabaseAggregation(
      'rekap_limbah_monthly_summary',
      excludedParameters
    );

    if (aggregated) {
      return {
        availableYears: aggregated.availableYears || [],
        padatRows: [...padatUnsynced, ...(aggregated.padatRows || [])],
        ruanganRows: [...ruanganUnsynced, ...(aggregated.ruanganRows || [])],
        angkutRows: [...angkutUnsynced, ...(aggregated.angkutRows || [])],
      };
    }
  } catch (error) {
    // Pertahankan tampilan draft offline ketika koneksi gagal. Saat online,
    // fallback juga menjaga aplikasi tetap berfungsi bila fungsi SQL berubah.
    console.warn('Agregasi rekap tidak dapat dimuat, mencoba query cadangan:', error);
  }

  let padatRows = [];
  let ruanganRows = [];
  let angkutRows = [];

  try {
    const [padatResult, ruanganResult, angkutResult] = await Promise.allSettled([
      fetchAllSupabaseRows(() => supabase
        .from('limbah_padat')
        .select('id, tanggal, infeksius, jarum_suntik, botol_obat, sitotoksik')
        .order('tanggal', { ascending: true })
        .order('id', { ascending: true })),
      fetchAllSupabaseRows(() => supabase
        .from('limbah_ruangan')
        .select('id, tanggal, infeksius, jarum_suntik, botol_obat, sitotoksik')
        .order('tanggal', { ascending: true })
        .order('id', { ascending: true })),
      fetchAllSupabaseRows(() => supabase
        .from('pengangkutan_limbah')
        .select('id, tanggal, jumlah_kg')
        .order('tanggal', { ascending: true })
        .order('id', { ascending: true }))
    ]);

    const failed = [padatResult, ruanganResult, angkutResult].find(result => result.status === 'rejected');
    if (failed && navigator.onLine) throw failed.reason;
    if (padatResult.status === 'fulfilled') padatRows = padatResult.value;
    if (ruanganResult.status === 'fulfilled') ruanganRows = ruanganResult.value;
    if (angkutResult.status === 'fulfilled') angkutRows = angkutResult.value;

    [padatResult, ruanganResult, angkutResult]
      .filter(result => result.status === 'rejected')
      .forEach(result => console.warn('Sebagian data rekap tidak dapat dimuat:', result.reason));
  } catch (err) {
    if (navigator.onLine) throw err;
    console.warn('Network error when fetching rekap data, using offline items if available:', err);
  }

  // Merge with offline storage for limbah_padat
  const padatUnsyncedIds = new Set(padatUnsynced.map(u => String(u.id)));
  const padatCombined = [
    ...padatUnsynced,
    ...padatRows.filter(r => !padatUnsyncedIds.has(String(r.id)) && !padatDelIds.has(String(r.id)))
  ];

  // Merge with offline storage for limbah_ruangan
  const ruanganUnsyncedIds = new Set(ruanganUnsynced.map(u => String(u.id)));
  const ruanganCombined = [
    ...ruanganUnsynced,
    ...ruanganRows.filter(r => !ruanganUnsyncedIds.has(String(r.id)) && !ruanganDelIds.has(String(r.id)))
  ];

  // Merge with offline storage for pengangkutan_limbah
  const angkutUnsyncedIds = new Set(angkutUnsynced.map(u => String(u.id)));
  const angkutCombined = [
    ...angkutUnsynced,
    ...angkutRows.filter(r => !angkutUnsyncedIds.has(String(r.id)) && !angkutDelIds.has(String(r.id)))
  ];

  return {
    padatRows: padatCombined,
    ruanganRows: ruanganCombined,
    angkutRows: angkutCombined
  };
}
