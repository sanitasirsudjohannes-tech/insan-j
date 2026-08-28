/**
 * excelDateHelpers.js
 * Mengurai nilai tanggal dari baris Excel ke format YYYY-MM-DD.
 * Mendukung:
 *  - Serial number Excel (angka, mis. 45292)
 *  - String DD-MM-YYYY atau DD/MM/YYYY
 *  - String YYYY-MM-DD atau YYYY/MM/DD
 *
 * @param {number|string} val - Nilai sel dari sheet_to_json header:1
 * @param {object} excelLibrary - Modul XLSX yang sudah dimuat secara lazy
 * @returns {string} Format "YYYY-MM-DD" atau "" jika tidak dikenali
 */
export function formatDateFromExcel(val, excelLibrary) {
  if (!val) return '';

  const toValidDateString = (year, month, day) => {
    const y = Number(year), m = Number(month), d = Number(day);
    if (!Number.isInteger(y) || !Number.isInteger(m) || !Number.isInteger(d)) return '';
    if (y < 1900 || y > 9999 || m < 1 || m > 12 || d < 1 || d > 31) return '';

    const date = new Date(Date.UTC(y, m - 1, d));
    if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return '';

    return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  };

  if (typeof val === 'number') {
    const date = excelLibrary?.SSF?.parse_date_code(val);
    if (date) {
      return toValidDateString(date.y, date.m, date.d);
    }
  }

  const str = String(val).trim();

  // Format dd-mm-yyyy atau dd/mm/yyyy
  const matchId = str.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (matchId) {
    const [, day, month, year] = matchId;
    return toValidDateString(year, month, day);
  }

  // Format yyyy-mm-dd atau yyyy/mm/dd
  const matchIso = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (matchIso) {
    const [, year, month, day] = matchIso;
    return toValidDateString(year, month, day);
  }

  return '';
}
