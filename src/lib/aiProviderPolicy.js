const RETRYABLE_STATUSES = new Set([0, 408, 429, 500, 502, 503, 504]);
const FALLBACK_STATUSES = new Set([400, 401, 403, 404, ...RETRYABLE_STATUSES]);

export const canFallbackFromProvider = status => FALLBACK_STATUSES.has(Number(status));
export const shouldCountProviderFailure = status => RETRYABLE_STATUSES.has(Number(status));

export function describeProviderFailure(provider, status) {
  const label = provider === 'gemini' ? 'Gemini' : 'GroqCloud';
  const code = Number(status) || 0;
  if (code === 400) return `${label} menolak format permintaan (400)`;
  if (code === 401) return `API key ${label} tidak valid (401)`;
  if (code === 403) return `API key ${label} tidak memiliki izin akses (403)`;
  if (code === 404) return `Model ${label} tidak tersedia (404)`;
  if (code === 429) return `Kuota ${label} sedang habis (429)`;
  if (code === 408 || code === 0) return `${label} tidak merespons tepat waktu`;
  if (code >= 500) return `Layanan ${label} sedang mengalami gangguan (${code})`;
  return `${label} tidak tersedia${code ? ` (${code})` : ''}`;
}

export function fallbackWarning(failures, selectedProvider) {
  const reason = failures?.[0]?.message;
  if (selectedProvider === 'groq') return `${reason || 'Gemini tidak tersedia'}; laporan dialihkan ke GroqCloud. Periksa kembali seluruh isi.`;
  if (selectedProvider === 'gemini') return `${reason || 'GroqCloud tidak tersedia'}; laporan dialihkan ke Gemini. Periksa kembali seluruh isi.`;
  return `${reason || 'Layanan AI tidak tersedia'}. Draft template lokal tetap dapat digunakan.`;
}
