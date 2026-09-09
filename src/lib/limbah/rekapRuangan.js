import { supabase } from '../supabase';
import {
  getOfflineDeletedIds,
  getUnsyncedItemsForTable
} from '../offlineStorage';
import { fetchAllSupabaseRows } from '../supabasePagination';

const isInMonth = (tanggal, yearMonth) => String(tanggal || '').slice(0, 7) === yearMonth;

export async function fetchRuanganRowsByMonth(year, month) {
  const yearMonth = `${year}-${String(month).padStart(2, '0')}`;
  const startDate = `${yearMonth}-01`;
  const lastDay = new Date(Number(year), Number(month), 0).getDate();
  const endDate = `${yearMonth}-${String(lastDay).padStart(2, '0')}`;
  const unsyncedRows = getUnsyncedItemsForTable('limbah_ruangan');
  const deletedIds = new Set(getOfflineDeletedIds('limbah_ruangan').map(String));
  const replacedIds = new Set(unsyncedRows
    .filter(row => row.offlineAction === 'update' && !String(row.id).startsWith('off_'))
    .map(row => String(row.id)));

  let serverRows = [];
  try {
    serverRows = await fetchAllSupabaseRows(() => supabase
      .from('limbah_ruangan')
      .select('id, tanggal, ruangan, infeksius, jarum_suntik, botol_obat, sitotoksik')
      .gte('tanggal', startDate)
      .lte('tanggal', endDate)
      .order('ruangan', { ascending: true })
      .order('tanggal', { ascending: true }));
  } catch (error) {
    if (navigator.onLine) throw error;
  }

  return [
    ...unsyncedRows.filter(row => row.offlineAction !== 'delete' && isInMonth(row.tanggal, yearMonth)),
    ...serverRows.filter(row => !replacedIds.has(String(row.id)) && !deletedIds.has(String(row.id)))
  ];
}
