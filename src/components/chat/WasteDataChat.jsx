import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { answerWasteQuestion } from '../../lib/wasteQuestionService';
import { QUESTION_SUGGESTIONS } from '../../lib/wasteQuestionParser';
import WasteChatAnswer from './WasteChatAnswer';

const STORAGE_KEY = 'insan_j_data_chat';
const initialMessage = { role: 'assistant', text: 'Tanyakan data limbah. Jawaban dihitung langsung dari data INSAN-J menggunakan template yang tersedia.' };

function loadMessages() {
  try { return JSON.parse(sessionStorage.getItem(STORAGE_KEY)) || [initialMessage]; } catch { return [initialMessage]; }
}

function compactMessages(messages) {
  return messages.slice(-30).map(message => {
    const compact = { ...message };
    delete compact.reportPayload;
    compact.visualization = message.visualization?.items?.length ? { ...message.visualization, items: message.visualization.items.slice(0, 8) } : null;
    return compact;
  });
}

export default function WasteDataChat({ className = '', hideHeader = false }) {
  const navigate = useNavigate();
  const [messages, setMessages] = useState(loadMessages);
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const endRef = useRef(null);
  const showSuggestions = messages.length === 1
    && messages[0]?.role === initialMessage.role
    && messages[0]?.text === initialMessage.text;
  useEffect(() => {
    try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(compactMessages(messages))); }
    catch (error) { console.warn('Riwayat chat lokal tidak dapat disimpan.', { reason: error?.name }); }
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const ask = async value => {
    const text = String(value || question).trim();
    if (!text || loading) return;
    setQuestion('');
    setMessages(current => [...current, { role: 'user', text }]);
    setLoading(true);
    try {
      const context = [...messages].reverse().find(message => message.role === 'assistant' && message.context)?.context || null;
      const answer = await answerWasteQuestion(text, { context });
      setMessages(current => [...current, { role: 'assistant', text: answer.text, period: answer.period, context: answer.context, cards: answer.cards, visualization: answer.visualization, warnings: answer.warnings, followUps: answer.followUps, source: answer.source, sourceLink: answer.sourceLink, understanding: answer.understanding, dataStatus: answer.dataStatus, reportPayload: answer.reportPayload, actions: answer.actions, clarification: answer.clarification }]);
    } catch {
      setMessages(current => [...current, { role: 'assistant', text: 'Data belum dapat diambil. Periksa koneksi dan status sinkronisasi, lalu coba kembali.', error: true }]);
    } finally { setLoading(false); }
  };

  const sendToReport = message => {
    const payload = message.reportPayload;
    if (!payload) return;
    sessionStorage.setItem('insan_j_ai_report_draft', JSON.stringify({
      form: { reportType: 'medical_waste', period: payload.period, facts: payload.facts, analytics: payload.analytics, constraints: '', actions: '', additionalNotes: `Ringkasan dari Tanya INSAN-J:\n${message.text}` },
      draft: '', chartData: payload.chartData,
    }));
    navigate('/asisten-laporan');
  };

  return (
    <section className={`flex min-h-0 flex-1 flex-col bg-white ${className}`}>
      <div className={`flex items-start justify-between gap-3 ${hideHeader ? 'mb-2 justify-end' : 'mb-4'}`}>
        {!hideHeader && <div><h2 className="font-black text-slate-800"><i className="fas fa-comments mr-2 text-blue-600" />Tanya INSAN-J</h2><p className="mt-1 text-xs text-slate-500">Jawaban dihitung dari data yang tersinkron. Percakapan tidak disimpan ke database.</p></div>}
        <button type="button" onClick={() => setMessages([initialMessage])} className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-bold text-slate-600">Bersihkan</button>
      </div>
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto rounded-2xl bg-slate-50 p-3" aria-live="polite">
        {messages.map((message, index) => <div key={`${message.role}-${index}`} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}><div className={`max-w-[92%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${message.role === 'user' ? 'whitespace-pre-line bg-blue-600 text-white' : message.error ? 'border border-red-200 bg-red-50 text-red-700' : 'border border-slate-200 bg-white text-slate-700'}`}>{message.role === 'assistant' ? <WasteChatAnswer message={message} onAsk={ask} onReport={sendToReport} onNavigate={to => navigate(to)} /> : message.text}</div></div>)}
        {loading && <div className="flex justify-start"><div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500"><i className="fas fa-spinner fa-spin mr-2" />Menghitung data…</div></div>}
        <div ref={endRef} />
      </div>
      {showSuggestions && <div className="mt-3 flex gap-2 overflow-x-auto pb-1">{QUESTION_SUGGESTIONS.map(item => <button key={item} type="button" onClick={() => ask(item)} className="shrink-0 rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700">{item}</button>)}</div>}
      <form onSubmit={event => { event.preventDefault(); ask(); }} className="mt-3 flex gap-2"><input value={question} onChange={event => setQuestion(event.target.value)} placeholder="Tanyakan data limbah…" className="min-w-0 flex-1 rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" /><button type="submit" disabled={!question.trim() || loading} className="rounded-2xl bg-blue-600 px-4 text-white disabled:opacity-50" aria-label="Kirim pertanyaan"><i className="fas fa-paper-plane" /></button></form>
    </section>
  );
}
