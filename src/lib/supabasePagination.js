const DEFAULT_PAGE_SIZE = 500;

/**
 * Ambil seluruh hasil query tanpa terpotong batas maksimal baris API Supabase.
 * buildQuery harus membuat query baru dan memakai urutan yang stabil.
 */
export const fetchAllSupabaseRows = async (buildQuery, pageSize = DEFAULT_PAGE_SIZE) => {
  if (typeof buildQuery !== 'function') {
    throw new Error('Pembuat query Supabase tidak tersedia.');
  }

  const safePageSize = Number.isInteger(pageSize) && pageSize > 0
    ? pageSize
    : DEFAULT_PAGE_SIZE;
  const rows = [];
  let from = 0;

  while (true) {
    const { data, error } = await buildQuery().range(from, from + safePageSize - 1);
    if (error) throw error;

    const batch = Array.isArray(data) ? data : [];
    rows.push(...batch);
    if (batch.length < safePageSize) return rows;

    from += batch.length;
  }
};
