import { useMemo, useState } from 'react';

const TEXT_LIMIT = 12;

function MiniBars({ data }) {
  const max = Math.max(...data.map(item => Number(item.value) || 0), 1);
  return <div className="mt-3 rounded-2xl bg-slate-50 p-3"><p className="mb-2 text-[11px] font-black uppercase tracking-wide text-slate-500">{data.title}</p><div className="space-y-2">{data.items.slice(0, 8).map(item => <div key={item.label} className="grid grid-cols-[minmax(72px,1fr)_2fr_auto] items-center gap-2 text-[11px]"><span className="truncate text-slate-600">{item.label}</span><span className="h-2 overflow-hidden rounded-full bg-slate-200"><span className="block h-full rounded-full bg-blue-500" style={{ width: `${Math.max(((Number(item.value) || 0) / max) * 100, 2)}%` }} /></span><span className="font-bold text-slate-700">{new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(item.value || 0)}</span></div>)}</div></div>;
}

export default function WasteChatAnswer({ message, onAsk, onReport }) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const lines = useMemo(() => String(message.text || '').split('\n'), [message.text]);
  const truncated = lines.length > TEXT_LIMIT;
  const visibleText = !expanded && truncated ? `${lines.slice(0, TEXT_LIMIT).join('\n')}\n…` : message.text;
  const copy = async () => { try { await navigator.clipboard.writeText(message.text); setCopied(true); window.setTimeout(() => setCopied(false), 1200); } catch { /* Browser dapat memblokir clipboard. */ } };
  const download = () => {
    const blobUrl = URL.createObjectURL(new Blob([message.text], { type: 'text/plain;charset=utf-8' }));
    const link = document.createElement('a'); link.href = blobUrl; link.download = `Tanya_INSAN-J_${new Date().toISOString().slice(0, 10)}.txt`; link.click(); window.setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
  };
  return <div>
    {message.assistedByAi && <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-wide text-violet-600"><i className="fas fa-wand-magic-sparkles mr-1" />Dipahami dengan bantuan AI</span>}
    {message.cards?.length > 0 && <div className="mb-3 grid grid-cols-3 gap-1.5">{message.cards.map(card => <div key={card.label} className="rounded-xl border border-slate-200 bg-slate-50 px-2 py-2"><span className="block text-[9px] font-bold uppercase text-slate-400">{card.label}</span><span className="mt-0.5 block text-xs font-black text-slate-800">{card.value}</span></div>)}</div>}
    <div className="whitespace-pre-line">{visibleText}</div>
    {truncated && <button type="button" onClick={() => setExpanded(value => !value)} className="mt-2 text-xs font-bold text-blue-600">{expanded ? 'Ringkas kembali' : `Tampilkan semua (${lines.length} baris)`}</button>}
    {message.visualization?.items?.length > 0 && <MiniBars data={message.visualization} />}
    {message.warnings?.map(item => <p key={item} className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800"><i className="fas fa-triangle-exclamation mr-1.5" />{item}</p>)}
    {message.source && <p className="mt-3 border-t border-slate-100 pt-2 text-[10px] leading-relaxed text-slate-400">{message.source}</p>}
    {message.actions?.length > 0 && <div className="mt-3 flex flex-wrap gap-1.5">{message.actions.map(action => <button key={action.label} type="button" onClick={() => onAsk(action.question)} className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700">{action.label}</button>)}</div>}
    {message.followUps?.length > 0 && <div className="mt-3 flex gap-1.5 overflow-x-auto pb-1">{message.followUps.map(action => <button key={action.label} type="button" onClick={() => onAsk(action.question)} className="shrink-0 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-bold text-slate-600">{action.label}</button>)}</div>}
    {message.reportPayload && <div className="mt-3 flex items-center gap-3 border-t border-slate-100 pt-2 text-[11px] font-bold text-slate-500"><button type="button" onClick={copy}><i className="far fa-copy mr-1" />{copied ? 'Tersalin' : 'Salin'}</button><button type="button" onClick={download}><i className="fas fa-download mr-1" />Unduh</button><button type="button" onClick={() => onReport(message)}><i className="fas fa-file-lines mr-1" />Ke Laporan</button></div>}
  </div>;
}
