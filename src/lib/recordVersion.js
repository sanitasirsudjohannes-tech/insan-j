import { supabase } from './supabase';
import { notifyDatabaseTablesChanged } from './databaseAggregations';

export const RECORD_VERSION_CONFLICT_CODE = 'INSAN_J_RECORD_VERSION_CONFLICT';

const normalizeRecordVersion = (value) => {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? String(value) : String(parsed);
};

export const getRecordBaseVersion = (record) => (
  record?.offlineBaseUpdatedAt || record?.baseUpdatedAt || record?.waktu_input || null
);

export const isRecordConflictError = (error) => (
  error?.code === RECORD_VERSION_CONFLICT_CODE
);

const createRecordConflictError = ({ table, id, expectedVersion, currentVersion, action }) => {
  const verb = action === 'delete' ? 'dihapus' : 'diubah';
  const error = new Error(
    `Data ini sudah berubah di perangkat lain dan tidak boleh langsung ${verb}. ` +
    'Muat versi terbaru sebelum melanjutkan.'
  );
  error.code = RECORD_VERSION_CONFLICT_CODE;
  error.table = table;
  error.recordId = id;
  error.expectedVersion = expectedVersion || null;
  error.currentVersion = currentVersion || null;
  return error;
};

const getCurrentRecordState = async (table, id) => {
  const { data, error } = await supabase
    .from(table)
    .select('id,waktu_input')
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  return data || null;
};

const explainUnchangedMutation = async ({
  table,
  id,
  expectedVersion,
  appliedVersion,
  action,
  allowMissing,
}) => {
  const currentRecord = await getCurrentRecordState(table, id);

  // Respons request dapat terputus setelah server sebenarnya selesai
  // menyimpan. Versi hasil yang sudah sama berarti retry aman diselesaikan
  // tanpa salah menandai perubahan kita sendiri sebagai konflik.
  if (
    currentRecord?.id && appliedVersion &&
    normalizeRecordVersion(currentRecord.waktu_input) === normalizeRecordVersion(appliedVersion)
  ) {
    return currentRecord;
  }

  if (
    currentRecord?.id && expectedVersion &&
    normalizeRecordVersion(currentRecord.waktu_input) !== normalizeRecordVersion(expectedVersion)
  ) {
    throw createRecordConflictError({
      table,
      id,
      expectedVersion,
      currentVersion: currentRecord.waktu_input,
      action,
    });
  }

  if (!currentRecord && allowMissing) return null;

  const actionLabel = action === 'delete' ? 'menghapusnya' : 'mengubahnya';
  throw new Error(`Data tidak ditemukan atau Anda tidak memiliki izin untuk ${actionLabel}.`);
};

/**
 * waktu_input sudah diperbarui pada setiap edit di aplikasi ini, sehingga
 * dapat menjadi penanda versi tanpa menambah kolom atau fungsi Supabase.
 */
export const updateRecordWithVersion = async (table, id, payload, expectedVersion = null) => {
  let query = supabase.from(table)
    .update(payload)
    .eq('id', id);

  if (expectedVersion) query = query.eq('waktu_input', expectedVersion);

  const { data, error } = await query.select('id,waktu_input').maybeSingle();
  if (error) throw error;
  if (data?.id) {
    notifyDatabaseTablesChanged(table);
    return data;
  }

  return explainUnchangedMutation({
    table,
    id,
    expectedVersion,
    appliedVersion: payload?.waktu_input,
    action: 'update',
  });
};

export const deleteRecordWithVersion = async (
  table,
  id,
  expectedVersion = null,
  { allowMissing = false } = {}
) => {
  let query = supabase.from(table)
    .delete()
    .eq('id', id);

  if (expectedVersion) query = query.eq('waktu_input', expectedVersion);

  const { data, error } = await query.select('id').maybeSingle();
  if (error) throw error;
  if (data?.id) {
    notifyDatabaseTablesChanged(table);
    return data;
  }

  return explainUnchangedMutation({
    table,
    id,
    expectedVersion,
    action: 'delete',
    allowMissing,
  });
};

/**
 * Draft yang bertentangan tidak boleh ditimpa diam-diam. Pengguna dapat
 * memuat data server atau secara sadar melanjutkan edit berdasarkan versi
 * server terbaru.
 */
export const resolveOfflineRecordConflict = async (table, record, alert) => {
  if (!record?.offlineHasConflict || !navigator.onLine) {
    return { record, discardDraft: false };
  }

  const { data: latestRecord, error } = await supabase
    .from(table)
    .select('*')
    .eq('id', record.id)
    .maybeSingle();

  if (error) throw error;
  if (!latestRecord?.id) {
    const choice = await alert.fire({
      icon: 'warning',
      title: 'Data Sudah Tidak Tersedia',
      text: 'Data telah dihapus atau tidak dapat diakses. Batalkan draft lokal yang bertentangan?',
      showCancelButton: true,
      confirmButtonText: 'Batalkan Draft',
      cancelButtonText: 'Kembali',
      confirmButtonColor: '#dc2626',
    });
    return choice.isConfirmed ? { record: null, discardDraft: true } : null;
  }

  const choice = await alert.fire({
    icon: 'warning',
    title: 'Data Sudah Berubah di HP Lain',
    text: 'Muat data terbaru dari server, atau lanjutkan edit draft Anda dengan mengetahui bahwa data server sudah berubah.',
    showDenyButton: true,
    showCancelButton: true,
    confirmButtonText: 'Muat Data Server',
    denyButtonText: 'Lanjutkan Edit Draft',
    cancelButtonText: 'Batal',
    confirmButtonColor: '#2563eb',
    denyButtonColor: '#d97706',
  });

  if (choice.isConfirmed) return { record: latestRecord, discardDraft: true };
  if (choice.isDenied) {
    return {
      record: { ...record, offlineBaseUpdatedAt: latestRecord.waktu_input || null },
      discardDraft: false,
    };
  }

  return null;
};
