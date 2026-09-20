import ReportCharts from '../../../components/reports/ReportCharts';
import { handleWordDownload } from '../exporters/reportDownload';

export default function ReportPreview({ form, draft, setDraft, chartData, handleCopy }) {
  return (

          <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-black text-slate-800">3. Periksa dan edit draft</h2>
                <p className="mt-1 text-xs text-slate-500">Perubahan tersimpan sementara pada tab ini.</p>
              </div>
              <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-700"><i className="fas fa-file-lines mr-1.5" />Template lokal</span>
            </div>
            {chartData && form.reportType === 'medical_waste' && (
              <div className="mb-5">
                <ReportCharts data={chartData} />
              </div>
            )}
            <textarea value={draft} onChange={event => setDraft(event.target.value)} rows="28" className="w-full resize-y rounded-2xl border border-slate-300 bg-slate-50 p-4 font-mono text-sm leading-relaxed text-slate-800 outline-none focus:bg-white focus:ring-2 focus:ring-blue-500" />
            {draft && (
              <>
                <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
                  <button type="button" onClick={handleCopy} className="rounded-xl border border-blue-200 px-4 py-2.5 text-sm font-bold text-blue-700">
                    <i className="fas fa-copy mr-2" />
                    Salin
                  </button>
                  <button type="button" onClick={() => handleWordDownload(draft, form.reportType, form.facts, chartData)} className="rounded-xl border border-emerald-200 px-4 py-2.5 text-sm font-bold text-emerald-700">
                    <i className="fas fa-file-word mr-2" />
                    Unduh DOCX
                  </button>
                  {chartData && (
                    <button type="button" onClick={() => handleWordDownload(draft, form.reportType, form.facts, chartData, true)} className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white shadow-md">
                      <i className="fas fa-chart-column mr-2" />
                      DOCX + Grafik
                    </button>
                  )}
                </div>
              </>
            )}
          </section>
        
  );
}
