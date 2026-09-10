import test from 'node:test';
import assert from 'node:assert/strict';
import { buildMedicalWasteAnalytics, previousPeriod } from '../src/lib/medicalWasteAnalytics.js';

test('periode pembanding memiliki durasi yang sama dan tepat sebelum periode terpilih', () => {
  assert.deepEqual(previousPeriod('2026-09-01', '2026-09-10'), { start: '2026-08-22', end: '2026-08-31', days: 10 });
});

test('analitik menghitung tren, penumpukan, jenis, ruangan, dan hari tidak biasa', () => {
  const currentRoomRows = [
    { tanggal: '2026-09-01', ruangan: 'Ruang A', infeksius: 30, jarum_suntik: 5, botol_obat: 0, sitotoksik: 0 },
    { tanggal: '2026-09-02', ruangan: 'Ruang B', infeksius: 5, jarum_suntik: 0, botol_obat: 0, sitotoksik: 0 },
  ];
  const previousRoomRows = [{ tanggal: '2026-08-31', ruangan: 'Ruang A', infeksius: 20, jarum_suntik: 0, botol_obat: 0, sitotoksik: 0 }];
  const analytics = buildMedicalWasteAnalytics({
    currentWasteRows: currentRoomRows,
    currentRoomRows,
    currentTransportRows: [{ jumlah_kg: 30 }],
    previousWasteRows: previousRoomRows,
    previousRoomRows,
    previousTransportRows: [{ jumlah_kg: 15 }],
    openingBalanceKg: 10,
    days: 2,
  });
  assert.equal(analytics.changes.generatedPercent, 100);
  assert.equal(analytics.performance.accumulationIncreased, true);
  assert.equal(analytics.dominantType.name, 'limbah infeksius');
  assert.equal(analytics.topRoom.name, 'Ruang A');
  assert.equal(analytics.unusualDays[0].date, '2026-09-01');
});
