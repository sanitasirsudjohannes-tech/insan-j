import { supabase } from './supabase';
import { fetchAllSupabaseRows } from './supabasePagination';

const sum = (rows, key) => rows.reduce((total, row) => total + (Number(row[key]) || 0), 0);

export async function fetchMedicalWasteRecap(start, end) {
  const wasteColumns = 'infeksius, jarum_suntik, botol_obat, sitotoksik';
  const range = query => query.gte('tanggal', start).lte('tanggal', end).order('tanggal', { ascending: true });
  const [padatRows, ruanganRows, transportRows] = await Promise.all([
    fetchAllSupabaseRows(() => range(supabase.from('limbah_padat').select(wasteColumns))),
    fetchAllSupabaseRows(() => range(supabase.from('limbah_ruangan').select(wasteColumns))),
    fetchAllSupabaseRows(() => range(supabase.from('pengangkutan_limbah').select('jumlah_kg'))),
  ]);
  const wasteRows = [...padatRows, ...ruanganRows];
  const infectiousKg = sum(wasteRows, 'infeksius');
  const sharpsKg = sum(wasteRows, 'jarum_suntik');
  const bottleKg = sum(wasteRows, 'botol_obat');
  const cytotoxicKg = sum(wasteRows, 'sitotoksik');
  const totalGeneratedKg = infectiousKg + sharpsKg + bottleKg + cytotoxicKg;
  const totalTransportedKg = sum(transportRows, 'jumlah_kg');
  return {
    totalGeneratedKg,
    totalTransportedKg,
    remainingKg: totalGeneratedKg - totalTransportedKg,
    infectiousKg,
    sharpsKg,
    bottleKg,
    cytotoxicKg,
  };
}
