import { supabase } from './supabase';

export async function interpretWasteQuestionWithAi(question, signal, contextPeriod = null) {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Sesi berakhir. Silakan login kembali.');

  const response = await fetch('/api/ai/interpret-waste-question', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ question, contextPeriod }),
    signal,
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result.success) throw new Error(result.message || 'AI belum dapat memahami pertanyaan.');
  return result.interpretation;
}
