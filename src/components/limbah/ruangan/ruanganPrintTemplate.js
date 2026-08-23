import { buildKepalaUnitSignatureHTML } from '../../../lib/printHelpers';

/**
 * ruanganPrintTemplate.js
 * Menghasilkan string HTML lengkap untuk laporan cetak Limbah Per Ruangan.
 *
 * @param {Array}  printData       - Data dari Supabase, sudah ter-sort.
 * @param {string} periodeText     - Teks periode, mis. "Agustus 2026".
 * @param {string} ruanganText     - Teks filter ruangan, mis. "Semua Ruangan".
 * @param {string} printedDate     - Tanggal cetak, sudah diformat lokal.
 * @returns {string} HTML string siap cetak.
 */
export function buildRuanganPrintHTML(printData, periodeText, ruanganText, printedDate, kepalaUnit = null) {
  const escapeHTML = (v) => String(v ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
  const fmt = (v) => (Number.isFinite(parseFloat(v)) ? parseFloat(v) : 0).toFixed(2);

  let totalInf = 0, totalJar = 0, totalBot = 0, totalSit = 0, grandTotal = 0;

  const rowsHTML = printData.map((item, index) => {
    const inf = parseFloat(item.infeksius) || 0;
    const jar = parseFloat(item.jarum_suntik) || 0;
    const bot = parseFloat(item.botol_obat) || 0;
    const sit = parseFloat(item.sitotoksik) || 0;
    const tot = inf + jar + bot + sit;
    totalInf += inf; totalJar += jar; totalBot += bot; totalSit += sit; grandTotal += tot;

    const tgl = item.tanggal
      ? new Date(`${item.tanggal}T00:00:00`).toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' })
      : '-';

    return `<tr>
      <td class="center">${index + 1}</td>
      <td class="nowrap">${tgl}</td>
      <td class="room">${escapeHTML(item.ruangan || '-')}</td>
      <td class="number infeksius">${fmt(inf)}</td>
      <td class="number jarum">${fmt(jar)}</td>
      <td class="number botol">${fmt(bot)}</td>
      <td class="number sitotoksik">${fmt(sit)}</td>
      <td class="number total"><strong>${fmt(tot)}</strong></td>
      <td>${escapeHTML(item.petugas || '-')}</td>
      <td>${escapeHTML(item.keterangan || '-')}</td>
    </tr>`;
  }).join('');

  return `<!DOCTYPE html><html lang="id"><head><meta charset="UTF-8">
<title>Laporan Limbah Ruangan - ${periodeText}</title>
<style>
*{box-sizing:border-box}html,body{margin:0;padding:0}
body{font-family:Arial,Helvetica,sans-serif;color:#111827;font-size:11px;line-height:1.4;background:#fff}
.container{width:100%;padding:15mm}
.header{text-align:center;margin-bottom:15px}.header h1{margin:0;font-size:17px;font-weight:700;text-transform:uppercase}
.header h2{margin:4px 0 0;font-size:14px;font-weight:700}.header p{margin:3px 0;font-size:10px;color:#374151}
.line{border-top:2px solid #111827;margin-top:10px}
.info{display:flex;justify-content:space-between;gap:20px;margin-bottom:10px;font-size:10px}
.info-left,.info-right{flex:1}.info-right{text-align:right}
table{width:100%;border-collapse:collapse;table-layout:fixed}
thead{display:table-header-group}tfoot{display:table-footer-group}
tr{page-break-inside:avoid;break-inside:avoid}
th,td{border:1px solid #000;padding:5px 4px;vertical-align:middle}
th{text-align:center;font-weight:700;background:#e5e7eb}
.center{text-align:center}.number{text-align:right;white-space:nowrap}.nowrap{white-space:nowrap}
.room{font-weight:600}.total{font-weight:700}
.totals{font-weight:700;background:#e5e7eb}.totals td{border-top:2px solid #000}
.signature-wrapper{margin-top:35px;display:flex;justify-content:flex-end}
.signature{width:230px;text-align:center}.signature .space{height:65px}.signature .name{font-weight:700}
@page{size:A4 landscape;margin:10mm}
@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}.container{padding:0}}
</style></head><body>
<div class="container">
  <div class="header">
    <h1>LAPORAN LIMBAH MEDIS PADAT PER RUANGAN</h1>
    <h2>RSUD Prof. Dr. W.Z. Johannes Kupang</h2>
    <p>Periode ${periodeText}</p>
    <div class="line"></div>
  </div>
  <div class="info">
    <div class="info-left"><strong>Periode:</strong> ${periodeText}<br><strong>Filter:</strong> ${ruanganText}</div>
    <div class="info-right"><strong>Jumlah Data:</strong> ${printData.length} data<br><strong>Tanggal Cetak:</strong> ${printedDate}</div>
  </div>
  <table>
    <colgroup><col style="width:4%"><col style="width:9%"><col style="width:15%"><col style="width:9%"><col style="width:9%"><col style="width:9%"><col style="width:9%"><col style="width:10%"><col style="width:12%"><col style="width:14%"></colgroup>
    <thead>
      <tr>
        <th rowspan="2">No.</th><th rowspan="2">Tanggal</th><th rowspan="2">Ruangan</th>
        <th colspan="4">Jenis Limbah (Kg)</th>
        <th rowspan="2">Total Harian<br>(Kg)</th><th rowspan="2">Petugas</th><th rowspan="2">Keterangan</th>
      </tr>
      <tr><th>Infeksius</th><th>Jarum Suntik</th><th>Botol Obat</th><th>Sitotoksik</th></tr>
    </thead>
    <tbody>${rowsHTML}</tbody>
    <tfoot>
      <tr class="totals">
        <td colspan="3" class="center">TOTAL DALAM SEBULAN</td>
        <td class="number">${fmt(totalInf)}</td><td class="number">${fmt(totalJar)}</td>
        <td class="number">${fmt(totalBot)}</td><td class="number">${fmt(totalSit)}</td>
        <td class="number">${fmt(grandTotal)}</td><td></td><td></td>
      </tr>
    </tfoot>
  </table>
  <div class="signature-wrapper">
    <div class="signature">${buildKepalaUnitSignatureHTML(kepalaUnit)}</div>
  </div>
</div>
</body></html>`;
}
