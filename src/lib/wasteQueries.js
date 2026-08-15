import { supabase } from './supabase';

/**
 * Fetches raw waste rows from both `limbah_padat` and `limbah_ruangan` tables in parallel.
 * Returns an object containing { padatRows, ruanganRows }.
 */
export async function fetchWasteRows() {
  const [{ data: padatRows, error: errPadat }, { data: ruanganRows, error: errRuangan }] = await Promise.all([
    supabase
      .from('limbah_padat')
      .select('tanggal, infeksius, jarum_suntik, botol_obat, sitotoksik')
      .order('tanggal', { ascending: true }),
    supabase
      .from('limbah_ruangan')
      .select('tanggal, infeksius, jarum_suntik, botol_obat, sitotoksik')
      .order('tanggal', { ascending: true })
  ]);

  if (errPadat) throw errPadat;
  if (errRuangan) throw errRuangan;

  return {
    padatRows: padatRows || [],
    ruanganRows: ruanganRows || []
  };
}

/**
 * Fetches and aggregates total daily waste from both `limbah_padat` and `limbah_ruangan`.
 * Returns a map of date => totalKg.
 */
export async function fetchCombinedLimbahDailyTotals() {
  const { padatRows, ruanganRows } = await fetchWasteRows();

  const limbahMap = {};
  const accumulate = (rows) => {
    rows.forEach(row => {
      const key = row.tanggal;
      if (!key) return;
      const total =
        (parseFloat(row.infeksius) || 0) +
        (parseFloat(row.jarum_suntik) || 0) +
        (parseFloat(row.botol_obat) || 0) +
        (parseFloat(row.sitotoksik) || 0);
      limbahMap[key] = (limbahMap[key] || 0) + total;
    });
  };

  accumulate(padatRows);
  accumulate(ruanganRows);

  return limbahMap;
}
