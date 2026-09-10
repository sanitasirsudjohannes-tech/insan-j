import { createClient } from '@supabase/supabase-js';
import { configuredGeminiModel, selectGeminiModels } from '../_lib/geminiModels.js';

const ALLOWED_ROLES = new Set(['admin', 'petugas', 'user']);
const usageByUser = new Map();
const json = (res, status, body) => res.status(status).json(body);
const witaNow = () => {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en', { timeZone: 'Asia/Makassar', year: 'numeric', month: '2-digit' }).formatToParts(new Date()).map(part => [part.type, part.value]));
  return { year: Number(parts.year), month: Number(parts.month) };
};
const witaDateKey = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Makassar' }).format(new Date());

async function authenticate(req) {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');
  if (!token) return { error: 'AUTH_REQUIRED' };
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) return { error: 'SERVER_CONFIG_ERROR' };
  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return { error: 'AUTH_REQUIRED' };
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', data.user.id).maybeSingle();
  const role = String(profile?.role || data.user.user_metadata?.role || '').trim().toLowerCase();
  if (!ALLOWED_ROLES.has(role)) return { error: 'FORBIDDEN_ROLE' };
  return { user: data.user };
}

async function fetchWithTimeout(url, options) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.min(Math.max(Number(process.env.AI_TIMEOUT_MS) || 15000, 3000), 25000));
  try { return await fetch(url, { ...options, signal: controller.signal }); }
  finally { clearTimeout(timer); }
}

async function requestGemini(apiKey, model, prompt) {
  const response = await fetchWithTimeout(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0, maxOutputTokens: 200, responseMimeType: 'application/json' },
    }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data?.error?.message || 'Gemini menolak permintaan.');
    error.status = response.status;
    throw error;
  }
  const text = data.candidates?.[0]?.content?.parts?.map(part => part.text || '').join('').trim();
  if (!text) throw new Error('Respons Gemini kosong.');
  return JSON.parse(text.replace(/^```json\s*|\s*```$/g, ''));
}

async function listGeminiModels(apiKey) {
  const response = await fetchWithTimeout(`https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000&key=${encodeURIComponent(apiKey)}`, {
    headers: { Accept: 'application/json' },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data?.error?.message || 'Daftar model Gemini tidak dapat dibaca.');
    error.status = response.status;
    throw error;
  }
  return data.models || [];
}

async function callGemini(question, contextPeriod) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('Gemini belum dikonfigurasi.');
  const configuredModel = configuredGeminiModel(process.env.GEMINI_MODEL);
  const now = witaNow();
  const prompt = `Tanggal acuan WITA: tahun ${now.year}, bulan ${now.month}. Pahami pertanyaan pengguna tentang data limbah medis INSAN-J, termasuk bahasa sehari-hari, singkatan, dan salah ketik ringan. Kembalikan JSON saja dengan properti: intent, year, month, day, startDate, endDate, typeKey, typeKeys, roomName, inferredYear. intent hanya boleh waste_summary, remaining, opening_balance, available_total, generated, transported, transport_coverage, average, dominant_type, type_breakdown, top_rooms, bottom_room, room_total, room_type_total, peak_day, active_days, comparison, type_total, atau unknown. Gunakan waste_summary untuk permintaan umum seperti rincian limbah, data limbah, ringkasan, rekap, atau gambaran keseluruhan. Gunakan room_total untuk jumlah seluruh jenis dari satu ruangan dan room_type_total untuk satu jenis limbah dari satu ruangan; salin nama ruang ke roomName tanpa mengarang nama. Untuk rentang tanggal isi startDate dan endDate dalam YYYY-MM-DD. Untuk satu tanggal isi year, month, day. Untuk bulan isi year dan month dengan day null. Untuk satu tahun isi year dengan month dan day null. typeKey hanya infectiousKg, sharpsKg, bottleKg, cytotoxicKg, atau null; typeKeys boleh memuat beberapa jenis untuk type_breakdown. Jika pengguna merujuk “tanggal tersebut” atau “periode itu”, gunakan konteks periode sebelumnya berikut: ${JSON.stringify(contextPeriod)}. Jika periode tidak disebutkan, gunakan bulan dan tahun acuan serta inferredYear true. Jangan menjawab angka dan jangan menambah fakta. Pertanyaan: ${JSON.stringify(question)}`;

  try {
    return await requestGemini(apiKey, configuredModel, prompt);
  } catch (error) {
    if (error.status !== 404) throw error;
  }

  const candidates = selectGeminiModels(await listGeminiModels(apiKey), configuredModel)
    .filter(model => model !== configuredModel);
  if (!candidates.length) throw Object.assign(new Error('Tidak ada model Gemini yang mendukung generateContent.'), { status: 404 });

  let lastError;
  for (const model of candidates) {
    try {
      const interpretation = await requestGemini(apiKey, model, prompt);
      console.info('Gemini model selected automatically', { model });
      return interpretation;
    } catch (error) {
      lastError = error;
      if (error.status !== 404) throw error;
    }
  }
  throw lastError;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { success: false, message: 'Metode tidak diizinkan.' });
  try {
    const auth = await authenticate(req);
    if (auth.error === 'AUTH_REQUIRED') return json(res, 401, { success: false, message: 'Sesi berakhir. Silakan login kembali.' });
    if (auth.error === 'FORBIDDEN_ROLE') return json(res, 403, { success: false, message: 'Peran Anda tidak memiliki akses ke fitur ini.' });
    if (auth.error) return json(res, 500, { success: false, message: 'Konfigurasi server belum lengkap.' });

    const question = String(req.body?.question || '').trim();
    if (!question || question.length > 500) return json(res, 400, { success: false, message: 'Pertanyaan tidak valid atau terlalu panjang.' });
    const usageKey = `${auth.user.id}:${witaDateKey()}`;
    const count = usageByUser.get(usageKey) || 0;
    const limit = Math.max(Number(process.env.AI_DAILY_LIMIT) || 5, 1);
    if (count >= limit) return json(res, 429, { success: false, message: 'Batas bantuan AI hari ini telah tercapai.' });
    usageByUser.set(usageKey, count + 1);

    const contextPeriod = req.body?.contextPeriod && typeof req.body.contextPeriod === 'object'
      ? { start: String(req.body.contextPeriod.start || ''), end: String(req.body.contextPeriod.end || '') }
      : null;
    const interpretation = await callGemini(question, contextPeriod);
    return json(res, 200, { success: true, interpretation });
  } catch (error) {
    console.warn('AI question interpretation failed', { reason: error?.message });
    return json(res, 502, { success: false, message: 'Bantuan AI sedang tidak tersedia. Silakan coba lagi.' });
  }
}
