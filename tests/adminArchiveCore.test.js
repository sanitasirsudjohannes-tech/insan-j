import test from 'node:test';
import assert from 'node:assert/strict';
import {
  chunkRows,
  getDeleteConfirmation,
  getRestoreConfirmation,
  sha256Text,
  validateBackupBundle,
} from '../src/lib/adminArchiveCore.js';

const createBundle = async () => {
  const rows = [{
    id: '2b33531a-4db7-4bf4-9839-bdfacb087ef8',
    tanggal: '2026-01-05',
    infeksius: 2,
    waktu_input: '2026-01-05T01:00:00.000Z',
  }];
  const payload = {
    schema_version: 1,
    application: 'INSAN-J',
    generated_at: '2026-08-31T00:00:00.000Z',
    period: { start: '2026-01-01', end: '2026-12-31' },
    selected_tables: ['limbah_padat'],
    tables: { limbah_padat: rows },
  };
  const manifest = {
    archive_id: 'd22177e4-0261-4bd7-9f5f-39eecf8f02ea',
    schema_version: 1,
    application: 'INSAN-J',
    generated_at: payload.generated_at,
    period: payload.period,
    selected_tables: payload.selected_tables,
    table_counts: { limbah_padat: rows.length },
    table_checksums: { limbah_padat: await sha256Text(JSON.stringify(rows)) },
    checksum_sha256: await sha256Text(JSON.stringify(payload)),
    file_name: 'INSAN-J_Backup_2026.zip',
  };
  return { manifest, payload };
};

test('backup valid lolos verifikasi checksum dan jumlah', async () => {
  const bundle = await createBundle();
  const verified = await validateBackupBundle(bundle);
  assert.equal(verified.totalRows, 1);
  assert.deepEqual(verified.manifest.selected_tables, ['limbah_padat']);
});

test('backup yang diubah ditolak', async () => {
  const bundle = await createBundle();
  bundle.payload.tables.limbah_padat[0].infeksius = 99;
  await assert.rejects(
    () => validateBackupBundle(bundle),
    /Checksum tabel limbah_padat tidak cocok/,
  );
});

test('pemecahan staging mempertahankan indeks record', () => {
  const rows = Array.from({ length: 5 }, (_, index) => ({ id: index + 1 }));
  assert.deepEqual(chunkRows(rows, 2), [
    { startIndex: 0, rows: rows.slice(0, 2) },
    { startIndex: 2, rows: rows.slice(2, 4) },
    { startIndex: 4, rows: rows.slice(4, 5) },
  ]);
});

test('kalimat konfirmasi membedakan setahun penuh dan rentang khusus', () => {
  assert.equal(getDeleteConfirmation('2026-01-01', '2026-12-31'), 'HAPUS DATA 2026');
  assert.equal(
    getDeleteConfirmation('2026-01-01', '2026-06-30'),
    'HAPUS DATA 2026-01-01 2026-06-30',
  );
  assert.equal(getRestoreConfirmation('2026-01-01', '2026-12-31'), 'PULIHKAN DATA 2026');
});
