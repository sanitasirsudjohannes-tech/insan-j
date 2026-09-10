import { authenticateAiUser } from '../_lib/aiAuthentication.js';
import { consumeAiUsage } from '../_lib/aiUsageLimit.js';
import { interpretWithGemini } from '../_lib/geminiClient.js';
import { buildWasteQuestionPrompt } from '../_lib/wasteQuestionPrompt.js';

const json = (res, status, body) => res.status(status).json(body);

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
    const contextPeriod = req.body?.contextPeriod && typeof req.body.contextPeriod === 'object' ? { start: String(req.body.contextPeriod.start || ''), end: String(req.body.contextPeriod.end || '') } : null;
    const interpretation = await interpretWithGemini(buildWasteQuestionPrompt(question, contextPeriod));
    return json(res, 200, { success: true, interpretation });
  } catch (error) {
    console.warn('AI question interpretation failed', { reason: error?.message });
    return json(res, 502, { success: false, message: 'Bantuan AI sedang tidak tersedia. Silakan coba lagi.' });
  }
}
