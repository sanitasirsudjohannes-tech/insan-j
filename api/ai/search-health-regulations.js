import { randomUUID } from 'node:crypto';
import { authenticateAiUser } from '../_lib/aiAuthentication.js';
import { consumeAiUsage } from '../_lib/aiUsageLimit.js';
import { searchRegulationsWithGemini } from '../_lib/geminiClient.js';
import { allowedRegulationSources, buildRegulationSearchPrompt } from '../_lib/regulationPrompt.js';
import { findVerifiedRegulations } from '../_lib/verifiedRegulations.js';

const json = (res, status, body) => res.status(status).json(body);
const elapsed = startedAt => Date.now() - startedAt;

function writeDiagnostic(event, fields) {
  console.info('regulation_search_diagnostic', JSON.stringify({ event, ...fields }));
}

function classifyError(error) {
  if (error?.name === 'AbortError') return 'provider_timeout';
  if (error?.status === 429) return 'provider_quota';
  if (Number(error?.status) >= 500) return 'provider_server_error';
  if (Number(error?.status) >= 400) return 'provider_request_error';
  if (/format|json/i.test(String(error?.message || ''))) return 'invalid_provider_response';
  if (/kosong/i.test(String(error?.message || ''))) return 'empty_provider_response';
  return 'unknown_provider_error';
}

function validOfficialUrl(value) {
  try {
    const url = new URL(String(value || ''));
    return url.protocol === 'https:' && allowedRegulationSources().some(host => url.hostname === host || url.hostname.endsWith(`.${host}`));
  } catch { return false; }
}

export default async function handler(req, res) {
  const requestId = randomUUID();
  const startedAt = Date.now();
  res.setHeader('X-Diagnostic-Id', requestId);

  if (req.method !== 'POST') {
    writeDiagnostic('rejected', { requestId, stage: 'method', code: 'method_not_allowed', durationMs: elapsed(startedAt) });
    return json(res, 405, { success: false, message: 'Metode tidak diizinkan.', diagnosticId: requestId });
  }

  try {
    const auth = await authenticateAiUser(req);
    if (auth.error) {
      const status = auth.error === 'AUTH_REQUIRED' ? 401 : auth.error === 'FORBIDDEN_ROLE' ? 403 : 500;
      writeDiagnostic('rejected', { requestId, stage: 'authentication', code: String(auth.error).toLocaleLowerCase('en-US'), status, durationMs: elapsed(startedAt) });
      const message = status === 401 ? 'Sesi berakhir. Silakan login kembali.' : status === 403 ? 'Peran Anda tidak memiliki akses ke fitur ini.' : 'Konfigurasi server belum lengkap.';
      return json(res, status, { success: false, message, diagnosticId: requestId });
    }

    const question = String(req.body?.question || '').trim();
    if (!question || question.length > 500) {
      writeDiagnostic('rejected', { requestId, stage: 'validation', code: 'invalid_question', questionLength: question.length, durationMs: elapsed(startedAt) });
      return json(res, 400, { success: false, message: 'Pertanyaan tidak valid atau terlalu panjang.', diagnosticId: requestId });
    }

    if (!consumeAiUsage(auth.user.id)) {
      const sources = findVerifiedRegulations(question);
      writeDiagnostic('fallback', { requestId, stage: 'application_quota', code: 'daily_limit', catalogSourceCount: sources.length, durationMs: elapsed(startedAt) });
      if (sources.length) return json(res, 200, { success: true, inScope: true, summary: 'Kuota pencarian AI hari ini telah tercapai. Berikut peraturan dari katalog JDIH terverifikasi INSAN-J.', sources, checkedAt: new Date().toISOString(), fallback: true });
      return json(res, 429, { success: false, message: 'Batas bantuan AI hari ini telah tercapai.', diagnosticId: requestId });
    }

    writeDiagnostic('started', { requestId, stage: 'provider_search', provider: 'gemini', durationMs: elapsed(startedAt) });
    const result = await searchRegulationsWithGemini(buildRegulationSearchPrompt(question));
    const receivedCount = Array.isArray(result?.results) ? result.results.length : 0;
    const searchedSources = (Array.isArray(result?.results) ? result.results : []).filter(item => validOfficialUrl(item?.sourceUrl)).slice(0, 5).map(item => ({
      title: String(item.title || 'Peraturan terkait'), issuer: String(item.issuer || ''),
      status: String(item.status || 'Perlu diperiksa'), relevance: String(item.relevance || ''), url: String(item.sourceUrl),
    }));
    const catalogSources = findVerifiedRegulations(question);
    const sources = [...searchedSources, ...catalogSources].filter((item, index, items) => items.findIndex(candidate => candidate.url === item.url) === index).slice(0, 5);
    writeDiagnostic('completed', {
      requestId, stage: 'response_validation', provider: 'gemini', providerResultCount: receivedCount,
      acceptedProviderSourceCount: searchedSources.length, rejectedProviderSourceCount: Math.max(receivedCount - searchedSources.length, 0),
      catalogSourceCount: catalogSources.length, returnedSourceCount: sources.length, durationMs: elapsed(startedAt),
    });
    return json(res, 200, { success: true, inScope: result?.inScope !== false, summary: String(result?.summary || ''), sources, checkedAt: new Date().toISOString() });
  } catch (error) {
    const code = classifyError(error);
    const sources = findVerifiedRegulations(req.body?.question);
    writeDiagnostic('failed', {
      requestId, stage: 'provider_search', provider: 'gemini', code,
      providerStatus: Number(error?.status) || null, fallbackUsed: sources.length > 0,
      catalogSourceCount: sources.length, durationMs: elapsed(startedAt),
    });
    if (sources.length) return json(res, 200, { success: true, inScope: true, summary: 'Berikut peraturan yang sesuai dari katalog JDIH terverifikasi INSAN-J.', sources, checkedAt: new Date().toISOString(), fallback: true });
    if (error?.status === 429) return json(res, 429, { success: false, message: 'Kuota Gemini untuk pencarian hari ini telah tercapai. Silakan coba kembali setelah kuota tersedia.', diagnosticId: requestId });
    if (error?.name === 'AbortError') return json(res, 504, { success: false, message: 'Pencarian JDIH membutuhkan waktu terlalu lama. Silakan coba kembali.', diagnosticId: requestId });
    return json(res, 502, { success: false, message: 'Pencarian JDIH sedang tidak tersedia. Silakan coba kembali.', diagnosticId: requestId });
  }
}
