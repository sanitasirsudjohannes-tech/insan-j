import * as XLSX from 'xlsx';

/**
 * excelDateHelpers.js
 * Mengurai nilai tanggal dari baris Excel ke format YYYY-MM-DD.
 * Mendukung:
 *  - Serial number Excel (angka, mis. 45292)
 *  - String DD-MM-YYYY atau DD/MM/YYYY
 *  - String YYYY-MM-DD atau YYYY/MM/DD
 *
 * @param {number|string} val - Nilai sel dari sheet_to_json header:1
 * @returns {string} Format "YYYY-MM-DD" atau "" jika tidak dikenali
 */
export function formatDateFromExcel(val) {
  if (!val) return '';

  if (typeof val === 'number') {
    const date = XLSX.SSF.parse_date_code(val);
    if (date) {
      return `${date.y}-${String(date.m).padStart(2, '0')}-${String(date.d).padStart(2, '0')}`;
    }
  }

  const str = String(val).trim();

  // Format dd-mm-yyyy atau dd/mm/yyyy
  const matchId = str.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})$/);
  if (matchId) {
    const [, day, month, year] = matchId;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }

  // Format yyyy-mm-dd atau yyyy/mm/dd
  const matchIso = str.match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})$/);
  if (matchIso) {
    const [, year, month, day] = matchIso;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }

  return '';
}
