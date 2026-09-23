import { supabase } from '../../../lib/supabase';
import { summarizeWaterRecords } from '../domain/waterReportSummary.js';

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
