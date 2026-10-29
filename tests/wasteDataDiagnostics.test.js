import test from 'node:test';
import assert from 'node:assert/strict';
import { buildWasteDataDiagnostics } from '../src/features/waste-chat/diagnostics/wasteDataDiagnostics.js';

test('diagnostik menemukan tanggal kosong, nol, ruangan terlewat, duplikat, dan pengangkutan terakhir', () => {
  const roomRows = [
    { tanggal: '2026-08-01', ruangan: 'ICU', infeksius: 2, jarum_suntik: 0, botol_obat: 0, sitotoksik: 0 },
    { tanggal: '2026-08-01', ruangan: 'ICU', infeksius: 1, jarum_suntik: 0, botol_obat: 0, sitotoksik: 0 },
    { tanggal: '2026-08-03', ruangan: 'ICU', infeksius: 0, jarum_suntik: 0, botol_obat: 0, sitotoksik: 0 },
    { tanggal: '2026-08-03', ruangan: 'IGD', infeksius: 0, jarum_suntik: 0, botol_obat: 0, sitotoksik: 0 },
  ];
  const diagnostics = buildWasteDataDiagnostics({
    start: '2026-08-01', end: '2026-08-03', wasteRows: roomRows, roomRows,
    transportRows: [{ tanggal: '2026-08-01', jumlah_kg: 3 }], knownRooms: ['ICU', 'IGD'],
  });
  assert.deepEqual(diagnostics.missingDates, ['2026-08-02']);
  assert.deepEqual(diagnostics.zeroOnlyDates, ['2026-08-03']);
  assert.deepEqual(diagnostics.missingRoomDays[0], { date: '2026-08-01', rooms: ['IGD'] });
  assert.equal(diagnostics.duplicateRoomDates[0].roomName, 'ICU');
  assert.equal(diagnostics.transport.lastDate, '2026-08-01');
  assert.equal(diagnostics.transport.daysSinceLast, 2);
  assert.deepEqual(diagnostics.roomInputs[0], {
    date: '2026-08-01', count: 1, names: ['ICU'], officers: [],
  });
});

test('diagnostik menghitung nama ruangan unik dan petugas per tanggal', () => {
  const roomRows = [
    { tanggal: '2026-08-01', ruangan: ' ICU ', petugas: 'Petugas A' },
    { tanggal: '2026-08-01', ruangan: 'icu', petugas: 'Petugas A' },
    { tanggal: '2026-08-01', ruangan: 'IGD', petugas: 'Petugas B' },
  ];
  const diagnostics = buildWasteDataDiagnostics({
    start: '2026-08-01', end: '2026-08-01', wasteRows: roomRows, roomRows,
    knownRooms: ['ICU', 'IGD'],
  });
  assert.deepEqual(diagnostics.roomInputs[0], {
    date: '2026-08-01', count: 2, names: ['ICU', 'IGD'], officers: ['Petugas A', 'Petugas B'],
  });
});


test('nama petugas dinormalisasi tanpa menggandakan kapitalisasi dan spasi', () => {
  const roomRows = [
    { tanggal: '2026-08-01', ruangan: 'ICU', petugas: ' Sunarsih ' },
    { tanggal: '2026-08-01', ruangan: 'IGD', petugas: 'sunarsih' },
  ];
  const diagnostics = buildWasteDataDiagnostics({
    start: '2026-08-01', end: '2026-08-01', wasteRows: roomRows, roomRows,
    knownRooms: ['ICU', 'IGD'],
  });
  assert.deepEqual(diagnostics.roomInputs[0].officers, ['Sunarsih']);
});
