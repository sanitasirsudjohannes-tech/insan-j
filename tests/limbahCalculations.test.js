import test from 'node:test';
import assert from 'node:assert/strict';
import { distributeValue } from '../src/lib/limbah/ruanganDistribution.js';
import { accumulatePadatRows } from '../src/lib/limbah/padatAggregation.js';
import { compareWasteRows } from '../src/lib/limbah/rowOrder.js';

test('distribusi memberi sisa pembulatan hanya ke tanggal terakhir', () => {
  assert.deepEqual(distributeValue('10', 3), [3.33, 3.33, 3.34]);
  assert.deepEqual(distributeValue('0.01', 3), [0, 0, 0.01]);
  assert.deepEqual(distributeValue('1.235', 1), [1.24]);
});

test('distribusi mempertahankan total dalam satuan seperseratus kg', () => {
  for (let cents = 0; cents < 10000; cents += 37) {
    for (let days = 1; days <= 31; days++) {
      const shares = distributeValue(cents / 100, days);
      assert.equal(shares.length, days);
      assert.equal(shares.reduce((sum, share) => sum + Math.round(share * 100), 0), cents);
      assert.ok(shares.every(share => share >= 0));
    }
  }
});

test('nilai kosong dan nol menghasilkan pembagian nol tanpa NaN', () => {
  for (const value of ['', null, undefined, 0, '0', 'bukan angka']) {
    assert.deepEqual(distributeValue(value, 3), [0, 0, 0]);
  }
  assert.deepEqual(distributeValue(10, 0), []);
});

test('akumulasi menggabungkan ruangan dan manual tanpa kehilangan metadata edit', () => {
  const manual = Object.freeze({ id: 'p1', tanggal: '2026-08-28', infeksius: '2', jarum_suntik: 1, waktu_input: 'v1' });
  const rooms = Object.freeze([
    Object.freeze({ id: 'r1', tanggal: '2026-08-28', ruangan: 'ICU', infeksius: 3, botol_obat: 0.5 }),
    Object.freeze({ id: 'off_r2', tanggal: '2026-08-28', ruangan: 'IGD', infeksius: 4, sitotoksik: 0.25, isOffline: true }),
  ]);
  const [daily] = accumulatePadatRows(Object.freeze([manual]), rooms);
  assert.deepEqual([daily.infeksius, daily.jarum_suntik, daily.botol_obat, daily.sitotoksik], [9, 1, 0.5, 0.25]);
  assert.equal(daily.ruanganCount, 2);
  assert.deepEqual([...daily.ruanganNames], ['ICU', 'IGD']);
  assert.equal(daily.isRoomAccumulation, true);
  assert.equal(daily.isManual, true);
  assert.equal(daily.isOffline, true);
  assert.deepEqual(daily.padatIds, ['p1']);
  assert.equal(daily.manualRecords[0], manual);
});

test('akumulasi menjaga tanggal dan semua record manual terpisah', () => {
  const first = { id: 'p1', tanggal: '2026-08-27', infeksius: 2 };
  const second = { id: 'off_p2', tanggal: '2026-08-27', infeksius: 3, isOffline: true };
  const rows = accumulatePadatRows([first, second], [
    { id: 'r1', tanggal: '2026-08-28', ruangan: 'ICU', infeksius: 5 },
    { id: 'invalid', infeksius: 999 },
  ]);
  const manualDay = rows.find(row => row.tanggal === '2026-08-27');
  const roomDay = rows.find(row => row.tanggal === '2026-08-28');
  assert.equal(rows.length, 2);
  assert.equal(manualDay.infeksius, 5);
  assert.deepEqual(manualDay.padatIds, ['p1', 'off_p2']);
  assert.deepEqual(manualDay.manualRecords, [first, second]);
  assert.equal(manualDay.isOffline, true);
  assert.equal(roomDay.isManual, false);
  assert.deepEqual(roomDay.manualRecords, []);
});

test('ruangan berulang tetap dihitung per record dan nama tidak diduplikasi', () => {
  const [daily] = accumulatePadatRows([], [
    { tanggal: '2026-08-28', ruangan: 'ICU', infeksius: '1.5' },
    { tanggal: '2026-08-28', ruangan: 'ICU', infeksius: '2.5' },
  ]);
  assert.equal(daily.ruanganCount, 2);
  assert.deepEqual([...daily.ruanganNames], ['ICU']);
  assert.equal(daily.infeksius, 4);
  assert.equal(daily.jarum_suntik, 0);
  assert.deepEqual(accumulatePadatRows([], []), []);
});

test('urutan draft dan server mengikuti tanggal lalu waktu input menurun', () => {
  const rows = [
    { id: 'old', tanggal: '2026-08-27', waktu_input: '2026-08-29T00:00:00Z' },
    { id: 'early', tanggal: '2026-08-28', waktu_input: '2026-08-28T01:00:00Z' },
    { id: 'off_new', tanggal: '2026-08-28', waktu_input: '2026-08-28T02:00:00Z' },
    { id: 'missing' },
  ];
  assert.deepEqual(rows.sort(compareWasteRows).map(row => row.id), ['off_new', 'early', 'old', 'missing']);
  assert.equal(compareWasteRows({}, {}), 0);
  assert.equal(compareWasteRows(rows[0], { ...rows[0], id: 'other' }), 0);
});
