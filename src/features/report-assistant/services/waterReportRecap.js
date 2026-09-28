import { supabase } from '../../../lib/supabase';
import { summarizeWaterRecords } from '../domain/waterReportSummary.js';


const WATER_DATE_CACHE_MS = 5 * 60 * 1000;
let waterDateIndexCache = null;
let waterDateIndexPromise = null;

async function fetchWaterDateIndex(force = false) {
  const now = Date.now();
  if (!force && waterDateIndexCache && now - waterDateIndexCache.loadedAt < WATER_DATE_CACHE_MS) {
    return waterDateIndexCache.rows;
  }
  if (waterDateIndexPromise) return waterDateIndexPromise;

  waterDateIndexPromise = (async () => {
    const { data, error } = await supabase.rpc('get_water_examination_archive_summary');
    if (error) throw error;
    const rows = data || [];
    waterDateIndexCache = { rows, loadedAt: Date.now() };
    return rows;
  })();

  try {
    return await waterDateIndexPromise;
  } finally {
    waterDateIndexPromise = null;
  }
}

export async function fetchWaterReportRecap(start, end, reportType) {
  if (!['clean_water', 'wastewater'].includes(reportType)) throw new Error('Jenis laporan air tidak valid.');
  const waterType = reportType === 'clean_water' ? 'clean' : 'wastewater';
  const records = [];
  const pageSize = 500;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from('water_examinations')
      .select('id, water_type, sample_point, sampled_at, resulted_at, laboratory, report_number, parameters, notes, water_clean_locations(name)')
      .eq('water_type', waterType)
      .gte('sampled_at', start)
      .lte('sampled_at', end)
      .order('sampled_at', { ascending: true })
      .order('id', { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) throw error;
    records.push(...(data || []));
    if (!data || data.length < pageSize) break;
  }
  return summarizeWaterRecords(records, reportType);
}

export async function fetchWaterExaminationDates(reportType, { force = false } = {}) {
  if (!['clean_water', 'wastewater'].includes(reportType)) return [];
  const waterType = reportType === 'clean_water' ? 'clean' : 'wastewater';


  try {
    const summary = await fetchWaterDateIndex(force);
    return summary
      .filter(record => record.water_type === waterType && record.sampled_at)
      .map(record => record.sampled_at)
      .sort((a, b) => b.localeCompare(a));
  } catch (error) {
    // Kompatibilitas untuk database yang belum menjalankan migrasi agregasi.
    if (error?.code !== 'PGRST202' && error?.code !== '42883') throw error;
  }
  const dates = new Set();
  const pageSize = 500;

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from('water_examinations')
      .select('sampled_at')
      .eq('water_type', waterType)
      .not('sampled_at', 'is', null)
      .order('sampled_at', { ascending: false })
      .range(from, from + pageSize - 1);
    if (error) throw error;
    (data || []).forEach(record => {
      if (record.sampled_at) dates.add(record.sampled_at);
    });
    if (!data || data.length < pageSize) break;
  }

  return [...dates].sort((a, b) => b.localeCompare(a));
}
