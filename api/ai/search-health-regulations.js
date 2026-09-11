import { authenticateAiUser } from '../_lib/aiAuthentication.js';
import { consumeAiUsage } from '../_lib/aiUsageLimit.js';
import { searchRegulationsWithGemini } from '../_lib/geminiClient.js';
import { allowedRegulationSources, buildRegulationSearchPrompt } from '../_lib/regulationPrompt.js';

const json = (res, status, body) => res.status(status).json(body);

function validOfficialUrl(value) {
  try {
    const url = new URL(String(value || ''));
    return url.protocol === 'https:' && allowedRegulationSources().some(host => url.hostname === host || url.hostname.endsWith(`.${host}`));
  } catch { return false; }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { success: false, message: 'Metode tidak diizinkan.' });
  try {
    const auth = await authenticateAiUser(req);
    if (auth.error === 'AUTH_REQUIRED') return json(res, 401, { success: false, message: 'Sesi berakhir. Silakan login kembali.' });
    if (auth.error === 'FORBIDDEN_ROLE') return json(res, 403, { success: false, message: 'Peran Anda tidak memiliki akses ke fitur ini.' });
    if (auth.error) return json(res, 500, { success: false, message: 'Konfigurasi server belum lengkap.' });
    const question = String(req.body?.question || '').trim();
    if (!question || question.length > 500) return json(res, 400, { success: false, message: 'Pertanyaan tidak valid atau terlalu panjang.' });
    if (!consumeAiUsage(auth.user.id)) return json(res, 429, { success: false, message: 'Batas bantuan AI hari ini telah tercapai.' });

    const result = await searchRegulationsWithGemini(buildRegulationSearchPrompt(question));
    const sources = (Array.isArray(result?.results) ? result.results : []).filter(item => validOfficialUrl(item?.sourceUrl)).slice(0, 5).map(item => ({
      title: String(item.title || 'Peraturan terkait'), issuer: String(item.issuer || ''),
      status: String(item.status || 'Perlu diperiksa'), relevance: String(item.relevance || ''), url: String(item.sourceUrl),
    }));
    return json(res, 200, { success: true, inScope: result?.inScope !== false, summary: String(result?.summary || ''), sources, checkedAt: new Date().toISOString() });
  } catch (error) {
    console.warn('Regulation search failed', { reason: error?.message });
    return json(res, 502, { success: false, message: 'Pencarian JDIH sedang tidak tersedia. Silakan coba kembali.' });
  }
}
