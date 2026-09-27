import { WATER_TYPES } from '../waterHelpers';

export default function WaterRecordsSection({ records, totals, month, typeFilter, loading, onMonthChange, onTypeFilterChange, onRefresh, onEdit, onRemove }) {
  return <section className="space-y-4">
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {[['Semua', totals.all, 'bg-blue-50 text-blue-700'], ['Air Bersih', totals.clean, 'bg-cyan-50 text-cyan-700'], ['Air Limbah', totals.wastewater, 'bg-indigo-50 text-indigo-700'], ['Perlu Tindak Lanjut', totals.failed, 'bg-red-50 text-red-700']].map(([label, value, color]) => <div key={label} className={`rounded-2xl p-4 ${color}`}><p className="text-2xl font-black">{value}</p><p className="text-xs font-bold">{label}</p></div>)}
    </div>
    <div className="flex flex-col gap-2 rounded-2xl bg-white p-3 shadow-sm sm:flex-row">
      <input type="month" value={month} onChange={event => onMonthChange(event.target.value)} className="rounded-xl border border-slate-200 px-3 py-2 text-sm" />
      <select value={typeFilter} onChange={event => onTypeFilterChange(event.target.value)} className="rounded-xl border border-slate-200 px-3 py-2 text-sm"><option value="all">Semua jenis</option><option value="clean">Air Bersih</option><option value="wastewater">Air Limbah</option></select>
      <button onClick={onRefresh} className="rounded-xl bg-slate-800 px-4 py-2 text-sm font-bold text-white">Segarkan</button>
    </div>
    {loading ? <div className="py-12 text-center text-slate-400"><i className="fas fa-spinner fa-spin mr-2" />Memuat data...</div> : records.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-300 bg-white py-12 text-center text-sm text-slate-400">Belum ada hasil pemeriksaan pada periode ini.</div> : <div className="grid gap-3 lg:grid-cols-2">{records.map(record => {
      const failed = record.parameters?.some(item => item.status === 'tidak_memenuhi');
      const unassessed = record.parameters?.some(item => !['memenuhi', 'tidak_memenuhi'].includes(item.status));
      return <article key={record.id} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
        <div className="flex items-start justify-between gap-3"><div><span className={`rounded-full px-2 py-1 text-[10px] font-black ${record.water_type === 'clean' ? 'bg-cyan-100 text-cyan-700' : 'bg-indigo-100 text-indigo-700'}`}>{WATER_TYPES[record.water_type]}</span><h3 className="mt-2 font-black text-slate-800">{record.water_type === 'clean' ? record.water_clean_locations?.name : record.sample_point}</h3><p className="text-xs text-slate-400">Sampling {record.sampled_at}{record.laboratory ? ` • ${record.laboratory}` : ''}</p></div><span className={`rounded-lg px-2 py-1 text-[10px] font-bold ${failed ? 'bg-red-100 text-red-700' : unassessed ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>{failed ? 'Perlu tindak lanjut' : unassessed ? 'Belum dinilai' : 'Memenuhi'}</span></div>
        <div className="mt-3 overflow-x-auto"><table className="w-full text-left text-xs"><thead className="text-slate-400"><tr><th className="py-1">Parameter</th><th>Hasil</th><th>Baku Mutu</th></tr></thead><tbody>{record.parameters?.map((item, index) => <tr key={`${item.parameter}-${index}`} className="border-t border-slate-100"><td className="py-1.5 font-bold text-slate-700">{item.parameter}</td><td className={item.status === 'tidak_memenuhi' ? 'font-bold text-red-600' : 'text-slate-600'}>{item.result} {item.unit}</td><td className="text-slate-500">{item.standard || '-'}</td></tr>)}</tbody></table></div>
        <div className="mt-3 flex justify-end gap-2"><button onClick={() => onEdit(record)} className="rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-600">Edit</button><button onClick={() => onRemove(record)} className="rounded-lg bg-red-50 px-3 py-1.5 text-xs font-bold text-red-600">Hapus</button></div>
      </article>;
    })}</div>}
  </section>;
}
