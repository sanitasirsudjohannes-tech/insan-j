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
      <fieldset className="text-xs font-bold text-slate-600" disabled={Boolean(form.id)}>
        <legend>Jenis Pemeriksaan</legend>
        <div role="tablist" aria-label="Jenis pemeriksaan air" className="relative mt-1 grid grid-cols-2 rounded-xl bg-slate-100 p-1">
          <span
            aria-hidden="true"
            className={`absolute inset-y-1 left-1 w-[calc(50%-0.25rem)] rounded-lg shadow-sm transition-[transform,background-color] duration-300 ease-out motion-reduce:transition-none ${form.water_type === 'clean' ? 'translate-x-0 bg-cyan-600' : 'translate-x-full bg-indigo-600'}`}
          />
          <button
            type="button"
            role="tab"
            aria-selected={form.water_type === 'clean'}
            onClick={() => onChange('water_type', 'clean')}
            className={`relative z-10 rounded-lg px-3 py-2.5 text-center transition-colors duration-200 motion-reduce:transition-none disabled:cursor-not-allowed ${form.water_type === 'clean' ? 'text-white' : 'text-slate-600 hover:text-slate-900'}`}
          >
            <i className="fas fa-droplet mr-2" />Air Bersih
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={form.water_type === 'wastewater'}
            onClick={() => onChange('water_type', 'wastewater')}
            className={`relative z-10 rounded-lg px-3 py-2.5 text-center transition-colors duration-200 motion-reduce:transition-none disabled:cursor-not-allowed ${form.water_type === 'wastewater' ? 'text-white' : 'text-slate-600 hover:text-slate-900'}`}
          >
            <i className="fas fa-water mr-2" />Air Limbah
          </button>
        </div>
      </fieldset>
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
