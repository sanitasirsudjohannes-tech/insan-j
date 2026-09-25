import test from 'node:test';
import assert from 'node:assert/strict';
import { formatDeleteWasteTypes } from '../src/lib/deleteConfirmation.js';

test('format jenis limbah hanya menampilkan nilai di atas nol', () => {
  const result = formatDeleteWasteTypes(
    { infeksius: 2.5, jarum_suntik: 0, botol_obat: '1.25' },
    [
      { key: 'infeksius', label: 'Infeksius' },
      { key: 'jarum_suntik', label: 'Jarum suntik' },
      { key: 'botol_obat', label: 'Botol obat' },
    ]
  );
  assert.equal(result, 'Infeksius (2,5 kg), Botol obat (1,25 kg)');
});

test('format jenis limbah menjelaskan ketika semua nilai nol', () => {
  assert.equal(
    formatDeleteWasteTypes({ kardus: 0 }, [{ key: 'kardus', label: 'Kardus' }]),
    'Tidak ada nilai limbah di atas 0 kg'
  );
});
