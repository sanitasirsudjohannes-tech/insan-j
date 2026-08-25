export const parseNonNegativeImportNumber = (rawValue) => {
  if (rawValue === null || rawValue === undefined || String(rawValue).trim() === '') {
    return { value: 0, error: null };
  }

  if (typeof rawValue === 'number') {
    return Number.isFinite(rawValue) && rawValue >= 0
      ? { value: rawValue, error: null }
      : { value: null, error: 'harus berupa angka nol atau lebih' };
  }

  let normalized = String(rawValue).trim().replace(/\s+/g, '');
  if (!/^-?[\d.,]+$/.test(normalized)) {
    return { value: null, error: 'bukan angka yang valid' };
  }

  const lastComma = normalized.lastIndexOf(',');
  const lastDot = normalized.lastIndexOf('.');
  if (lastComma !== -1 && lastDot !== -1) {
    normalized = lastComma > lastDot
      ? normalized.replace(/\./g, '').replace(',', '.')
      : normalized.replace(/,/g, '');
  } else if (lastComma !== -1) {
    normalized = normalized.replace(',', '.');
  }

  const value = Number(normalized);
  if (!Number.isFinite(value)) return { value: null, error: 'bukan angka yang valid' };
  if (value < 0) return { value: null, error: 'tidak boleh negatif' };
  return { value, error: null };
};

export const escapeImportHTML = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#039;');

/**
 * Satu pemanggilan INSERT PostgREST dijalankan sebagai satu transaksi database:
 * semua baris tersimpan, atau seluruhnya dibatalkan ketika ada error.
 */
export const insertImportRowsAtomically = async (client, table, payloads) => {
  if (!client || !table || !Array.isArray(payloads) || payloads.length === 0) {
    throw new Error('Data impor tidak tersedia.');
  }

  const { error } = await client.from(table).insert(payloads);
  if (error) throw error;
  return payloads.length;
};
