import { supabase } from './supabase';
import { getUnsyncedItemsForTable, getOfflineDeletedIds } from './offlineStorage';

export const MONTH_NAMES = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

/**
 * Fetches all waste records (limbah_padat, limbah_ruangan, pengangkutan_limbah)
 * from Supabase and merges with local offline queue.
 */
export async function fetchAllRekapData() {
  let padatRows = [];
  let ruanganRows = [];
  let angkutRows = [];

  try {
    const [padatRes, ruanganRes, angkutRes] = await Promise.all([
      supabase.from('limbah_padat').select('id, tanggal, infeksius, jarum_suntik, botol_obat, sitotoksik'),
      supabase.from('limbah_ruangan').select('id, tanggal, infeksius, jarum_suntik, botol_obat, sitotoksik'),
      supabase.from('pengangkutan_limbah').select('id, tanggal, jumlah_kg')
    ]);

    if (!padatRes.error) padatRows = padatRes.data || [];
    if (!ruanganRes.error) ruanganRows = ruanganRes.data || [];
    if (!angkutRes.error) angkutRows = angkutRes.data || [];
  } catch (err) {
    console.warn('Network error when fetching rekap data, using offline items if available:', err);
  }

  // Merge with offline storage for limbah_padat
  const padatUnsynced = getUnsyncedItemsForTable('limbah_padat');
  const padatDelIds = new Set(getOfflineDeletedIds('limbah_padat'));
  const padatUnsyncedIds = new Set(padatUnsynced.map(u => String(u.id)));
  const padatCombined = [
    ...padatUnsynced,
    ...padatRows.filter(r => !padatUnsyncedIds.has(String(r.id)) && !padatDelIds.has(String(r.id)))
  ];

  // Merge with offline storage for limbah_ruangan
  const ruanganUnsynced = getUnsyncedItemsForTable('limbah_ruangan');
  const ruanganDelIds = new Set(getOfflineDeletedIds('limbah_ruangan'));
  const ruanganUnsyncedIds = new Set(ruanganUnsynced.map(u => String(u.id)));
  const ruanganCombined = [
    ...ruanganUnsynced,
    ...ruanganRows.filter(r => !ruanganUnsyncedIds.has(String(r.id)) && !ruanganDelIds.has(String(r.id)))
  ];

  // Merge with offline storage for pengangkutan_limbah
  const angkutUnsynced = getUnsyncedItemsForTable('pengangkutan_limbah');
  const angkutDelIds = new Set(getOfflineDeletedIds('pengangkutan_limbah'));
  const angkutUnsyncedIds = new Set(angkutUnsynced.map(u => String(u.id)));
  const angkutCombined = [
    ...angkutUnsynced,
    ...angkutRows.filter(r => !angkutUnsyncedIds.has(String(r.id)) && !angkutDelIds.has(String(r.id)))
  ];

  return {
    padatRows: padatCombined,
    ruanganRows: ruanganCombined,
    angkutRows: angkutCombined
  };
}

/**
 * Safe formatting for Kg values
 */
export function formatKg(num, suffix = ' kg') {
  if (num === null || num === undefined) return 'Tidak ada data';
  const val = Number(num);
  if (isNaN(val)) return 'Tidak ada data';

  const rounded = Math.round(val);

  const formatted = new Intl.NumberFormat('id-ID', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(rounded);

  return `${formatted}${suffix}`;
}

/**
 * Computes chronological monthly balance and filters for the selected year and period.
 */
export function calculateRekapitulasi(allData, selectedYear, selectedMonth) {
  const { padatRows, ruanganRows, angkutRows } = allData || {};

  const monthDataMap = {}; // key: "YYYY-MM"

  const ensureMonthData = (yearMonth) => {
    if (!monthDataMap[yearMonth]) {
      monthDataMap[yearMonth] = {
        timbulan: 0,
        diangkut: 0,
        hasData: false
      };
    }
  };

  const getYearMonth = (dateStr) => {
    if (!dateStr || typeof dateStr !== 'string') return null;
    const parts = dateStr.split('T')[0].split('-');
    if (parts.length >= 2) {
      return `${parts[0]}-${parts[1].padStart(2, '0')}`;
    }
    return null;
  };

  // Process padat
  (padatRows || []).forEach(row => {
    const ym = getYearMonth(row.tanggal);
    if (!ym) return;
    ensureMonthData(ym);
    const sum = (parseFloat(row.infeksius) || 0) +
                (parseFloat(row.jarum_suntik) || 0) +
                (parseFloat(row.botol_obat) || 0) +
                (parseFloat(row.sitotoksik) || 0);
    monthDataMap[ym].timbulan += sum;
    monthDataMap[ym].hasData = true;
  });

  // Process ruangan
  (ruanganRows || []).forEach(row => {
    const ym = getYearMonth(row.tanggal);
    if (!ym) return;
    ensureMonthData(ym);
    const sum = (parseFloat(row.infeksius) || 0) +
                (parseFloat(row.jarum_suntik) || 0) +
                (parseFloat(row.botol_obat) || 0) +
                (parseFloat(row.sitotoksik) || 0);
    monthDataMap[ym].timbulan += sum;
    monthDataMap[ym].hasData = true;
  });

  // Process angkut
  (angkutRows || []).forEach(row => {
    const ym = getYearMonth(row.tanggal);
    if (!ym) return;
    ensureMonthData(ym);
    const sum = parseFloat(row.jumlah_kg) || 0;
    monthDataMap[ym].diangkut += sum;
    monthDataMap[ym].hasData = true;
  });

  const allYms = Object.keys(monthDataMap).sort();
  const availableYearsSet = new Set(allYms.map(ym => ym.split('-')[0]));
  const currentYearStr = String(new Date().getFullYear());
  availableYearsSet.add(currentYearStr);
  if (selectedYear) availableYearsSet.add(String(selectedYear));
  const availableYears = Array.from(availableYearsSet).sort((a, b) => b.localeCompare(a)); // Descending for year dropdown

  const earliestYm = allYms.length > 0 ? allYms[0] : `${selectedYear || currentYearStr}-01`;
  const startYear = parseInt(earliestYm.split('-')[0], 10);
  const targetYear = parseInt(selectedYear || currentYearStr, 10);

  let runningSisa = 0;
  const processedMonths = {}; // "YYYY-MM" => { ... }

  for (let y = startYear; y <= targetYear; y++) {
    for (let m = 1; m <= 12; m++) {
      const ym = `${y}-${String(m).padStart(2, '0')}`;
      const entry = monthDataMap[ym];
      const sisaAwal = runningSisa;

      let timbulan = null;
      let diangkut = null;
      let sisaAkhir = sisaAwal;
      let hasData = false;

      if (entry && entry.hasData) {
        hasData = true;
        timbulan = entry.timbulan;
        diangkut = entry.diangkut;
        sisaAkhir = sisaAwal + timbulan - diangkut;
      }

      runningSisa = sisaAkhir;
      processedMonths[ym] = {
        year: y,
        monthNum: m,
        yearMonth: ym,
        monthName: MONTH_NAMES[m - 1],
        sisaAwal,
        timbulan,
        diangkut,
        sisaAkhir,
        hasData
      };
    }
  }

  let tableRows = [];
  const yr = parseInt(selectedYear || currentYearStr, 10);

  if (selectedMonth === 'semua' || !selectedMonth) {
    for (let m = 1; m <= 12; m++) {
      const ym = `${yr}-${String(m).padStart(2, '0')}`;
      if (processedMonths[ym]) {
        tableRows.push(processedMonths[ym]);
      }
    }
  } else {
    const m = parseInt(selectedMonth, 10);
    const ym = `${yr}-${String(m).padStart(2, '0')}`;
    if (processedMonths[ym]) {
      tableRows.push(processedMonths[ym]);
    }
  }

  let totalTimbulan = 0;
  let totalDiangkut = 0;
  let activeMonthsCount = 0;
  let hasAnomaly = false;

  tableRows.forEach(row => {
    if (row.hasData) {
      totalTimbulan += (row.timbulan || 0);
      totalDiangkut += (row.diangkut || 0);
      activeMonthsCount += 1;
    }
    if (row.sisaAkhir < 0) {
      hasAnomaly = true;
    }
  });

  const lastRow = tableRows[tableRows.length - 1];
  const sisaAkumulasi = lastRow ? lastRow.sisaAkhir : 0;
  if (sisaAkumulasi < 0) {
    hasAnomaly = true;
  }

  const rataRataTimbulan = activeMonthsCount > 0 ? totalTimbulan / activeMonthsCount : 0;

  return {
    availableYears,
    tableRows,
    summary: {
      totalTimbulan,
      totalDiangkut,
      sisaAkumulasi,
      rataRataTimbulan,
      activeMonthsCount
    },
    hasAnomaly
  };
}
