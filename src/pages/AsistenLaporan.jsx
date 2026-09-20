import { useNavigate } from 'react-router-dom';
import AppLayout from '../components/AppLayout';
import { useReportAssistant } from '../features/report-assistant/hooks/useReportAssistant';
import ReportForm from '../features/report-assistant/components/ReportForm';
import ReportFacts from '../features/report-assistant/components/ReportFacts';
import ReportPreview from '../features/report-assistant/components/ReportPreview';

export default function AsistenLaporan() {
  const navigate = useNavigate();
  const { form, draft, setDraft, chartData, errors, recapLoading, status, config, updateForm, updateFact, handleTypeChange, handleRecap, handleBuildLocal, handleCopy, handleReset } = useReportAssistant();
  return (
    <AppLayout title="Asisten Laporan" showBackButton>
      <div className="mx-auto max-w-5xl space-y-5 px-3 py-5 sm:px-6 sm:py-7">
        <section className="relative overflow-hidden rounded-3xl bg-linear-to-br from-slate-900 via-blue-950 to-blue-800 p-5 text-white shadow-xl sm:p-7">
          <div className="absolute -right-10 -top-10 h-36 w-36 rounded-full bg-cyan-400/20 blur-2xl" />
          <div className="relative flex items-start gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/15 shadow-inner backdrop-blur">
              <i className="fas fa-wand-magic-sparkles text-xl text-cyan-300" />
            </span>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-300">INSAN-J</p>
              <h1 className="mt-1 text-xl font-black sm:text-2xl">Asisten Laporan</h1>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-blue-100">Susun laporan lengkap menggunakan template lokal berdasarkan data yang telah diverifikasi.</p>
            </div>
          </div>
        </section>

        <ReportForm form={form} errors={errors} handleTypeChange={handleTypeChange} updateForm={updateForm} navigate={navigate} />
        <ReportFacts form={form} config={config} errors={errors} recapLoading={recapLoading} status={status} handleRecap={handleRecap} updateFact={updateFact} updateForm={updateForm} handleBuildLocal={handleBuildLocal} handleReset={handleReset} />
        {draft && (<ReportPreview form={form} draft={draft} setDraft={setDraft} chartData={chartData} handleCopy={handleCopy} />)}
      </div>
    </AppLayout>
  );
}
