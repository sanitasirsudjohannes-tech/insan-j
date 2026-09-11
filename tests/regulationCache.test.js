import test from 'node:test';
import assert from 'node:assert/strict';
import { getRegulationCache, regulationCacheTtlMs, setRegulationCache } from '../api/_lib/regulationCache.js';

test('cache regulasi berlaku tujuh hari dan menormalkan pertanyaan', () => {
  const now = 1_000_000;
  const value = { summary: 'Hasil', sources: [{ url: 'https://jdih.example' }] };
  setRegulationCache('Peraturan   LIMBAH cair?', value, now);
  assert.equal(getRegulationCache('peraturan limbah cair', now + 1000)?.summary, 'Hasil');
  assert.equal(getRegulationCache('peraturan limbah cair', now + regulationCacheTtlMs), null);
});

test('hasil tanpa sumber tidak disimpan', () => {
  setRegulationCache('pertanyaan tanpa hasil', { sources: [] }, 100);
  assert.equal(getRegulationCache('pertanyaan tanpa hasil', 101), null);
});
