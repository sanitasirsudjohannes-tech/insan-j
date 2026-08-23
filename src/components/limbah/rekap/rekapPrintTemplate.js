import { formatKg } from '../../../lib/rekapQueries';
import { buildKepalaUnitSignatureHTML } from '../../../lib/printHelpers';

/**
 * Builds printable HTML string for Rekap Limbah report.
 */
export function buildRekapPrintHTML(tableRows, summary, selectedYear, selectedMonth, kepalaUnit = null) {
  let periodLabel = `Tahun ${selectedYear}`;
  if (selectedMonth && selectedMonth !== 'semua') {
    const monthNames = [
      'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
      'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
    ];
    const mName = monthNames[parseInt(selectedMonth, 10) - 1];
    periodLabel = `${mName} ${selectedYear}`;
  } else {
    periodLabel = `Januari – Desember ${selectedYear}`;
  }

  const rowsHTML = tableRows.map((item, index) => {
    const timbulanStr = item.hasData ? formatKg(item.timbulan) : 'Tidak ada data';
    const diangkutStr = item.hasData ? formatKg(item.diangkut) : 'Tidak ada data';
    const sisaAwalStr = formatKg(item.sisaAwal);
    const sisaAkhirStr = formatKg(item.sisaAkhir);
    const sisaClass = item.sisaAkhir < 0 ? 'number bold text-red' : 'number bold';

    return `
      <tr>
        <td class="center">${index + 1}</td>
        <td class="left">${item.monthName}</td>
        <td class="number">${sisaAwalStr}</td>
        <td class="number">${timbulanStr}</td>
        <td class="number">${diangkutStr}</td>
        <td class="${sisaClass}">${sisaAkhirStr}</td>
      </tr>
    `;
  }).join('');

  const totalTimbulanStr = formatKg(summary.totalTimbulan);
  const totalDiangkutStr = formatKg(summary.totalDiangkut);
  const sisaAkumulasiStr = formatKg(summary.sisaAkumulasi);
  const rataRataStr = formatKg(summary.rataRataTimbulan, ' kg/bulan');

  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <title>Rekapitulasi Pengelolaan Limbah - ${periodLabel}</title>
  <style>
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; background: #fff; color: #000; font-family: Arial, Helvetica, sans-serif; }
    body { padding: 25px; }
    .header { text-align: center; margin-bottom: 25px; border-b: 2px solid #000; padding-bottom: 15px; }
    .header h2 { margin: 0; font-size: 18px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px; }
    .header h3 { margin: 5px 0 0; font-size: 15px; font-weight: bold; color: #333; }
    .header p { margin: 5px 0 0; font-size: 13px; color: #555; }
    
    .summary-grid { display: flex; flex-wrap: wrap; gap: 15px; margin-bottom: 20px; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 6px; padding: 12px 15px; }
    .summary-item { flex: 1; min-width: 140px; }
    .summary-item .label { font-size: 10px; text-transform: uppercase; color: #64748b; font-weight: bold; }
    .summary-item .val { font-size: 14px; font-weight: bold; color: #0f172a; margin-top: 2px; }
    
    table { width: 100%; border-collapse: collapse; margin-top: 10px; }
    th, td { border: 1px solid #000; padding: 8px 10px; font-size: 12px; }
    th { background: #f1f5f9; text-align: center; font-weight: bold; }
    .center { text-align: center; }
    .left { text-align: left; font-weight: 500; }
    .number { text-align: right; }
    .bold { font-weight: bold; }
    .text-red { color: #dc2626; }
    .totals { font-weight: bold; background: #e2e8f0; }
    
    .signature { margin-top: 40px; display: flex; justify-content: flex-end; page-break-inside: avoid; }
    .signature-box { width: 220px; text-align: center; font-size: 12px; }
    .signature-space { height: 60px; }
    
    @media print {
      @page { size: A4 portrait; margin: 10mm; }
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; padding: 0; }
      table { page-break-inside: auto; }
      tr { page-break-inside: avoid; }
      thead { display: table-header-group; }
      tfoot { display: table-row-group; }
    }
  </style>
</head>
<body>
  <div class="header">
    <h2>REKAPITULASI PENGELOLAAN LIMBAH</h2>
    <h3>RSUD Prof. Dr. W.Z. Johannes Kupang</h3>
    <p>Periode: ${periodLabel}</p>
  </div>

  <div class="summary-grid">
    <div class="summary-item">
      <div class="label">Total Timbulan</div>
      <div class="val">${totalTimbulanStr}</div>
    </div>
    <div class="summary-item">
      <div class="label">Total Diangkut</div>
      <div class="val">${totalDiangkutStr}</div>
    </div>
    <div class="summary-item">
      <div class="label">Sisa / Akumulasi</div>
      <div class="val">${sisaAkumulasiStr}</div>
    </div>
    <div class="summary-item">
      <div class="label">Rata-rata Timbulan</div>
      <div class="val">${rataRataStr}</div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width: 50px;">No</th>
        <th>Bulan</th>
        <th style="width: 130px;">Sisa Awal</th>
        <th style="width: 130px;">Timbulan</th>
        <th style="width: 130px;">Diangkut</th>
        <th style="width: 130px;">Sisa Akhir</th>
      </tr>
    </thead>
    <tbody>
      ${rowsHTML}
    </tbody>
    <tfoot>
      <tr class="totals">
        <td colspan="2" class="center">TOTAL</td>
        <td class="center">—</td>
        <td class="number">${totalTimbulanStr}</td>
        <td class="number">${totalDiangkutStr}</td>
        <td class="number">${sisaAkumulasiStr}</td>
      </tr>
    </tfoot>
  </table>

  <div class="signature">
    <div class="signature-box">
      <p>Kupang, ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
      ${buildKepalaUnitSignatureHTML(kepalaUnit)}
    </div>
  </div>
</body>
</html>`;
}
