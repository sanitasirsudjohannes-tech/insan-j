export const MONTH_NAMES = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

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
 * Computes chronological monthly balance and filters from January through the selected end month.
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
  const actualRecordYears = [...(padatRows || []), ...(ruanganRows || []), ...(angkutRows || [])]
    .filter(row => !row.is_opening_balance)
    .map(row => getYearMonth(row.tanggal))
    .filter(Boolean)
    .map(yearMonth => yearMonth.split('-')[0]);
  const availableYearsSet = new Set([
    ...actualRecordYears,
    ...(Array.isArray(allData?.availableYears) ? allData.availableYears.map(String) : []),
  ]);
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
    const endMonth = Math.min(Math.max(parseInt(selectedMonth, 10) || 1, 1), 12);
    for (let m = 1; m <= endMonth; m++) {
      const ym = `${yr}-${String(m).padStart(2, '0')}`;
      if (processedMonths[ym]) {
        tableRows.push(processedMonths[ym]);
      }
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
