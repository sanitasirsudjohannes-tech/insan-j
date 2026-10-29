import { supabase } from '../../../lib/supabase.js';

const selectFields = 'id, water_type, sample_point, sampled_at, resulted_at, laboratory, report_number, parameters, water_clean_locations(name)';

async function fetchDateIndex() {
  const { data, error } = await supabase.rpc('get_water_examination_archive_summary');
  if (error) throw error;
  return data || [];
}

async function fetchRecords(waterType, sampledAt) {
  const { data, error } = await supabase
    .from('water_examinations')
    .select(selectFields)
    .eq('water_type', waterType)
    .eq('sampled_at', sampledAt)
    .order('sample_point', { ascending: true });
  if (error) throw error;
  return data || [];
}

export const waterQuestionRepository = { fetchDateIndex, fetchRecords };
