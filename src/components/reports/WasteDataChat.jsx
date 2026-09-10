import { useEffect, useRef, useState } from 'react';
import { answerWasteQuestion } from '../../lib/wasteQuestionService';
import { QUESTION_SUGGESTIONS } from '../../lib/wasteQuestionParser';

const STORAGE_KEY = 'insan_j_data_chat';
const initialMessage = { role: 'assistant', text: 'Silakan tanyakan data limbah, misalnya “Sisa limbah bulan Juli 2026 berapa?” Angka jawaban dihitung langsung dari data INSAN-J.' };

function loadMessages() {
  try { return JSON.parse(sessionStorage.getItem(STORAGE_KEY)) || [initialMessage]; } catch { return [initialMessage]; }
}

export default function WasteDataChat() {
  const [messages, setMessages] = useState(loadMessages);
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const endRef = useRef(null);
  useEffect(() => { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-30))); endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const ask = async value => {
    const text = String(value || question).trim();
    if (!text || loading) return;
    setQuestion('');
    setMessages(current => [...current, { role: 'user', text }]);
    setLoading(true);
    try {
      const answer = await answerWasteQuestion(text);
      setMessages(current => [...current, { role: 'assistant', text: answer.text }]);
    } catch {
      setMessages(current => [...current, { role: 'assistant', text: 'Data belum dapat diambil. Periksa koneksi dan status sinkronisasi, lalu coba kembali.', error: true }]);
    } finally { setLoading(false); }
  };

  return (
    <section className="rounded-3xl border border-blue-200 bg-white p-4 shadow-sm sm:p-6">
      <div className="mb-4 flex items-start justify-between gap-3"><div><h2 className="font-black text-slate-800"><i className="fas fa-comments mr-2 text-blue-600" />Tanya Data INSAN-J</h2><p className="mt-1 text-xs text-slate-500">Jawaban dihitung dari data yang tersinkron. Percakapan tidak disimpan ke database.</p></div><button type="button" onClick={() => setMessages([initialMessage])} className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-bold text-slate-600">Bersihkan</button></div>
      <div className="max-h-96 space-y-3 overflow-y-auto rounded-2xl bg-slate-50 p-3" aria-live="polite">
        {messages.map((message, index) => <div key={`${message.role}-${index}`} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}><div className={`max-w-[88%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${message.role === 'user' ? 'bg-blue-600 text-white' : message.error ? 'border border-red-200 bg-red-50 text-red-700' : 'border border-slate-200 bg-white text-slate-700'}`}>{message.text}</div></div>)}
        {loading && <div className="flex justify-start"><div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500"><i className="fas fa-spinner fa-spin mr-2" />Menghitung dari data…</div></div>}
        <div ref={endRef} />
      </div>
      <div className="mt-3 flex gap-2 overflow-x-auto pb-1">{QUESTION_SUGGESTIONS.map(item => <button key={item} type="button" onClick={() => ask(item)} className="shrink-0 rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700">{item}</button>)}</div>
      <form onSubmit={event => { event.preventDefault(); ask(); }} className="mt-3 flex gap-2"><input value={question} onChange={event => setQuestion(event.target.value)} placeholder="Tanyakan data limbah…" className="min-w-0 flex-1 rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" /><button type="submit" disabled={!question.trim() || loading} className="rounded-2xl bg-blue-600 px-4 text-white disabled:opacity-50" aria-label="Kirim pertanyaan"><i className="fas fa-paper-plane" /></button></form>
    </section>
  );
}
