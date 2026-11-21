import { supabase } from '../../../lib/supabase';

export async function fetchHospitalBoundary() {
  const { data, error } = await supabase
    .from('hospital_boundary')
    .select('id, points, updated_at')
    .eq('id', 1)
    .maybeSingle();
  if (error) throw error;
  return data || null;
}
