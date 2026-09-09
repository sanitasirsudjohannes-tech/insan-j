import { createClient } from '@supabase/supabase-js';
import {
  buildLocalReport,
  detectSensitiveData,
  reportFactsToText,
  preservesNumericFacts,
  serializePayload,
  validateReportPayload,
} from '../../src/lib/reportAssistant.js';

const usageByUser = new Map();
const breaker = new Map();
const FALLBACK_STATUSES = new Set([429, 500, 502, 503, 504]);
const ALLOWED_ROLES = new Set(['admin', 'petugas', 'user']);

const json = (res, status, body) => res.status(status).json(body);
const witaDateKey = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Makassar' }).format(new Date());

function requestId() {
  return globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function getUsage(userId) {
  const key = `${userId}:${witaDateKey()}`;
  return { key, count: usageByUser.get(key) || 0 };
}

function providerAvailable(provider) {
  const state = breaker.get(provider);
  return !state || state.blockedUntil < Date.now();
}

function recordProviderResult(provider, success, status) {
  if (success) {
    breaker.delete(provider);
    return;
  }
  if (!FALLBACK_STATUSES.has(status)) return;
  const current = breaker.get(provider) || { failures: 0, blockedUntil: 0 };
  const failures = current.failures + 1;
  breaker.set(provider, { failures, blockedUntil: failures >= 3 ? Date.now() + 5 * 60_000 : 0 });
}

async function fetchWithTimeout(url, options) {
  const timeoutMs = Math.min(Math.max(Number(process.env.AI_TIMEOUT_MS) || 20000, 3000), 25000);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

function providerError(provider, status, message = 'Layanan AI tidak tersedia.') {
  const error = new Error(message);
  error.provider = provider;
  error.status = status;
  error.canFallback = FALLBACK_STATUSES.has(status) || status === 408 || status === 0;
  return error;
}

const systemInstruction = `Anda membantu petugas Unit Sanitasi menyunting draf laporan rumah sakit. Gunakan Bahasa Indonesia baku yang tetap alami, mengalir, dan terasa ditulis oleh petugas yang memahami kegiatan di lapangan. Hindari kalimat kaku, berulang, berlebihan, serta ungkapan yang menyebut bahwa teks dibuat oleh mesin atau dianalisis otomatis. Gunakan hanya fakta yang diberikan. Jangan mengarang angka, kegiatan, regulasi, hasil pemeriksaan, penyebab, atau tindakan. Tandai informasi yang belum tersedia dengan [PERLU DILENGKAPI]. Pertahankan seluruh angka sama persis dengan input. Jangan menambahkan nama pejabat atau tanda tangan. Pertahankan susunan BAB I Pendahuluan, BAB II Hasil dan Pembahasan, serta BAB III Penutup. Hasil tetap berupa draf yang harus diperiksa petugas.`;

async function callGemini(prompt) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw providerError('gemini', 503, 'Gemini belum dikonfigurasi.');
  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash-lite';
  const response = await fetchWithTimeout(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemInstruction }] },
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.2, maxOutputTokens: 3500 },
    }),
  });
  if (!response.ok) throw providerError('gemini', response.status);
  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.map(part => part.text || '').join('').trim();
  if (!text) throw providerError('gemini', 502, 'Respons Gemini kosong.');
  return text;
}

async function callGroq(prompt) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw providerError('groq', 503, 'GroqCloud belum dikonfigurasi.');
  const model = process.env.GROQ_MODEL || 'llama-3.1-8b-instant';
  const response = await fetchWithTimeout('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      max_tokens: 3500,
      messages: [{ role: 'system', content: systemInstruction }, { role: 'user', content: prompt }],
    }),
  });
  if (!response.ok) throw providerError('groq', response.status);
  const data = await response.json();
  const text = data.choices?.[0]?.message?.content?.trim();
  if (!text) throw providerError('groq', 502, 'Respons GroqCloud kosong.');
  return text;
}

async function authenticate(req) {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');
  if (!token) return { error: 'AUTH_REQUIRED' };
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) return { error: 'SERVER_CONFIG_ERROR' };
  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: authData, error } = await supabase.auth.getUser(token);
  if (error || !authData.user) return { error: 'AUTH_REQUIRED' };
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', authData.user.id).maybeSingle();
  const role = String(profile?.role || authData.user.user_metadata?.role || '').trim().toLowerCase();
  if (!ALLOWED_ROLES.has(role)) return { error: 'FORBIDDEN_ROLE' };
  return { user: authData.user, role };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { success: false, code: 'METHOD_NOT_ALLOWED' });
  const id = requestId();
  try {
    const auth = await authenticate(req);
    if (auth.error === 'AUTH_REQUIRED') return json(res, 401, { success: false, code: auth.error, message: 'Sesi berakhir. Silakan login kembali.', requestId: id });
    if (auth.error === 'FORBIDDEN_ROLE') return json(res, 403, { success: false, code: auth.error, message: 'Peran Anda tidak memiliki akses ke fitur ini.', requestId: id });
    if (auth.error) return json(res, 500, { success: false, code: auth.error, message: 'Konfigurasi server belum lengkap.', requestId: id });

    if (serializePayload(req.body).length >= 12000) return json(res, 400, { success: false, code: 'INVALID_INPUT', message: 'Isian terlalu panjang.', requestId: id });
    const validationErrors = validateReportPayload(req.body);
    if (Object.keys(validationErrors).length) return json(res, 400, { success: false, code: 'INVALID_INPUT', errors: validationErrors, message: 'Periksa kembali isian laporan.', requestId: id });
    if (detectSensitiveData(req.body)) return json(res, 400, { success: false, code: 'SENSITIVE_DATA_DETECTED', message: 'Hapus data pasien, NIK, nomor rekam medis, diagnosis, atau nomor telepon.', requestId: id });

    const localDraft = String(req.body.sourceDraft || '').trim() || buildLocalReport(req.body);
    const usage = getUsage(auth.user.id);
    const dailyLimit = Math.max(Number(process.env.AI_DAILY_LIMIT) || 5, 1);
    if (usage.count >= dailyLimit) {
      return json(res, 200, { success: true, provider: 'local-template', fallbackUsed: true, isTemplateOnly: true, draft: localDraft, warning: 'Batas penggunaan AI hari ini tercapai. Draft dibuat menggunakan template lokal.', requestId: id });
    }

    usageByUser.set(usage.key, usage.count + 1);
    const prompt = `Susun ulang template berikut menjadi laporan formal tanpa mengubah fakta dan angka.\n\nFAKTA TERSTRUKTUR:\n${reportFactsToText(req.body)}\n\nTEMPLATE DASAR:\n${localDraft}`;
    const configured = String(process.env.AI_PRIMARY_PROVIDER || 'gemini').toLowerCase();
    const providers = configured === 'groq' ? ['groq', 'gemini'] : ['gemini', 'groq'];
    let fallbackUsed = false;

    for (const provider of providers) {
      if (!providerAvailable(provider)) {
        fallbackUsed = true;
        continue;
      }
      try {
        const draft = provider === 'gemini' ? await callGemini(prompt) : await callGroq(prompt);
        if (!preservesNumericFacts(draft, req.body.facts)) {
          throw providerError(provider, 502, 'Respons AI mengubah atau menghilangkan angka sumber.');
        }
        recordProviderResult(provider, true, 200);
        return json(res, 200, { success: true, provider, fallbackUsed, isTemplateOnly: false, draft, warning: 'Periksa kembali seluruh angka dan isi sebelum digunakan.', requestId: id });
      } catch (error) {
        const status = error.name === 'AbortError' ? 408 : (error.status || 0);
        recordProviderResult(provider, false, status);
        if (!error.canFallback && status !== 408 && status !== 0) {
          return json(res, 502, { success: false, code: 'PROVIDER_REJECTED', message: 'Permintaan ditolak layanan AI. Periksa konfigurasi atau isi laporan.', requestId: id });
        }
        fallbackUsed = true;
      }
    }

    return json(res, 200, { success: true, provider: 'local-template', fallbackUsed: true, isTemplateOnly: true, draft: localDraft, warning: 'Layanan AI tidak tersedia. Draft dibuat menggunakan template lokal.', requestId: id });
  } catch (error) {
    console.error('AI report request failed', { requestId: id, name: error?.name });
    return json(res, 500, { success: false, code: 'INTERNAL_ERROR', message: 'Terjadi kendala saat membuat laporan.', requestId: id });
  }
}
