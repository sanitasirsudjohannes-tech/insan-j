import { supabase } from './supabase';
import { loadExcelLibrary } from './excelLoader';
import {
  OPERATIONAL_ARCHIVE_TABLES,
  validateBackupBundle,
} from './adminArchiveCore';

const getFunctionErrorMessage = async (error) => {
  let message = error?.message || 'Permintaan ke server gagal.';
  if (error?.context instanceof Response) {
    try {
      const responseBody = await error.context.clone().json();
      message = responseBody?.error || message;
    } catch {
      // Pertahankan pesan bawaan jika respons bukan JSON.
    }
  }
  return message;
};

export const invokeAdminArchiveFunction = async (functionName, body) => {
  const { data, error } = await supabase.functions.invoke(functionName, { body });
  if (error) throw new Error(await getFunctionErrorMessage(error));
  if (!data?.success) throw new Error(data?.error || 'Operasi Admin tidak berhasil.');
  return data;
};

const createBackupWorkbook = async (manifest, payload) => {
  const XLSX = await loadExcelLibrary();
  const workbook = XLSX.utils.book_new();
  const summaryRows = [
    ['BACKUP DATA INSAN-J'],
    ['Periode', `${manifest.period.start} s.d. ${manifest.period.end}`],
    ['Dibuat', manifest.generated_at],
    ['ID Arsip', manifest.archive_id],
    ['Checksum SHA-256', manifest.checksum_sha256],
    [],
    ['Jenis Data', 'Nama Tabel', 'Jumlah Record'],
    ...manifest.selected_tables.map(table => {
      const meta = OPERATIONAL_ARCHIVE_TABLES.find(item => item.id === table);
      return [meta?.label || table, table, Number(manifest.table_counts[table] || 0)];
    }),
  ];
  const summarySheet = XLSX.utils.aoa_to_sheet(summaryRows);
  summarySheet['!cols'] = [{ wch: 34 }, { wch: 35 }, { wch: 18 }];
  XLSX.utils.book_append_sheet(workbook, summarySheet, 'Ringkasan');

  manifest.selected_tables.forEach((table) => {
    const meta = OPERATIONAL_ARCHIVE_TABLES.find(item => item.id === table);
    const rows = payload.tables[table] || [];
    const sheet = rows.length > 0
      ? XLSX.utils.json_to_sheet(rows)
      : XLSX.utils.aoa_to_sheet([['Tidak ada data pada periode ini']]);
    XLSX.utils.book_append_sheet(workbook, sheet, (meta?.shortLabel || table).slice(0, 31));
  });

  return XLSX.write(workbook, { bookType: 'xlsx', type: 'array', compression: true });
};

export const buildBackupPackage = async ({ manifest, payload }) => {
  await validateBackupBundle({ manifest, payload });
  const [{ zipSync, strToU8 }, workbookBytes] = await Promise.all([
    import('fflate'),
    createBackupWorkbook(manifest, payload),
  ]);

  const archiveBytes = zipSync({
    'manifest.json': strToU8(JSON.stringify(manifest, null, 2)),
    'backup.json': strToU8(JSON.stringify(payload)),
    'INSAN-J_Backup.xlsx': new Uint8Array(workbookBytes),
  }, { level: 6 });

  return new Blob([archiveBytes], { type: 'application/zip' });
};

export const downloadBackupPackage = (blob, fileName) => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  // Beri waktu cukup untuk browser mobile menyalin file ZIP besar sebelum URL
  // objek dilepas dari memori.
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
};

const decodeJson = (bytes, label, strFromU8) => {
  if (!bytes) throw new Error(`${label} tidak ditemukan di dalam paket backup.`);
  try {
    return JSON.parse(strFromU8(bytes));
  } catch {
    throw new Error(`${label} tidak dapat dibaca.`);
  }
};

export const parseBackupPackage = async (file) => {
  if (!file) throw new Error('Pilih file backup terlebih dahulu.');
  const bytes = new Uint8Array(await file.arrayBuffer());
  let bundle;

  if (file.name.toLowerCase().endsWith('.zip') || (bytes[0] === 0x50 && bytes[1] === 0x4b)) {
    const { unzipSync, strFromU8 } = await import('fflate');
    let files;
    try {
      files = unzipSync(bytes);
    } catch {
      throw new Error('File ZIP tidak dapat dibuka atau rusak.');
    }
    bundle = {
      manifest: decodeJson(files['manifest.json'], 'manifest.json', strFromU8),
      payload: decodeJson(files['backup.json'], 'backup.json', strFromU8),
    };
  } else if (file.name.toLowerCase().endsWith('.json')) {
    try {
      bundle = JSON.parse(new TextDecoder().decode(bytes));
    } catch {
      throw new Error('File JSON tidak dapat dibaca.');
    }
  } else {
    throw new Error('Gunakan file backup berformat ZIP atau JSON.');
  }

  return validateBackupBundle(bundle);
};

export const setMaintenanceCache = (enabled) => {
  localStorage.setItem(
    'insan_j_setting_operational_maintenance_mode',
    JSON.stringify(Boolean(enabled)),
  );
  window.dispatchEvent(new CustomEvent('app-setting-changed', {
    detail: { key: 'operational_maintenance_mode', value: Boolean(enabled) },
  }));
};
