import { supabase } from '../../../lib/supabase';
import { FACILITY_CATEGORY } from '../constants/facilityCategories';

const FUNCTION_BY_CATEGORY = {
  [FACILITY_CATEGORY.ROOM]: 'set_ruangan_map_coordinates',
  [FACILITY_CATEGORY.CLEAN_WATER]: 'set_clean_water_location_map_coordinates',
};

export async function saveFacilityCoordinates(facility, coordinates = null) {
  const functionName = FUNCTION_BY_CATEGORY[facility?.category];
  if (!functionName) throw new Error('Kategori fasilitas tidak dikenali.');

  const { error } = await supabase.rpc(functionName, {
    target_id: facility.id,
    new_latitude: coordinates?.latitude ?? null,
    new_longitude: coordinates?.longitude ?? null,
  });
  if (error) throw error;
}

export async function deleteFacilityCoordinates(facility) {
  return saveFacilityCoordinates(facility, null);
}
