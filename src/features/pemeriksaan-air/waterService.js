import { supabase } from '../../lib/supabase';
import { monthRange, normalizeParameters } from './waterHelpers';

export async function getCleanWaterLocations() {
  const { data, error } = await supabase
    .from('water_clean_locations')
    .select('id, name, description, is_active')
    .eq('is_active', true)
    .order('name');
  if (error) throw error;
  return data || [];
}

export async function addCleanWaterLocation(name, description = '') {
  const { data, error } = await supabase
    .from('water_clean_locations')
    .insert({ name: name.trim(), description: description.trim() || null })
    .select('id, name, description, is_active')
    .single();
  if (error) throw error;
  return data;
}

export async function deleteCleanWaterLocation(id) {
  const { error } = await supabase
    .from('water_clean_locations')
    .update({ is_active: false })
    .eq('id', id);
  if (error) throw error;
}

export async function getWaterExaminations({ month, waterType }) {
  const { start, end } = monthRange(month);
  let query = supabase
    .from('water_examinations')
    .select('*, water_clean_locations(name)')
    .gte('sampled_at', start)
    .lt('sampled_at', end)
    .order('sampled_at', { ascending: false })
    .order('created_at', { ascending: false });
  if (waterType !== 'all') query = query.eq('water_type', waterType);
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function saveWaterExamination(form, userId) {
  const payload = {
    water_type: form.water_type,
    clean_water_location_id: form.water_type === 'clean' ? form.clean_water_location_id : null,
    sample_point: form.water_type === 'wastewater' ? form.sample_point : null,
    sampled_at: form.sampled_at,
    resulted_at: form.resulted_at || null,
    laboratory: form.laboratory.trim() || null,
    report_number: form.report_number.trim() || null,
    notes: form.notes.trim() || null,
    parameters: normalizeParameters(form.parameters),
    created_by: userId,
  };
  const query = form.id
    ? supabase.from('water_examinations').update(payload).eq('id', form.id)
    : supabase.from('water_examinations').insert(payload);
  const { data, error } = await query.select().single();
  if (error) throw error;
  return data;
}

export async function deleteWaterExamination(id) {
  const { error } = await supabase.from('water_examinations').delete().eq('id', id);
  if (error) throw error;
}
