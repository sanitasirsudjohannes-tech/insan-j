import { todayInMakassar, WATER_TYPES } from '../waterHelpers';
import CleanWaterInputTable from './CleanWaterInputTable';
import WastewaterInputTable from './WastewaterInputTable';

export default function WaterExaminationForm({
  form, saving, tableGenerated, cleanRows, wastewaterRows,
  onChange, onGenerate, onResultChange, onSubmit, onClose,
}) {
  const today = todayInMakassar();
  return <form onSubmit={onSubmit} className="space-y-5 rounded-3xl border border-blue-100 bg-white p-4 shadow-lg sm:p-6">
    <div className="flex items-center justify-between">
      <h3 className="font-black text-slate-800">{form.id ? 'Edit' : 'Tambah'} {WATER_TYPES[form.water_type]}</h3>
      <button type="button" onClick={onClose} className="h-9 w-9 rounded-xl bg-slate-100 text-slate-500" aria-label="Tutup form"><i className="fas fa-xmark" /></button>
    </div>
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <label className="text-xs font-bold text-slate-600">Jenis Pemeriksaan
        <select value={form.water_type} disabled={Boolean(form.id)} onChange={event => onChange('water_type', event.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-sm disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500"><option value="clean">Air Bersih</option><option value="wastewater">Air Limbah</option></select>
      </label>
      <label className="text-xs font-bold text-slate-600">Tanggal Sampling
        <input type="date" max={today} value={form.sampled_at} onChange={event => onChange('sampled_at', event.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-sm" />
      </label>
      <label className="text-xs font-bold text-slate-600">Tanggal Hasil
        <input type="date" min={form.sampled_at || undefined} max={today} value={form.resulted_at} onChange={event => onChange('resulted_at', event.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-sm" />
      </label>
      <label className="text-xs font-bold text-slate-600">Laboratorium
        <input value={form.laboratory} onChange={event => onChange('laboratory', event.target.value)} placeholder="Contoh: Labkes Provinsi NTT" className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-sm" />
      </label>
      <label className="text-xs font-bold text-slate-600">Nomor Laporan
        <input value={form.report_number} onChange={event => onChange('report_number', event.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-sm" />
      </label>
    </div>
    {!form.id && <button type="button" onClick={onGenerate} className={`w-full rounded-xl py-3 text-sm font-black text-white shadow-sm transition ${form.water_type === 'clean' ? 'bg-cyan-600 hover:bg-cyan-700' : 'bg-indigo-600 hover:bg-indigo-700'}`}><i className="fas fa-table mr-2" />{tableGenerated ? 'Generate Ulang Tabel' : 'Generate Tabel Pemeriksaan'}</button>}
    {tableGenerated && form.water_type === 'clean' && <CleanWaterInputTable rows={cleanRows} onResultChange={onResultChange} />}
    {tableGenerated && form.water_type === 'wastewater' && <WastewaterInputTable rows={wastewaterRows} onResultChange={onResultChange} />}
    {form.water_type === 'wastewater' && <label className="block text-xs font-bold text-slate-600">Catatan<textarea value={form.notes} onChange={event => onChange('notes', event.target.value)} rows="2" className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-sm" /></label>}
    {tableGenerated && <button disabled={saving} className="w-full rounded-xl bg-blue-600 py-3 text-sm font-black text-white disabled:opacity-60">{saving ? 'Menyimpan...' : 'Simpan Hasil Pemeriksaan'}</button>}
  </form>;
}
