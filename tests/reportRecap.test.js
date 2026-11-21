import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateOpeningBalance } from '../src/lib/reportRecapCalculations.js';

test('saldo awal memasukkan timbulan dan pengangkutan sebelum periode', () => {
  const yearlyData = {
    padatRows: [{ tanggal: '2025-12-01', infeksius: 100, jarum_suntik: 10, botol_obat: 5, sitotoksik: 0 }],
    ruanganRows: [{ tanggal: '2026-08-01', infeksius: 50, jarum_suntik: 5, botol_obat: 0, sitotoksik: 0 }],
    angkutRows: [{ tanggal: '2026-08-01', jumlah_kg: 120 }],
  };
  const partialWaste = [{ infeksius: 20, jarum_suntik: 0, botol_obat: 0, sitotoksik: 0 }];
  const partialTransport = [{ jumlah_kg: 10 }];
  assert.equal(calculateOpeningBalance(yearlyData, partialWaste, partialTransport, '2026-09-01'), 60);
});
