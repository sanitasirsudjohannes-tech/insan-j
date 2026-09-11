import test from 'node:test';
import assert from 'node:assert/strict';
import { findVerifiedRegulations } from '../api/_lib/verifiedRegulations.js';

test('katalog cadangan menemukan peraturan air limbah terbaru', () => {
  const results = findVerifiedRegulations('Peraturan terbaru terkait limbah cair rumah sakit');
  assert.ok(results.length > 0);
  assert.match(results[0].title, /Nomor 11 Tahun 2025/);
  assert.match(results[0].url, /^https:\/\/jdih\.kemenlh\.go\.id\//);
});

test('katalog tidak menjawab topik di luar kesehatan lingkungan', () => {
  assert.deepEqual(findVerifiedRegulations('aturan pajak kendaraan'), []);
});
