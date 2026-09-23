import { supabase } from '../../lib/supabase';
import { calculateParameterStatus, monthRange, normalizeParameters } from './waterHelpers';

export async function getCleanWaterLocations({ includeInactive = false } = {}) {
  let query = supabase
    .from('water_clean_locations')
    .select('id, name, description, is_active')
    .order('name');
  if (!includeInactive) query = query.eq('is_active', true);
  const { data, error } = await query;
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

export async function updateCleanWaterLocation(id, changes) {
  const payload = { updated_at: new Date().toISOString() };
  if (changes.name !== undefined) payload.name = changes.name.trim();
  if (changes.is_active !== undefined) payload.is_active = changes.is_active;
  const { data, error } = await supabase
    .from('water_clean_locations')
    .update(payload)
    .eq('id', id)
    .select('id, name, description, is_active')
    .single();
  if (error) throw error;
  return data;
}

export async function deleteCleanWaterLocation(id) {
  const { count, error: countError } = await supabase
    .from('water_examinations')
    .select('id', { count: 'exact', head: true })
    .eq('clean_water_location_id', id);
  if (countError) throw countError;
  if (count) throw new Error('Lokasi sudah dipakai dalam hasil pemeriksaan. Nonaktifkan agar riwayat tetap utuh.');
  const { error } = await supabase.from('water_clean_locations').delete().eq('id', id);
  if (error?.code === '23503') throw new Error('Lokasi sudah dipakai dalam hasil pemeriksaan. Nonaktifkan agar riwayat tetap utuh.');
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
  return (data || []).map(record => ({
    ...record,
    parameters: (record.parameters || []).map(item => ({
      ...item,
      parameter: record.water_type === 'clean' && /^coliform$/i.test(String(item.parameter).trim()) ? 'Total coliform' : item.parameter,
      status: calculateParameterStatus(item.result, item.standard),
    })),
  }));
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
  };
  const query = form.id
    ? supabase.from('water_examinations').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', form.id)
    : supabase.from('water_examinations').insert({ ...payload, created_by: userId });
  const { data, error } = await query.select().single();
  if (error) throw error;
  return data;
}

export async function deleteWaterExamination(id) {
  const { error } = await supabase.from('water_examinations').delete().eq('id', id);
  if (error) throw error;
}
