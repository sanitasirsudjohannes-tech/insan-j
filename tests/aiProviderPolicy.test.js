import test from 'node:test';
import assert from 'node:assert/strict';
import { canFallbackFromProvider, describeProviderFailure, fallbackWarning, shouldCountProviderFailure } from '../src/lib/aiProviderPolicy.js';

test('penolakan konfigurasi provider tetap dapat dialihkan', () => {
  assert.equal(canFallbackFromProvider(400), true);
  assert.equal(canFallbackFromProvider(401), true);
  assert.equal(canFallbackFromProvider(403), true);
  assert.equal(canFallbackFromProvider(404), true);
  assert.equal(shouldCountProviderFailure(403), false);
});

test('pesan kegagalan aman dan menjelaskan status tanpa API key', () => {
  assert.equal(describeProviderFailure('gemini', 403), 'API key Gemini tidak memiliki izin akses (403)');
  assert.match(fallbackWarning([{ message: 'Kuota Gemini sedang habis (429)' }], 'groq'), /dialihkan ke GroqCloud/);
  assert.match(fallbackWarning([{ message: 'API key Gemini tidak valid (401)' }], 'local-template'), /template lokal/);
});
