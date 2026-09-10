import test from 'node:test';
import assert from 'node:assert/strict';
import { canFallbackFromProvider, describeProviderFailure, fallbackWarning, normalizeGeminiModel, selectGeminiTextModels, shouldCountProviderFailure } from '../src/lib/aiProviderPolicy.js';

test('penolakan konfigurasi provider tetap dapat dialihkan', () => {
  assert.equal(canFallbackFromProvider(400), true);
  assert.equal(canFallbackFromProvider(401), true);
  assert.equal(canFallbackFromProvider(403), true);
  assert.equal(canFallbackFromProvider(404), true);
  assert.equal(shouldCountProviderFailure(403), false);
});

test('model Gemini dinormalisasi dan dipilih dari kemampuan API key', () => {
  assert.equal(normalizeGeminiModel(' models/gemini-2.5-flash '), 'gemini-2.5-flash');
  assert.deepEqual(selectGeminiTextModels([
    { name: 'models/gemini-live', supportedGenerationMethods: ['bidiGenerateContent'] },
    { name: 'models/gemini-flash-image', supportedGenerationMethods: ['generateContent'] },
    { name: 'models/gemini-2.5-flash', supportedGenerationMethods: ['generateContent'] },
    { name: 'models/gemini-2.5-flash-lite', supportedGenerationMethods: ['generateContent'] },
  ]), ['gemini-2.5-flash-lite', 'gemini-2.5-flash']);
});

test('pesan kegagalan aman dan menjelaskan status tanpa API key', () => {
  assert.equal(describeProviderFailure('gemini', 403), 'API key Gemini tidak memiliki izin akses (403)');
  assert.match(fallbackWarning([{ message: 'Kuota Gemini sedang habis (429)' }], 'groq'), /dialihkan ke GroqCloud/);
  assert.match(fallbackWarning([{ message: 'API key Gemini tidak valid (401)' }], 'local-template'), /template lokal/);
});
