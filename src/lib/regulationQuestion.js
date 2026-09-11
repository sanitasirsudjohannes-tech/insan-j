import { supabase } from './supabase';

import { isHealthRegulationQuestion } from '../features/waste-chat/parsers/regulationIntent.js';

export { isHealthRegulationQuestion };

export async function searchHealthRegulations(question, signal) {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Sesi berakhir. Silakan login kembali.');
  const response = await fetch('/api/ai/search-health-regulations', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ question }), signal,
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result.success) throw new Error(result.message || 'Pencarian JDIH belum dapat dilakukan.');
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
    regulationSources: result.sources, source: `Sumber: JDIH resmi, diperiksa ${checked}.`,
  };
}
