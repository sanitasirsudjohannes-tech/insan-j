import { supabase } from '../../../lib/supabase';
import { toBoundaryPayload } from '../domain/hospitalBoundary';

export async function saveHospitalBoundary(points) {
  const { error } = await supabase.rpc('save_hospital_boundary', {
    new_points: toBoundaryPayload(points),
  });
  if (error) throw error;
}

export async function clearHospitalBoundary() {
  const { error } = await supabase.rpc('clear_hospital_boundary');
  if (error) throw error;
}
