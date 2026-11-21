import { supabase } from '../../../lib/supabase';
import { fetchAllSupabaseRows } from '../../../lib/supabasePagination';
import { insertImportRowsAtomically } from '../../../lib/excelImport';

export const getMonthRange = (monthValue) => {
  if (!monthValue) return null;
  const [year, month] = monthValue.split('-');
  const lastDay = new Date(Number(year), Number(month), 0).getDate();
  return {
    start: `${year}-${month}-01`,
    end: `${year}-${month}-${String(lastDay).padStart(2, '0')}`,
  };
};

const applyPeriodAndExclusions = (query, monthValue, excludedIds) => {
  const range = getMonthRange(monthValue);
  if (range) query = query.gte('tanggal', range.start).lte('tanggal', range.end);
  if (excludedIds) query = query.not('id', 'in', excludedIds);
  return query;
};

export async function countPengangkutan(monthValue, excludedIds) {
  const query = applyPeriodAndExclusions(
    supabase.from('pengangkutan_limbah').select('id', { count: 'exact', head: true }),
    monthValue,
    excludedIds
  );
  const { count, error } = await query;
  if (error) throw error;
  return count || 0;
}

export async function fetchPengangkutanPage({ from, to, monthValue, excludedIds }) {
  const query = applyPeriodAndExclusions(
    supabase
      .from('pengangkutan_limbah')
      .select('id, tanggal, jumlah_kg, keterangan, petugas, waktu_input')
      .order('tanggal', { ascending: false })
      .order('waktu_input', { ascending: false })
      .range(from, to),
    monthValue,
    excludedIds
  );
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function createPengangkutan(payload) {
  const { data, error } = await supabase
    .from('pengangkutan_limbah')
    .insert([payload])
    .select()
    .single();
  if (error) throw error;
  return data;
}

export function fetchPengangkutanForExport(monthValue) {
  const range = getMonthRange(monthValue);
  return fetchAllSupabaseRows(() => supabase
    .from('pengangkutan_limbah')
    .select('tanggal, jumlah_kg, keterangan, petugas')
    .gte('tanggal', range.start)
    .lte('tanggal', range.end)
    .order('tanggal', { ascending: true })
    .order('id', { ascending: true }));
}

export function importPengangkutanRows(payloads) {
  return insertImportRowsAtomically(supabase, 'pengangkutan_limbah', payloads);
}
