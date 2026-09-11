import { createHash } from 'node:crypto';

const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_ENTRIES = 100;
const cache = new Map();

const normalizeQuestion = value => String(value || '').toLocaleLowerCase('id-ID').replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
const cacheKey = question => createHash('sha256').update(normalizeQuestion(question)).digest('hex');

export function getRegulationCache(question, now = Date.now()) {
  const key = cacheKey(question);
  const entry = cache.get(key);
  if (!entry) return null;
  if (now - entry.savedAt >= CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return { ...entry.value, cacheAgeMs: now - entry.savedAt };
}

export function setRegulationCache(question, value, now = Date.now()) {
  if (!value?.sources?.length) return;
  const key = cacheKey(question);
  cache.delete(key);
  cache.set(key, { savedAt: now, value });
  while (cache.size > MAX_ENTRIES) cache.delete(cache.keys().next().value);
}

export const regulationCacheTtlMs = CACHE_TTL_MS;
