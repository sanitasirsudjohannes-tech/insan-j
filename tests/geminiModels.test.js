import test from 'node:test';
import assert from 'node:assert/strict';
import { configuredGeminiModel, normalizeGeminiModel, selectGeminiModels } from '../api/_lib/geminiModels.js';

test('normalizes configured Gemini model names', () => {
  assert.equal(normalizeGeminiModel(' models/gemini-custom '), 'gemini-custom');
  assert.equal(configuredGeminiModel(''), 'gemini-2.5-flash-lite');
});

test('selects only models that support generateContent and prioritizes stable Flash models', () => {
  const models = [
    { name: 'models/gemini-pro-preview', supportedGenerationMethods: ['generateContent'] },
    { name: 'models/gemini-2.5-flash', supportedGenerationMethods: ['generateContent'] },
    { name: 'models/gemini-embedding', supportedGenerationMethods: ['embedContent'] },
    { name: 'models/gemini-2.5-flash-lite', supportedGenerationMethods: ['generateContent'] },
  ];

  assert.deepEqual(selectGeminiModels(models, 'model-yang-tidak-ada'), [
    'gemini-2.5-flash-lite',
    'gemini-2.5-flash',
    'gemini-pro-preview',
  ]);
});

test('honors a configured model when it is available', () => {
  const models = [
    { name: 'models/gemini-2.5-flash', supportedGenerationMethods: ['generateContent'] },
    { name: 'models/gemini-2.5-flash-lite', supportedGenerationMethods: ['generateContent'] },
  ];

  assert.equal(selectGeminiModels(models, 'models/gemini-2.5-flash')[0], 'gemini-2.5-flash');
});
