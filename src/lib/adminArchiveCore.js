export const OPERATIONAL_ARCHIVE_TABLES = [
  { id: 'limbah_padat', label: 'Limbah Padat', shortLabel: 'Padat' },
  { id: 'limbah_ruangan', label: 'Limbah Per Ruangan', shortLabel: 'Ruangan' },
  { id: 'limbah_anorganik', label: 'Limbah Anorganik', shortLabel: 'Anorganik' },
  { id: 'pengangkutan_limbah', label: 'Pengangkutan Limbah', shortLabel: 'Pengangkutan' },
  { id: 'ruang_bangunan', label: 'Pemeriksaan Ruang Bangunan', shortLabel: 'Bangunan' },
  { id: 'limbah_medis', label: 'Pemeriksaan Pengolahan Limbah', shortLabel: 'Pengolahan' },
  { id: 'pemeriksaan_toilet', label: 'Pemeriksaan Toilet', shortLabel: 'Toilet' },
  { id: 'pemeriksaan_reservoir', label: 'Pemeriksaan Reservoir', shortLabel: 'Reservoir' },
  { id: 'pemeriksaan_gizi', label: 'Pemeriksaan Gizi', shortLabel: 'Gizi' },
];

const ALLOWED_TABLES = new Set(OPERATIONAL_ARCHIVE_TABLES.map(table => table.id));

export const getDefaultArchivePeriod = (date = new Date()) => {
  const year = date.getFullYear();
  return { start: `${year}-01-01`, end: `${year}-12-31` };
};

export const sha256Text = async (value) => {
  const bytes = new TextEncoder().encode(String(value));
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('');
};

export const chunkRows = (rows, size = 200) => {
  if (!Array.isArray(rows)) return [];
  const safeSize = Number.isSafeInteger(size) && size > 0 ? size : 200;
  const chunks = [];
  for (let index = 0; index < rows.length; index += safeSize) {
    chunks.push({ startIndex: index, rows: rows.slice(index, index + safeSize) });
  }
  return chunks;
};

const isFullYear = (start, end) => {
  const year = String(start || '').slice(0, 4);
  return start === `${year}-01-01` && end === `${year}-12-31`;
};

export const getDeleteConfirmation = (start, end) => (
  isFullYear(start, end)
    ? `HAPUS DATA ${String(start).slice(0, 4)}`
    : `HAPUS DATA ${start} ${end}`
);

export const getRestoreConfirmation = (start, end) => (
  isFullYear(start, end)
    ? `PULIHKAN DATA ${String(start).slice(0, 4)}`
    : `PULIHKAN DATA ${start} ${end}`
);

export const formatArchiveBytes = (value) => {
  const bytes = Number(value);
  if (!Number.isFinite(bytes) || bytes <= 0) return '—';
  if (bytes < 1024) return `${Math.round(bytes)} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 ** 2)).toFixed(1)} MB`;
};

const requireValidPeriod = (period) => {
  const start = String(period?.start || '');
  const end = String(period?.end || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end) || end < start) {
    throw new Error('Periode di dalam backup tidak valid.');
  }
  return { start, end };
};

export const validateBackupBundle = async ({ manifest, payload }) => {
  if (!manifest || !payload || typeof manifest !== 'object' || typeof payload !== 'object') {
    throw new Error('Paket backup tidak lengkap.');
  }
  if (manifest.application !== 'INSAN-J' || payload.application !== 'INSAN-J') {
    throw new Error('File ini bukan backup INSAN-J.');
  }
  if (Number(manifest.schema_version) !== 1 || Number(payload.schema_version) !== 1) {
    throw new Error('Versi backup belum didukung aplikasi ini.');
  }

  const manifestPeriod = requireValidPeriod(manifest.period);
  const payloadPeriod = requireValidPeriod(payload.period);
  if (manifestPeriod.start !== payloadPeriod.start || manifestPeriod.end !== payloadPeriod.end) {
    throw new Error('Periode manifest dan isi backup berbeda.');
  }

  const selectedTables = Array.isArray(manifest.selected_tables)
    ? [...new Set(manifest.selected_tables.map(String))]
    : [];
  const payloadTables = Array.isArray(payload.selected_tables)
    ? [...new Set(payload.selected_tables.map(String))]
    : [];
  if (
    selectedTables.length === 0
    || selectedTables.some(table => !ALLOWED_TABLES.has(table))
    || JSON.stringify(selectedTables) !== JSON.stringify(payloadTables)
  ) {
    throw new Error('Daftar tabel di dalam backup tidak valid.');
  }

  for (const table of selectedTables) {
    const rows = payload.tables?.[table];
    if (!Array.isArray(rows)) throw new Error(`Data tabel ${table} tidak ditemukan.`);
    if (rows.some(row => !row || row.id === null || row.id === undefined || String(row.id) === '')) {
      throw new Error(`Tabel ${table} memiliki record tanpa ID.`);
    }
    if (Number(manifest.table_counts?.[table]) !== rows.length) {
      throw new Error(`Jumlah data tabel ${table} tidak sesuai manifest.`);
    }
    const tableChecksum = await sha256Text(JSON.stringify(rows));
    if (tableChecksum !== manifest.table_checksums?.[table]) {
      throw new Error(`Checksum tabel ${table} tidak cocok. File mungkin rusak.`);
    }
  }

  const payloadChecksum = await sha256Text(JSON.stringify(payload));
  if (payloadChecksum !== manifest.checksum_sha256) {
    throw new Error('Checksum paket backup tidak cocok. File mungkin rusak atau telah diubah.');
  }

  return {
    manifest: {
      ...manifest,
      period: manifestPeriod,
      selected_tables: selectedTables,
    },
    payload,
    totalRows: selectedTables.reduce(
      (total, table) => total + Number(manifest.table_counts[table] || 0),
      0,
    ),
  };
};

export const archiveStatusMeta = (status) => ({
  created: { label: 'Belum Diverifikasi', className: 'bg-amber-100 text-amber-700' },
  verified: { label: 'Terverifikasi', className: 'bg-emerald-100 text-emerald-700' },
  purged: { label: 'Data Dihapus', className: 'bg-rose-100 text-rose-700' },
  restored: { label: 'Sudah Dipulihkan', className: 'bg-blue-100 text-blue-700' },
  failed: { label: 'Gagal', className: 'bg-gray-200 text-gray-700' },
}[status] || { label: status || 'Tidak Diketahui', className: 'bg-gray-100 text-gray-600' });
