const sum = (rows, key) => rows.reduce((total, row) => total + (Number(row[key]) || 0), 0);
const wasteTotal = rows => ['infeksius', 'jarum_suntik', 'botol_obat', 'sitotoksik']
  .reduce((total, key) => total + sum(rows, key), 0);

export function calculateOpeningBalance(yearlyData, partialWasteRows, partialTransportRows, monthStart) {
  const previousPadat = (yearlyData?.padatRows || []).filter(row => String(row.tanggal).slice(0, 10) < monthStart);
  const previousRuangan = (yearlyData?.ruanganRows || []).filter(row => String(row.tanggal).slice(0, 10) < monthStart);
  const previousTransport = (yearlyData?.angkutRows || []).filter(row => String(row.tanggal).slice(0, 10) < monthStart);
  return wasteTotal([...previousPadat, ...previousRuangan, ...(partialWasteRows || [])])
    - sum([...previousTransport, ...(partialTransportRows || [])], 'jumlah_kg');
}
