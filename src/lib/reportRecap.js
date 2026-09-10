import { supabase } from './supabase';
import { fetchAllSupabaseRows } from './supabasePagination';
import { fetchDatabaseAggregation } from './databaseAggregations';
import { calculateOpeningBalance } from './reportRecapCalculations';

const sum = (rows, key) => rows.reduce((total, row) => total + (Number(row[key]) || 0), 0);
export async function fetchMedicalWasteRecap(start, end) {
  const wasteColumns = 'tanggal, infeksius, jarum_suntik, botol_obat, sitotoksik';
  const range = query => query.gte('tanggal', start).lte('tanggal', end).order('tanggal', { ascending: true });
  const monthStart = `${start.slice(0, 7)}-01`;
  const dayBeforeStart = new Date(`${start}T00:00:00`);
  dayBeforeStart.setDate(dayBeforeStart.getDate() - 1);
  const priorEnd = `${dayBeforeStart.getFullYear()}-${String(dayBeforeStart.getMonth() + 1).padStart(2, '0')}-${String(dayBeforeStart.getDate()).padStart(2, '0')}`;
  const hasPartialMonth = start > monthStart;
  const priorRange = query => query.gte('tanggal', monthStart).lte('tanggal', priorEnd).order('tanggal', { ascending: true });
  const [padatRows, ruanganRows, transportRows, yearlyData, partialPadat, partialRuangan, partialTransport] = await Promise.all([
    fetchAllSupabaseRows(() => range(supabase.from('limbah_padat').select(wasteColumns))),
    fetchAllSupabaseRows(() => range(supabase.from('limbah_ruangan').select(`${wasteColumns}, ruangan`))),
    fetchAllSupabaseRows(() => range(supabase.from('pengangkutan_limbah').select('tanggal, jumlah_kg'))),
    fetchDatabaseAggregation('rekap_limbah_yearly_summary', { requested_year: Number(start.slice(0, 4)), excluded_padat_ids: [], excluded_ruangan_ids: [], excluded_pengangkutan_ids: [] }),
    hasPartialMonth ? fetchAllSupabaseRows(() => priorRange(supabase.from('limbah_padat').select(wasteColumns))) : [],
    hasPartialMonth ? fetchAllSupabaseRows(() => priorRange(supabase.from('limbah_ruangan').select(wasteColumns))) : [],
    hasPartialMonth ? fetchAllSupabaseRows(() => priorRange(supabase.from('pengangkutan_limbah').select('tanggal, jumlah_kg'))) : [],
  ]);
  let openingSource = yearlyData;
  if (!openingSource) {
    const beforeMonth = query => query.lt('tanggal', monthStart).order('tanggal', { ascending: true });
    const [previousPadat, previousRuangan, previousTransport] = await Promise.all([
      fetchAllSupabaseRows(() => beforeMonth(supabase.from('limbah_padat').select(wasteColumns))),
      fetchAllSupabaseRows(() => beforeMonth(supabase.from('limbah_ruangan').select(wasteColumns))),
      fetchAllSupabaseRows(() => beforeMonth(supabase.from('pengangkutan_limbah').select('tanggal, jumlah_kg'))),
    ]);
    openingSource = { padatRows: previousPadat, ruanganRows: previousRuangan, angkutRows: previousTransport };
  }
  const openingBalanceKg = calculateOpeningBalance(openingSource, [...partialPadat, ...partialRuangan], partialTransport, monthStart);
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
  let runningBalance = openingBalanceKg;
  const timeline = Array.from(daily.values()).sort((a, b) => a.date.localeCompare(b.date)).map(row => {
    runningBalance += row.generated - row.transported;
    return { ...row, balance: runningBalance, label: `${row.date.slice(8, 10)}/${row.date.slice(5, 7)}` };
  });
  return {
    facts: { openingBalanceKg, totalGeneratedKg, totalTransportedKg, remainingKg: openingBalanceKg + totalGeneratedKg - totalTransportedKg, infectiousKg, sharpsKg, bottleKg, cytotoxicKg },
    charts: {
      balanceFlow: [
        { name: 'Saldo Awal', value: openingBalanceKg },
        { name: 'Timbulan', value: totalGeneratedKg },
        { name: 'Diangkut', value: totalTransportedKg },
        { name: 'Saldo Akhir', value: openingBalanceKg + totalGeneratedKg - totalTransportedKg },
      ],
      timeline,
      composition: [
        { name: 'Infeksius', value: infectiousKg }, { name: 'Jarum', value: sharpsKg },
        { name: 'Botol', value: bottleKg }, { name: 'Sitotoksik', value: cytotoxicKg },
      ],
      rooms: Array.from(rooms, ([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 10),
    },
  };
}
