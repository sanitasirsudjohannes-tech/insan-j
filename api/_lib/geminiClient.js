import { configuredGeminiModel, selectGeminiModels } from './geminiModels.js';

async function fetchWithTimeout(url, options = {}, requestedTimeoutMs = null) {
  const controller = new AbortController();
  const configuredTimeout = (requestedTimeoutMs ?? Number(process.env.AI_TIMEOUT_MS)) || 15000;
  const timer = setTimeout(() => controller.abort(), Math.min(Math.max(configuredTimeout, 3000), 30000));
  try { return await fetch(url, { ...options, signal: controller.signal }); }
  finally { clearTimeout(timer); }
}

async function requestGemini(apiKey, model, prompt) {
  const response = await fetchWithTimeout(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: { temperature: 0, maxOutputTokens: 200, responseMimeType: 'application/json' } }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(data?.error?.message || 'Gemini menolak permintaan.'), { status: response.status });
  const text = data.candidates?.[0]?.content?.parts?.map(part => part.text || '').join('').trim();
  if (!text) throw new Error('Respons Gemini kosong.');
  return JSON.parse(text.replace(/^```json\s*|\s*```$/g, ''));
}

async function listGeminiModels(apiKey) {
  const response = await fetchWithTimeout(`https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000&key=${encodeURIComponent(apiKey)}`, { headers: { Accept: 'application/json' } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(data?.error?.message || 'Daftar model Gemini tidak dapat dibaca.'), { status: response.status });
  return data.models || [];
}

export async function interpretWithGemini(prompt) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('Gemini belum dikonfigurasi.');
  const configuredModel = configuredGeminiModel(process.env.GEMINI_MODEL);
  try { return await requestGemini(apiKey, configuredModel, prompt); }
  catch (error) { if (error.status !== 404) throw error; }
  const candidates = selectGeminiModels(await listGeminiModels(apiKey), configuredModel).filter(model => model !== configuredModel);
  if (!candidates.length) throw Object.assign(new Error('Tidak ada model Gemini yang mendukung generateContent.'), { status: 404 });
  let lastError;
  for (const model of candidates) {
    try { const interpretation = await requestGemini(apiKey, model, prompt); console.info('Gemini model selected automatically', { model }); return interpretation; }
    catch (error) { lastError = error; if (error.status !== 404) throw error; }
  }
  throw lastError;
}


export async function searchRegulationsWithGemini(prompt) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('Gemini belum dikonfigurasi.');
  const model = configuredGeminiModel(process.env.GEMINI_MODEL);
  const response = await fetchWithTimeout(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      tools: [{ google_search: {} }],
      generationConfig: { temperature: 0, maxOutputTokens: 900, responseMimeType: 'application/json' },
    }),
  }, 28000);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(data?.error?.message || 'Pencarian regulasi ditolak Gemini.'), { status: response.status });
  const text = data.candidates?.[0]?.content?.parts?.map(part => part.text || '').join('').trim();
  if (!text) throw new Error('Hasil pencarian regulasi kosong.');
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('Format hasil pencarian regulasi tidak valid.');
  return JSON.parse(match[0]);
}
