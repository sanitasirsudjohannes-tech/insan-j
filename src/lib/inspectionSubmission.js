/**
 * Mengirim setiap form inspeksi secara mandiri. Form yang gagal karena jaringan
 * dipindahkan ke antrean, sementara kegagalan validasi/izin tetap dikembalikan
 * ke UI agar isian pengguna tidak dibuang.
 */
export const submitInspectionEntries = async ({
  entries,
  online,
  insertEntry,
  queueEntry,
  isNetworkError,
}) => {
  const queueSafely = (entry, originalError = null) => {
    try {
      queueEntry(entry);
      return { ...entry, status: 'queued', error: originalError };
    } catch (queueError) {
      return { ...entry, status: 'failed', error: queueError };
    }
  };

  const results = await Promise.all(entries.map(async entry => {
    if (!online) return queueSafely(entry);

    try {
      await insertEntry(entry);
      return { ...entry, status: 'synced', error: null };
    } catch (error) {
      if (isNetworkError(error)) return queueSafely(entry, error);
      return { ...entry, status: 'failed', error };
    }
  }));

  return {
    results,
    synced: results.filter(result => result.status === 'synced'),
    queued: results.filter(result => result.status === 'queued'),
    failed: results.filter(result => result.status === 'failed'),
  };
};
