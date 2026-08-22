/**
 * anorganikPrintTemplate.js
 * Menghasilkan string HTML lengkap untuk laporan cetak Limbah Anorganik.
 *
 * @param {Array}  printData   – Data dari Supabase, sudah ter-sort.
 * @param {string} periodeText – Teks periode, mis. "Agustus 2026".
 * @param {string} ruanganText – Teks filter ruangan, mis. "Semua Ruangan".
 * @param {string} printedDate – Tanggal cetak, sudah diformat lokal.
 * @returns {string} HTML string siap cetak.
 */
export function buildAnorganikPrintHTML(printData, periodeText, ruanganText, printedDate) {
  const escapeHTML = (v) =>
    String(v ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');

  const fmtKg   = (v) => (Number.isFinite(parseFloat(v)) ? parseFloat(v) : 0).toFixed(2);
  const fmtBuah = (v) => {
    const n = parseFloat(v) || 0;
    return Number.isInteger(n) ? String(n) : n.toFixed(2);
  };

  // Running totals
  let totals = { infus: 0, jerigen: 0, kertas: 0, kardus: 0, botol_mineral: 0, bayclin_dll: 0 };

  const rowsHTML = printData.map((item, index) => {
    const vals = {
      infus:        parseFloat(item.infus)        || 0,
      jerigen:      parseFloat(item.jerigen)      || 0,
      kertas:       parseFloat(item.kertas)       || 0,
      kardus:       parseFloat(item.kardus)       || 0,
      botol_mineral:parseFloat(item.botol_mineral)|| 0,
      bayclin_dll:  parseFloat(item.bayclin_dll)  || 0,
    };
    Object.keys(totals).forEach(k => { totals[k] += vals[k]; });

    const rowTotal = vals.infus + vals.kertas + vals.kardus + vals.botol_mineral + vals.bayclin_dll;
    const tgl = item.tanggal
      ? new Date(`${item.tanggal}T00:00:00`).toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' })
      : '-';

    return `<tr>
      <td class="center">${index + 1}</td>
      <td class="nowrap">${tgl}</td>
      <td class="room">${escapeHTML(item.ruangan || '-')}</td>
      <td class="number">${fmtKg(vals.infus)}</td>
      <td class="number buah">${fmtBuah(vals.jerigen)}</td>
      <td class="number">${fmtKg(vals.kertas)}</td>
      <td class="number">${fmtKg(vals.kardus)}</td>
      <td class="number">${fmtKg(vals.botol_mineral)}</td>
      <td class="number">${fmtKg(vals.bayclin_dll)}</td>
      <td class="number total"><strong>${fmtKg(rowTotal)}</strong></td>
      <td>${escapeHTML(item.petugas || '-')}</td>
      <td>${escapeHTML(item.keterangan || '-')}</td>
    </tr>`;
  }).join('');

  const grandKg = totals.infus + totals.kertas + totals.kardus + totals.botol_mineral + totals.bayclin_dll;

  return `<!DOCTYPE html><html lang="id"><head><meta charset="UTF-8">
<title>Laporan Limbah Anorganik - ${periodeText}</title>
<style>
*{box-sizing:border-box}html,body{margin:0;padding:0}
body{font-family:Arial,Helvetica,sans-serif;color:#111827;font-size:10px;line-height:1.4;background:#fff}
.container{width:100%;padding:15mm}
.header{text-align:center;margin-bottom:15px}.header h1{margin:0;font-size:15px;font-weight:700;text-transform:uppercase}
.header h2{margin:4px 0 0;font-size:13px;font-weight:700}.header p{margin:3px 0;font-size:10px;color:#374151}
.line{border-top:2px solid #111827;margin-top:10px}
.info{display:flex;justify-content:space-between;gap:20px;margin-bottom:10px;font-size:10px}
.info-left,.info-right{flex:1}.info-right{text-align:right}
table{width:100%;border-collapse:collapse;table-layout:fixed}
thead{display:table-header-group}tfoot{display:table-footer-group}
tr{page-break-inside:avoid;break-inside:avoid}
th,td{border:1px solid #000;padding:4px 3px;vertical-align:middle}
th{text-align:center;font-weight:700;background:#e5e7eb}
.center{text-align:center}.number{text-align:right;white-space:nowrap}.nowrap{white-space:nowrap}
.room{font-weight:600}.total{font-weight:700}.buah{color:#92400e}
.totals{font-weight:700;background:#e5e7eb}.totals td{border-top:2px solid #000}
.signature-wrapper{margin-top:35px;display:flex;justify-content:flex-end}
.signature{width:220px;text-align:center}.signature .space{height:65px}.signature .name{font-weight:700}
@page{size:A4 landscape;margin:10mm}
@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}.container{padding:0}}
</style></head><body>
<div class="container">
  <div class="header">
    <h1>LAPORAN LIMBAH AN-ORGANIK</h1>
    <h2>RSUD Prof. Dr. W.Z. Johannes Kupang</h2>
    <p>Periode ${periodeText}</p>
    <div class="line"></div>
  </div>
  <div class="info">
    <div class="info-left"><strong>Periode:</strong> ${periodeText}<br><strong>Filter:</strong> ${ruanganText}</div>
    <div class="info-right"><strong>Jumlah Data:</strong> ${printData.length} data<br><strong>Tanggal Cetak:</strong> ${printedDate}</div>
  </div>
  <table>
    <colgroup>
      <col style="width:3%"><col style="width:8%"><col style="width:12%">
      <col style="width:7%"><col style="width:7%"><col style="width:7%">
      <col style="width:7%"><col style="width:9%"><col style="width:8%">
      <col style="width:8%"><col style="width:11%"><col style="width:13%">
    </colgroup>
    <thead>
      <tr>
        <th rowspan="2">No.</th><th rowspan="2">Tanggal</th><th rowspan="2">Ruangan</th>
        <th colspan="6">Jenis Limbah Anorganik</th>
        <th rowspan="2">Total<br>(Kg)</th><th rowspan="2">Petugas</th><th rowspan="2">Keterangan</th>
      </tr>
      <tr>
        <th>Infus<br>(Kg)</th><th>Jerigen<br>(Buah)</th><th>Kertas<br>(Kg)</th>
        <th>Kardus<br>(Kg)</th><th>Botol Mineral<br>(Kg)</th><th>Bayclin dll<br>(Kg)</th>
      </tr>
    </thead>
    <tbody>${rowsHTML}</tbody>
    <tfoot>
      <tr class="totals">
        <td colspan="3" class="center">TOTAL DALAM SEBULAN</td>
        <td class="number">${fmtKg(totals.infus)}</td>
        <td class="number">${fmtBuah(totals.jerigen)}</td>
        <td class="number">${fmtKg(totals.kertas)}</td>
        <td class="number">${fmtKg(totals.kardus)}</td>
        <td class="number">${fmtKg(totals.botol_mineral)}</td>
        <td class="number">${fmtKg(totals.bayclin_dll)}</td>
        <td class="number">${fmtKg(grandKg)}</td>
        <td></td><td></td>
      </tr>
    </tfoot>
  </table>
  <div class="signature-wrapper">
    <div class="signature"><div>Mengetahui,</div><div class="space"></div><div class="name">__________________________</div><div>Petugas Sanitasi</div></div>
  </div>
</div>
</body></html>`;
}
