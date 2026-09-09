import { supabase } from './supabase';
import { fetchAllSupabaseRows } from './supabasePagination';

const sum = (rows, key) => rows.reduce((total, row) => total + (Number(row[key]) || 0), 0);

export async function fetchMedicalWasteRecap(start, end) {
  const wasteColumns = 'tanggal, infeksius, jarum_suntik, botol_obat, sitotoksik';
  const range = query => query.gte('tanggal', start).lte('tanggal', end).order('tanggal', { ascending: true });
  const [padatRows, ruanganRows, transportRows] = await Promise.all([
    fetchAllSupabaseRows(() => range(supabase.from('limbah_padat').select(wasteColumns))),
    fetchAllSupabaseRows(() => range(supabase.from('limbah_ruangan').select(`${wasteColumns}, ruangan`))),
    fetchAllSupabaseRows(() => range(supabase.from('pengangkutan_limbah').select('tanggal, jumlah_kg'))),
  ]);
  const wasteRows = [...padatRows, ...ruanganRows];
  const infectiousKg = sum(wasteRows, 'infeksius');
  const sharpsKg = sum(wasteRows, 'jarum_suntik');
  const bottleKg = sum(wasteRows, 'botol_obat');
  const cytotoxicKg = sum(wasteRows, 'sitotoksik');
  const totalGeneratedKg = infectiousKg + sharpsKg + bottleKg + cytotoxicKg;
  const totalTransportedKg = sum(transportRows, 'jumlah_kg');
  const daily = new Map();
  const ensureDay = tanggal => {
    if (!daily.has(tanggal)) daily.set(tanggal, { date: tanggal, generated: 0, transported: 0 });
    return daily.get(tanggal);
  };
  wasteRows.forEach(row => {
    ensureDay(row.tanggal).generated += ['infeksius', 'jarum_suntik', 'botol_obat', 'sitotoksik']
      .reduce((total, key) => total + (Number(row[key]) || 0), 0);
  });
  transportRows.forEach(row => { ensureDay(row.tanggal).transported += Number(row.jumlah_kg) || 0; });
  const rooms = new Map();
  ruanganRows.forEach(row => {
    const name = row.ruangan || 'Tanpa nama';
    const total = ['infeksius', 'jarum_suntik', 'botol_obat', 'sitotoksik'].reduce((value, key) => value + (Number(row[key]) || 0), 0);
    rooms.set(name, (rooms.get(name) || 0) + total);
  });
  return {
    facts: { totalGeneratedKg, totalTransportedKg, remainingKg: totalGeneratedKg - totalTransportedKg, infectiousKg, sharpsKg, bottleKg, cytotoxicKg },
    charts: {
      timeline: Array.from(daily.values()).sort((a, b) => a.date.localeCompare(b.date)).map(row => ({ ...row, label: row.date.slice(8, 10) })),
      composition: [
        { name: 'Infeksius', value: infectiousKg }, { name: 'Jarum', value: sharpsKg },
        { name: 'Botol', value: bottleKg }, { name: 'Sitotoksik', value: cytotoxicKg },
      ],
      rooms: Array.from(rooms, ([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 10),
    },
  };
}
