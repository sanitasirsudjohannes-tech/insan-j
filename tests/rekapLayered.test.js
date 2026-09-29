import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { calculateRekapitulasi } from '../src/features/rekap/domain/rekapCalculations.js';
import { readDataFilters } from '../src/features/rekap/domain/rekapFilters.js';

const source = readFileSync(new URL('../src/features/rekap/services/rekapService.js', import.meta.url), 'utf8')
  .replace(/^import .*;\n/gm, '').replaceAll('export ', '');
function setup({ aggregate = async () => null, online = true, fetchRows, unsynced = [], deleted = [] } = {}) {
  return vm.runInNewContext(source + '\nfetchAllRekapData', {
    supabase: {}, navigator: { onLine: online }, console: { warn() {} },
    getUnsyncedItemsForTable: table => table === 'limbah_ruangan' ? unsynced : [],
    getOfflineDeletedIds: table => table === 'limbah_ruangan' ? deleted : [],
    fetchDatabaseAggregation: aggregate,
    fetchAllSupabaseRows: fetchRows || (async () => []),
  });
}

test('rekap preserves opening balance across years and months', () => {
  const result = calculateRekapitulasi({
    padatRows: [{ tanggal: '2025-12-31', infeksius: 50, is_opening_balance: true }],
    ruanganRows: [{ tanggal: '2026-01-02', infeksius: 100 }, { tanggal: '2026-02-02', infeksius: 25 }],
    angkutRows: [{ tanggal: '2026-01-03', jumlah_kg: 80 }],
  }, '2026', '2');
  assert.equal(result.tableRows[0].sisaAwal, 70);
  assert.equal(result.summary.totalTimbulan, 25);
  assert.equal(result.summary.sisaAkumulasi, 95);
  assert.ok(!result.availableYears.includes('2025'));
});

test('RPC excludes pending edits and deletes before combining drafts', async () => {
  let parameters;
  const load = setup({
    unsynced: [{ id: 'server-1', offlineAction: 'update', tanggal: '2026-01-01', infeksius: 20 }],
    deleted: ['server-2'],
    aggregate: async (_name, args) => { parameters = args; return { ruanganRows: [{ id: 'server-3', infeksius: 10 }] }; },
  });
  const result = await load('2026');
  assert.deepEqual(Array.from(parameters.excluded_ruangan_ids), ['server-1', 'server-2']);
  assert.equal(result.ruanganRows.length, 2);
});

test('online fallback failure rejects rather than presenting incomplete balances', async () => {
  const load = setup({ fetchRows: async () => { throw new Error('Failed query'); } });
  await assert.rejects(load('2026'), /Failed query/);
});

test('offline fallback keeps pending drafts available', async () => {
  const load = setup({ online: false, unsynced: [{ id: 'off_1', infeksius: 12 }], fetchRows: async () => { throw new Error('Offline'); } });
  const result = await load('2026');
  assert.equal(result.ruanganRows[0].infeksius, 12);
});

test('route query parsing preserves requested recap period', () => {
  assert.equal(readDataFilters('?month=2026-09').month, '2026-09');
  assert.equal(readDataFilters('?month=2026-19').month, '');
});
