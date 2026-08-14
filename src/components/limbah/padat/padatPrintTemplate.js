/**
 * padatPrintTemplate.js
 * Menghasilkan string HTML lengkap untuk laporan cetak Limbah Padat (akumulasi harian).
 *
 * @param {Array}  printData  - Array hasil getAccumulatedData(), sudah ter-sort ascending.
 * @param {string} yearMonth  - Format "YYYY-MM".
 * @returns {string} HTML string siap cetak.
 */
export function buildPadatPrintHTML(printData, yearMonth) {
  const [year, month] = yearMonth.split('-');
  const monthNames = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
  ];
  const monthName = monthNames[parseInt(month, 10) - 1];

  let totalInfeksius = 0, totalJarum = 0, totalBotol = 0, totalSitotoksik = 0, grandTotal = 0;

  const rowsHTML = printData.map((item, index) => {
    const inf = parseFloat(item.infeksius) || 0;
    const jar = parseFloat(item.jarum_suntik) || 0;
    const bot = parseFloat(item.botol_obat) || 0;
    const sit = parseFloat(item.sitotoksik) || 0;
    const tot = inf + jar + bot + sit;
    totalInfeksius += inf; totalJarum += jar; totalBotol += bot; totalSitotoksik += sit; grandTotal += tot;
    const tanggal = item.tanggal ? item.tanggal.split('-').reverse().join('/') : '';
    return `<tr><td class="center">${index + 1}</td><td class="center">${tanggal}</td><td class="number">${inf.toFixed(2)}</td><td class="number">${jar.toFixed(2)}</td><td class="number">${bot.toFixed(2)}</td><td class="number">${sit.toFixed(2)}</td><td class="number bold">${tot.toFixed(2)}</td></tr>`;
  }).join('');

  return `<!DOCTYPE html><html lang="id"><head><meta charset="UTF-8"><title>Laporan Limbah Padat - ${monthName} ${year}</title>
<style>
*{box-sizing:border-box}html,body{margin:0;padding:0;background:#fff;color:#000;font-family:Arial,Helvetica,sans-serif}
body{padding:20px}.header{text-align:center;margin-bottom:20px}.header h2{margin:0;font-size:20px;line-height:1.4}.header p{margin:5px 0 0;font-size:13px}
table{width:100%;border-collapse:collapse;margin-top:20px}th,td{border:1px solid #000;padding:7px;font-size:12px}
th{background:#f2f2f2;text-align:center;font-weight:bold}.center{text-align:center}.number{text-align:right}.bold{font-weight:bold}
.totals{font-weight:bold;background:#e6e6e6}.signature{margin-top:50px;display:flex;justify-content:flex-end}
.signature-box{width:220px;text-align:center;font-size:13px}.signature-space{height:70px}
@media print{@page{size:A4 portrait;margin:10mm}body{-webkit-print-color-adjust:exact;print-color-adjust:exact}
table{page-break-inside:auto}tr{page-break-inside:avoid}thead{display:table-header-group}tfoot{display:table-row-group}}
</style></head><body>
<div class="header"><h2>LAPORAN BULANAN LIMBAH MEDIS PADAT</h2><p>Bulan ${monthName} Tahun ${year}</p><p>RSUD Prof. Dr. W.Z. Johannes Kupang</p></div>
<table><thead><tr><th rowspan="2">No.</th><th rowspan="2">Tanggal</th><th colspan="4">Jenis Limbah (Kg)</th><th rowspan="2">Total Harian (Kg)</th></tr>
<tr><th>Infeksius</th><th>Jarum Suntik</th><th>Botol Obat</th><th>Sitotoksik</th></tr></thead>
<tbody>${rowsHTML}</tbody>
<tfoot><tr class="totals"><td colspan="2" class="center">TOTAL DALAM SEBULAN</td><td class="number">${totalInfeksius.toFixed(2)}</td><td class="number">${totalJarum.toFixed(2)}</td><td class="number">${totalBotol.toFixed(2)}</td><td class="number">${totalSitotoksik.toFixed(2)}</td><td class="number">${grandTotal.toFixed(2)}</td></tr></tfoot>
</table>
<div class="signature"><div class="signature-box"><p>Mengetahui,</p><div class="signature-space"></div><p><strong>_____________________</strong></p><p>Petugas Sanitasi</p></div></div>
</body></html>`;
}
