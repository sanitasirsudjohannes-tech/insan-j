import { supabase } from '../../../lib/supabase';
import { loadExcelLibrary } from '../../../lib/excelLoader';
import { fetchAllSupabaseRows } from '../../../lib/supabasePagination';

export const ARCHIVE_TABLES = [
  { name: 'limbah_padat', label: 'Limbah Padat' },
  { name: 'limbah_ruangan', label: 'Limbah per Ruangan' },
  { name: 'limbah_anorganik', label: 'Limbah Anorganik' },
  { name: 'pengangkutan_limbah', label: 'Pengangkutan Limbah' },
];

const normalizeArchiveYear = (year) => {
  const parsed = Number(year);
  if (!Number.isInteger(parsed) || parsed < 2000 || parsed >= new Date().getFullYear()) {
    throw new Error('Pilih tahun arsip yang valid sebelum tahun berjalan.');
  }
  return parsed;
};

export const getYearRange = (year) => {
  const parsed = normalizeArchiveYear(year);
  return {
    start: `${parsed}-01-01`,
    endExclusive: `${parsed + 1}-01-01`,
  };
};

const checksum = (value) => {
  const text = JSON.stringify(value);
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
};

const fetchTableYear = (tableName, year) => {
  const { start, endExclusive } = getYearRange(year);
  return fetchAllSupabaseRows(() => supabase
    .from(tableName)
    .select('*')
    .gte('tanggal', start)
    .lt('tanggal', endExclusive)
    .order('id', { ascending: true }));
};

export async function inspectArchiveYear(year) {
  const { start, endExclusive } = getYearRange(year);
  const results = await Promise.all(ARCHIVE_TABLES.map(async (table) => {
    const { count, error } = await supabase
      .from(table.name)
      .select('id', { count: 'exact', head: true })
      .gte('tanggal', start)
      .lt('tanggal', endExclusive);
    if (error) throw new Error(`${table.label}: ${error.message}`);
    return { ...table, count: count || 0 };
  }));
  return results;
}

export async function createArchiveBackup(year, createdBy, onProgress = () => {}) {
  const datasets = {};
  for (let index = 0; index < ARCHIVE_TABLES.length; index += 1) {
    const table = ARCHIVE_TABLES[index];
    onProgress(`Mengambil ${table.label}...`, index, ARCHIVE_TABLES.length);
    datasets[table.name] = await fetchTableYear(table.name, year);
  }

  const counts = Object.fromEntries(
    ARCHIVE_TABLES.map(({ name }) => [name, datasets[name].length])
  );
  const dataChecksum = checksum(datasets);
  return {
    format: 'INSAN-J-DATA-ARCHIVE',
    version: 1,
    manifest: {
      year: Number(year),
      createdAt: new Date().toISOString(),
      createdBy: createdBy || 'Administrator',
      counts,
      totalRows: Object.values(counts).reduce((total, count) => total + count, 0),
      checksum: dataChecksum,
    },
    datasets,
  };
}

const downloadBlob = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
};

export function downloadArchiveJson(archive) {
  const content = JSON.stringify(archive, null, 2);
  downloadBlob(
    new Blob([content], { type: 'application/json;charset=utf-8' }),
    `Arsip_INSAN-J_${archive.manifest.year}.json`
  );
}

export async function downloadArchiveExcel(archive) {
  const XLSX = await loadExcelLibrary();
  const workbook = XLSX.utils.book_new();

  const summaryRows = [
    ['ARSIP DATA INSAN-J'],
    ['Tahun', archive.manifest.year],
    ['Dibuat', archive.manifest.createdAt],
    ['Pembuat', archive.manifest.createdBy],
    ['Checksum', archive.manifest.checksum],
    [],
    ['Tabel', 'Jumlah Baris'],
    ...ARCHIVE_TABLES.map(table => [table.label, archive.manifest.counts[table.name]]),
    ['TOTAL', archive.manifest.totalRows],
  ];
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(summaryRows), 'Ringkasan');

  ARCHIVE_TABLES.forEach((table) => {
    const rows = archive.datasets[table.name] || [];
    const sheet = XLSX.utils.json_to_sheet(rows.length ? rows : [{ Keterangan: 'Tidak ada data' }]);
    XLSX.utils.book_append_sheet(workbook, sheet, table.name.slice(0, 31));
  });
  XLSX.writeFile(workbook, `Arsip_INSAN-J_${archive.manifest.year}.xlsx`);
}

export function validateArchiveBackup(archive) {
  if (!archive || archive.format !== 'INSAN-J-DATA-ARCHIVE' || archive.version !== 1) {
    throw new Error('File bukan arsip INSAN-J yang didukung.');
  }
  if (!archive.manifest || !archive.datasets) throw new Error('Manifest arsip tidak lengkap.');

  const archiveYear = normalizeArchiveYear(archive.manifest.year);
  let totalRows = 0;

  ARCHIVE_TABLES.forEach(({ name, label }) => {
    const rows = archive.datasets[name];
    if (!Array.isArray(rows)) throw new Error(`Data ${label} tidak tersedia.`);
    if (rows.length > 100000) throw new Error(`Data ${label} melebihi batas pemulihan.`);
    if (archive.manifest.counts?.[name] !== rows.length) {
      throw new Error(`Jumlah data ${label} tidak sesuai manifest.`);
    }

    const seenIds = new Set();
    rows.forEach((row, index) => {
      if (!row || typeof row !== 'object' || Array.isArray(row)) {
        throw new Error(`Baris ${index + 1} pada ${label} tidak valid.`);
      }
      if (row.id === null || row.id === undefined || row.id === '') {
        throw new Error(`Baris ${index + 1} pada ${label} tidak memiliki ID.`);
      }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(String(row.tanggal || ''))
          || Number(String(row.tanggal).slice(0, 4)) !== archiveYear) {
        throw new Error(`Tanggal baris ${index + 1} pada ${label} berada di luar tahun arsip ${archiveYear}.`);
      }
      const id = String(row.id);
      if (seenIds.has(id)) throw new Error(`ID ganda ditemukan pada ${label}.`);
      seenIds.add(id);
    });

    totalRows += rows.length;
  });

  if (archive.manifest.totalRows !== totalRows) throw new Error('Total data arsip tidak sesuai.');
  if (archive.manifest.checksum !== checksum(archive.datasets)) {
    throw new Error('Checksum tidak cocok. File mungkin berubah atau rusak.');
  }
  return archive;
}

export async function deleteArchivedYear(year, onProgress = () => {}) {
  const normalizedYear = normalizeArchiveYear(year);
  if (normalizedYear > new Date().getFullYear() - 2) {
    throw new Error('Tahun berjalan dan tahun sebelumnya tidak boleh dihapus.');
  }

  onProgress('Menghapus arsip secara transaksional...');
  const { data, error } = await supabase.rpc('admin_delete_archived_year', {
    p_year: normalizedYear,
  });
  if (error) throw new Error(error.message);
  return data || {};
}

export async function restoreArchiveBackup(archive, onProgress = () => {}) {
  const validated = validateArchiveBackup(archive);
  onProgress('Memulihkan arsip secara transaksional...');

  const { data, error } = await supabase.rpc('admin_restore_data_archive', {
    p_year: validated.manifest.year,
    p_datasets: validated.datasets,
  });
  if (error) throw new Error(error.message);
  return data || {};
}
