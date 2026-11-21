import { getSetting } from '../../../lib/api';
import { buildRekapPrintHTML } from '../../../components/limbah/rekap/rekapPrintTemplate';
import { printViaHiddenIframe } from '../../../lib/printHelpers';
export async function printRekap({ tableRows, summary, selectedYear, selectedMonth, frameRef }) {
  const kepalaUnit = await getSetting('kepala_unit_sanitasi', null);
  const html = buildRekapPrintHTML(tableRows, summary, selectedYear, selectedMonth, kepalaUnit);
  if (!await printViaHiddenIframe(html, frameRef)) throw new Error('Dialog cetak gagal dibuka.');
}
