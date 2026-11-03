import { supabase } from '../../../lib/supabase';

export async function fetchRoomMapLocations() {
  const { data, error } = await supabase
    .from('ruangan')
    .select('id, nama_ruangan, latitude, longitude')
    .order('nama_ruangan', { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function fetchCleanWaterMapLocations() {
  const { data, error } = await supabase
    .from('water_clean_locations')
    .select('id, name, description, is_active, latitude, longitude')
    .order('name', { ascending: true });
  if (error) throw error;
  return data || [];
}
