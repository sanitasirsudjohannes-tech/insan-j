import { supabase } from './supabase';
import { isHealthRegulationQuestion } from '../features/waste-chat/parsers/regulationIntent.js';

export { isHealthRegulationQuestion };

const CACHE_KEY = 'insan_j_regulation_cache_v1';
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const normalizeQuestion = value => String(value || '').toLocaleLowerCase('id-ID').replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
const questionHash = question => {
  let hash = 5381;
  for (const character of normalizeQuestion(question)) hash = ((hash << 5) + hash) ^ character.charCodeAt(0);
  return (hash >>> 0).toString(16);
};

function readClientCache(question) {
  if (typeof localStorage === 'undefined') return null;
  try {
    const now = Date.now();
    const entries = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
    const entry = entries[questionHash(question)];
    if (!entry || now - entry.savedAt >= CACHE_TTL_MS) return null;
    return { ...entry.value, cached: true };
  } catch { return null; }
}

function writeClientCache(question, value) {
  if (typeof localStorage === 'undefined' || value?.fallback || !value?.sources?.length) return;
  try {
    const now = Date.now();
    const entries = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
    const activeEntries = Object.fromEntries(Object.entries(entries)
      .filter(([, entry]) => now - Number(entry?.savedAt || 0) < CACHE_TTL_MS)
      .sort((left, right) => Number(right[1]?.savedAt || 0) - Number(left[1]?.savedAt || 0))
      .slice(0, 19));
    activeEntries[questionHash(question)] = { savedAt: now, value };
    localStorage.setItem(CACHE_KEY, JSON.stringify(activeEntries));
  } catch { /* Cache browser boleh gagal tanpa menggagalkan pencarian. */ }
}

function buildRegulationAnswer(result) {
  if (!result.inScope) return { text: 'Tanya INSAN-J hanya membantu regulasi tentang limbah rumah sakit dan kesehatan lingkungan.', assistedByAi: true, understanding: { status: 'understood', intent: 'Di luar ruang lingkup regulasi', period: null } };
  if (!result.sources?.length) return {
    text: 'Saya belum menemukan peraturan yang sesuai pada sumber JDIH resmi yang diperiksa. Saya tidak akan menyimpulkan ketentuan tanpa sumber yang dapat diverifikasi.',
    assistedByAi: true, understanding: { status: 'understood', intent: 'Pencarian regulasi JDIH', period: null },
  };
  const details = result.sources.map((item, index) => {
    const metadata = [item.issuer, `Status: ${item.status}`].filter(Boolean).join(' • ');
    return `${index + 1}. ${item.title}\n${metadata}${item.relevance ? `\n${item.relevance}` : ''}`;
  }).join('\n\n');
  const checked = new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeZone: 'Asia/Makassar' }).format(new Date(result.checkedAt));
  return {
    text: `${result.summary || 'Ditemukan peraturan yang relevan pada sumber JDIH resmi.'}\n\n${details}\n\nRingkasan AI bukan pengganti dokumen resmi. Periksa sumber sebelum digunakan sebagai dasar hukum.`,
    assistedByAi: true, understanding: { status: 'understood', intent: 'Regulasi kesehatan lingkungan', period: null },
    regulationSources: result.sources,
    source: `Sumber: JDIH resmi, diperiksa ${checked}.${result.cached ? ' Menggunakan hasil tersimpan maksimal 7 hari.' : ''}`,
  };
}

export async function searchHealthRegulations(question, signal) {
  const cached = readClientCache(question);
  if (cached) return buildRegulationAnswer(cached);

  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Sesi berakhir. Silakan login kembali.');
  const response = await fetch('/api/ai/search-health-regulations', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ question }), signal,
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result.success) throw new Error(result.message || 'Pencarian JDIH belum dapat dilakukan.');
  writeClientCache(question, result);
  return buildRegulationAnswer(result);
}
