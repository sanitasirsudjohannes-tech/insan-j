
export default function ReportFacts({ form, config, errors, recapLoading, status, handleRecap, updateFact, updateForm, handleBuildLocal, handleReset }) {
  return (
        <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-black text-slate-800">2. Lengkapi fakta</h2>
              <p className="mt-1 text-xs text-slate-500">Gunakan angka dan informasi yang sudah diverifikasi.</p>
            </div>
            {config.supportsRecap && (
              <button type="button" onClick={handleRecap} disabled={recapLoading} className="rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white shadow-md shadow-blue-200 disabled:opacity-60">
                <i className={`fas ${recapLoading ? 'fa-spinner fa-spin' : 'fa-chart-simple'} mr-2`} />
                {recapLoading ? 'Mengambil…' : 'Ambil Data Rekap'}
              </button>
            )}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {config.fields.map(field => (
              <label key={field.key} className={`${field.multiline ? 'sm:col-span-2' : ''} block text-sm font-bold text-slate-700`}>
                {field.label}
                {field.required && <span className="text-red-500"> *</span>}
                {field.multiline ? <textarea rows="3" value={form.facts[field.key] ?? ''} onChange={event => updateFact(field.key, event.target.value)} className={`mt-2 w-full resize-y rounded-xl border px-3 py-3 font-normal outline-none focus:ring-2 focus:ring-blue-500 ${errors[field.key] ? 'border-red-400' : 'border-slate-300'}`} /> : <input type={field.type || 'text'} min={field.type === 'number' ? '0' : undefined} step={field.type === 'number' ? '0.01' : undefined} value={form.facts[field.key] ?? ''} onChange={event => updateFact(field.key, event.target.value)} className={`mt-2 w-full rounded-xl border px-3 py-3 font-normal outline-none focus:ring-2 focus:ring-blue-500 ${errors[field.key] ? 'border-red-400' : 'border-slate-300'}`} />}
                {errors[field.key] && <span className="mt-1 block text-xs font-normal text-red-600">{errors[field.key]}</span>}
              </label>
            ))}
          </div>
          <div className="mt-5 grid gap-4">
            {[
              ['constraints', 'Kendala/temuan'],
              ['actions', 'Tindakan dan rekomendasi'],
              ['additionalNotes', 'Catatan tambahan']
            ].map(([key, label]) => (
              <label key={key} className="block text-sm font-bold text-slate-700">
                {label}
                <textarea rows="3" value={form[key]} onChange={event => updateForm(key, event.target.value)} placeholder="Kosongkan jika belum tersedia; draft akan menandainya untuk dilengkapi." className="mt-2 w-full resize-y rounded-xl border border-slate-300 px-3 py-3 font-normal outline-none focus:ring-2 focus:ring-blue-500" />
              </label>
            ))}
          </div>
          <div className="mt-5 flex flex-col gap-2 sm:flex-row">
            <button type="button" onClick={handleBuildLocal} className="flex-1 rounded-2xl bg-linear-to-r from-blue-600 to-cyan-500 px-5 py-3.5 font-black text-white shadow-lg shadow-blue-200">
              <i className="fas fa-file-circle-plus mr-2" />
              Buat Laporan Lengkap
            </button>
            <button type="button" onClick={handleReset} className="rounded-2xl border border-slate-200 px-5 py-3 font-bold text-slate-600">
              Hapus Draft
            </button>
          </div>
          {status && (
            <div role="status" aria-live="polite" className="mt-4 rounded-2xl border border-blue-100 bg-blue-50 p-3 text-sm text-blue-800">
              <i className="fas fa-circle-info mr-2" />
              {status}
            </div>
          )}
        </section>


  );
}
