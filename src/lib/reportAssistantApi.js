import { supabase } from './supabase';

export async function generateAiReport(payload, signal) {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Sesi berakhir. Silakan login kembali.');
  const response = await fetch('/api/ai/generate-report', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
    signal,
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result.success) {
    const error = new Error(result.message || 'Draft laporan gagal dibuat.');
    error.code = result.code;
    error.errors = result.errors;
    throw error;
  }
  return result;
}
