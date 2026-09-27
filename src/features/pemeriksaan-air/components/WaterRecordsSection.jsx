import { WATER_TYPES } from '../waterHelpers';

const formatMonth = value => {
  const [year, month] = value.split('-').map(Number);
  return new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric', timeZone: 'Asia/Makassar' })
    .format(new Date(Date.UTC(year, month - 1, 1)));
};

const formatDate = value => {
  const [year, month, day] = value.split('-').map(Number);
  return new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Makassar' })
    .format(new Date(Date.UTC(year, month - 1, day)));
};

const BackButton = ({ onClick, children }) => <button type="button" onClick={onClick} className="inline-flex items-center gap-2 rounded-xl bg-slate-100 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200"><i className="fas fa-arrow-left" />{children}</button>;

function RecordRow({ record, onEdit, onRemove }) {
  const failed = record.parameters?.some(item => item.status === 'tidak_memenuhi');
  const unassessed = record.parameters?.some(item => !['memenuhi', 'tidak_memenuhi'].includes(item.status));
  return <tr className="border-b border-slate-100 align-top last:border-0 hover:bg-slate-50/70">
    <td className="w-[30%] break-words px-2 py-3 sm:px-4 sm:py-4"><span className="block text-xs font-bold text-slate-800 sm:text-sm">{record.water_type === 'clean' ? record.water_clean_locations?.name : record.sample_point}</span><span className="mt-1 block text-[10px] font-semibold text-slate-500 sm:text-xs">{record.laboratory || '-'}</span><span className="block break-all text-[10px] text-slate-400 sm:text-xs">{record.report_number || 'No. laporan belum dicatat'}</span><span className={`mt-2 inline-flex rounded-md px-1.5 py-0.5 text-[9px] font-bold sm:text-[10px] ${failed ? 'bg-red-100 text-red-700' : unassessed ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>{failed ? 'Perlu tindak lanjut' : unassessed ? 'Belum dinilai' : 'Memenuhi'}</span></td>
    <td className="w-[55%] break-words px-2 py-3 sm:px-4 sm:py-4"><div className="space-y-2">{record.parameters?.map((item, index) => <div key={`${item.parameter}-${index}`} className="text-[10px] leading-snug sm:text-xs"><span className="block font-bold text-slate-700 sm:inline">{item.parameter}:</span> <span className={item.status === 'tidak_memenuhi' ? 'font-bold text-red-600' : 'text-slate-600'}>{item.result} {item.unit}</span><span className="block text-slate-400 sm:inline"> · BM {item.standard || '-'}</span></div>)}</div></td>
    <td className="w-[15%] px-1 py-3 sm:px-4 sm:py-4"><div className="flex flex-col items-end gap-2"><button type="button" onClick={() => onEdit(record)} title="Edit pemeriksaan" aria-label="Edit pemeriksaan" className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-xs text-blue-600 hover:bg-blue-100"><i className="fas fa-pen" /></button><button type="button" onClick={() => onRemove(record)} title="Hapus pemeriksaan" aria-label="Hapus pemeriksaan" className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-50 text-xs text-red-600 hover:bg-red-100"><i className="fas fa-trash" /></button></div></td>
  </tr>;
}

export default function WaterRecordsSection({
  monthGroups, dateGroupsByType, records, month, waterType, selectedDate, loading, indexLoading,
  onSelectMonth, onSelectDate, onBackToDates, onRefresh, onEdit, onRemove,
}) {
  const selectedMonth = monthGroups.find(item => item.month === month);

  if (!month) return <section className="space-y-4">
    <div className="flex items-center justify-between"><div><h2 className="font-black text-slate-800">Arsip Pemeriksaan</h2><p className="mt-1 text-xs text-slate-500">Pilih bulan untuk melihat pemeriksaan yang tersedia.</p></div><button onClick={onRefresh} className="rounded-xl bg-slate-800 px-3 py-2 text-xs font-bold text-white"><i className="fas fa-rotate mr-2" />Segarkan</button></div>
    {indexLoading ? <div className="py-12 text-center text-slate-400"><i className="fas fa-spinner fa-spin mr-2" />Memuat daftar bulan...</div> : monthGroups.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-300 bg-white py-12 text-center text-sm text-slate-400">Belum ada pemeriksaan air yang tersimpan.</div> : <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{monthGroups.map(item => <button key={item.month} type="button" onClick={() => onSelectMonth(item.month)} className="rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-blue-300 hover:shadow-md"><div className="flex items-center justify-between"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600"><i className="fas fa-calendar" /></span><i className="fas fa-chevron-right text-xs text-slate-300" /></div><h3 className="mt-3 font-black capitalize text-slate-800">{formatMonth(item.month)}</h3><p className="mt-1 text-xs text-slate-500">{item.clean} air bersih • {item.wastewater} air limbah</p></button>)}</div>}
  </section>;

  if (!selectedDate) return <section className="space-y-4">
    <BackButton onClick={() => onSelectMonth('')}>Semua bulan</BackButton>
    <div><h2 className="font-black capitalize text-slate-800">{formatMonth(month)}</h2><p className="mt-1 text-xs text-slate-500">Pilih tanggal pemeriksaan untuk membuka rincian.</p></div>
    <div className="grid gap-4 lg:grid-cols-2">{[
      ['clean', 'Air Bersih', 'fas fa-droplet', 'cyan', selectedMonth?.clean || 0],
      ['wastewater', 'Air Limbah', 'fas fa-water', 'indigo', selectedMonth?.wastewater || 0],
    ].map(([type, label, icon, tone, count]) => <div key={type} className={`rounded-2xl border bg-white p-4 shadow-sm ${tone === 'cyan' ? 'border-cyan-100' : 'border-indigo-100'}`}>
      <div className="flex items-center gap-3"><span className={`flex h-10 w-10 items-center justify-center rounded-xl ${tone === 'cyan' ? 'bg-cyan-50 text-cyan-600' : 'bg-indigo-50 text-indigo-600'}`}><i className={icon} /></span><div><h3 className="font-black text-slate-800">{label}</h3><p className="text-xs text-slate-500">{count} rekaman</p></div></div>
      <div className="mt-4 space-y-2">{dateGroupsByType[type].length === 0 ? <p className="rounded-xl bg-slate-50 p-3 text-xs text-slate-400">Tidak ada pemeriksaan.</p> : dateGroupsByType[type].map(item => <button key={item.date} type="button" onClick={() => onSelectDate(type, item.date)} className="flex w-full items-center justify-between rounded-xl border border-slate-100 px-3 py-3 text-left transition hover:border-blue-300 hover:bg-blue-50/40"><span><span className="block text-sm font-bold text-slate-700">{formatDate(item.date)}</span><span className="text-xs text-slate-400">{item.total} rincian</span></span><i className="fas fa-chevron-right text-xs text-slate-300" /></button>)}</div>
    </div>)}</div>
  </section>;

  return <section className="space-y-4">
    <BackButton onClick={onBackToDates}>Daftar tanggal</BackButton>
    <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between"><div><h2 className="font-black text-slate-800">{WATER_TYPES[waterType]}</h2><p className="mt-1 text-sm font-bold text-slate-500">Pengambilan sampel {formatDate(selectedDate)}</p></div><p className="text-xs text-slate-400">{records.length} rincian pemeriksaan</p></div>
    {loading ? <div className="py-12 text-center text-slate-400"><i className="fas fa-spinner fa-spin mr-2" />Memuat rincian...</div> : records.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-300 bg-white py-12 text-center text-sm text-slate-400">Rincian pemeriksaan tidak ditemukan.</div> : <div className="rounded-2xl border border-slate-200 bg-white shadow-sm"><table className="w-full table-fixed text-left"><thead className="border-b border-slate-200 bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500 sm:text-xs"><tr><th className="w-[30%] px-2 py-3 sm:px-4">Titik & Dokumen</th><th className="w-[55%] px-2 py-3 sm:px-4">Hasil Pemeriksaan</th><th className="w-[15%] px-1 py-3 text-right sm:px-4">Aksi</th></tr></thead><tbody>{records.map(record => <RecordRow key={record.id} record={record} onEdit={onEdit} onRemove={onRemove} />)}</tbody></table></div>}
  </section>;
}
