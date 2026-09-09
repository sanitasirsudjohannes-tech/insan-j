import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';
import AppLayout from '../components/AppLayout';
import ReportCharts from '../components/reports/ReportCharts';
import { getLocalDateString } from '../lib/localDate';
import { buildLocalReport, REPORT_TYPES, validateReportPayload } from '../lib/reportAssistant';
import { generateAiReport } from '../lib/reportAssistantApi';
import { fetchMedicalWasteRecap } from '../lib/reportRecap';

const STORAGE_KEY = 'insan_j_ai_report_draft';
const numberValue = value => Math.round((Number(value) || 0) * 100) / 100;

function initialPeriod() {
  const today = getLocalDateString();
  return { start: `${today.slice(0, 7)}-01`, end: today };
}

const emptyState = {
  reportType: 'medical_waste',
  period: initialPeriod(),
  facts: {},
  constraints: '',
  actions: '',
  additionalNotes: '',
  privacyConfirmed: false,
};

function loadSavedState() {
  try {
    const saved = JSON.parse(sessionStorage.getItem(STORAGE_KEY));
    return saved?.form ? { ...emptyState, ...saved.form, period: { ...initialPeriod(), ...saved.form.period } } : emptyState;
  } catch {
    return emptyState;
  }
}

function downloadWord(draft, reportType, chartsHtml = '') {
  const escaped = draft.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>');
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>@page{size:A4;margin:2.5cm}body{font-family:Arial,sans-serif;font-size:12pt;line-height:1.5}svg{max-width:100%;height:auto}.report-charts{page-break-before:always}.report-charts article{page-break-inside:avoid;margin-bottom:24px}</style></head><body>${escaped}${chartsHtml ? `<div class="report-charts"><h1>LAMPIRAN GRAFIK</h1>${chartsHtml}</div>` : ''}</body></html>`;
  const blob = new Blob(['\ufeff', html], { type: 'application/msword' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `Draft_${REPORT_TYPES[reportType]?.shortLabel || 'Laporan'}_${getLocalDateString()}.doc`;
  link.click();
  URL.revokeObjectURL(url);
}

export default function AsistenLaporan() {
  const navigate = useNavigate();
  const [form, setForm] = useState(loadSavedState);
  const [draft, setDraft] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem(STORAGE_KEY))?.draft || ''; } catch { return ''; }
  });
  const [provider, setProvider] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem(STORAGE_KEY))?.provider || ''; } catch { return ''; }
  });
  const [chartData, setChartData] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem(STORAGE_KEY))?.chartData || null; } catch { return null; }
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [recapLoading, setRecapLoading] = useState(false);
  const [status, setStatus] = useState('');
  const abortRef = useRef(null);
  const chartsRef = useRef(null);
  const config = REPORT_TYPES[form.reportType];

  useEffect(() => {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ form, draft, provider, chartData }));
  }, [form, draft, provider, chartData]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const sourceInfo = useMemo(() => ({
    gemini: { label: 'Disusun dengan Gemini', icon: 'fa-wand-magic-sparkles', color: 'bg-blue-50 text-blue-700 border-blue-200' },
    groq: { label: 'Disusun dengan GroqCloud', icon: 'fa-bolt', color: 'bg-violet-50 text-violet-700 border-violet-200' },
    'local-template': { label: 'Menggunakan template lokal', icon: 'fa-file-lines', color: 'bg-amber-50 text-amber-700 border-amber-200' },
  }[provider]), [provider]);

  const updateForm = (key, value) => setForm(current => ({ ...current, [key]: value }));
  const updateFact = (key, value) => setForm(current => ({ ...current, facts: { ...current.facts, [key]: value } }));

  const handleTypeChange = reportType => {
    setForm(current => ({ ...current, reportType, facts: {} }));
    setErrors({});
    setChartData(null);
  };

  const handleRecap = async () => {
    if (!form.period.start || !form.period.end || form.period.start > form.period.end) {
      setErrors(validateReportPayload({ ...form, privacyConfirmed: true }));
      return;
    }
    setRecapLoading(true);
    try {
      const recap = await fetchMedicalWasteRecap(form.period.start, form.period.end);
      const facts = Object.fromEntries(Object.entries(recap.facts).map(([key, value]) => [key, numberValue(value)]));
      setForm(current => ({ ...current, facts }));
      setChartData(recap.charts);
      await Swal.fire({ icon: 'success', title: 'Data Rekap Diambil', text: 'Angka berasal dari data yang sudah tersinkron pada periode tersebut.', timer: 1800, showConfirmButton: false });
    } catch {
      Swal.fire({ icon: 'error', title: 'Rekap Gagal Dimuat', text: 'Periksa koneksi lalu coba kembali.', confirmButtonColor: '#2563eb' });
    } finally {
      setRecapLoading(false);
    }
  };

  const handleBuildLocal = () => {
    const validationErrors = validateReportPayload({ ...form, privacyConfirmed: true });
    delete validationErrors.privacyConfirmed;
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length) return;
    setDraft(buildLocalReport(form));
    setProvider('local-template');
    if (form.reportType === 'medical_waste' && !chartData) {
      setChartData({
        timeline: [],
        rooms: [],
        composition: [
          { name: 'Infeksius', value: Number(form.facts.infectiousKg) || 0 },
          { name: 'Jarum', value: Number(form.facts.sharpsKg) || 0 },
          { name: 'Botol', value: Number(form.facts.bottleKg) || 0 },
          { name: 'Sitotoksik', value: Number(form.facts.cytotoxicKg) || 0 },
        ],
      });
    }
    setStatus('Laporan lengkap dibuat dari template lokal. Periksa narasi, tabel, dan grafik sebelum digunakan.');
  };

  const handlePolishWithAi = async () => {
    const validationErrors = validateReportPayload(form);
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length) return;
    setLoading(true);
    setStatus(navigator.onLine ? 'Mengirim draft untuk dirapikan dengan Gemini…' : 'AI memerlukan koneksi internet. Template lokal tetap tersedia.');
    abortRef.current = new AbortController();
    try {
      if (!navigator.onLine) {
        return;
      }
      const statusTimer = window.setTimeout(() => setStatus('AI utama belum merespons, fallback akan dilakukan otomatis…'), 7000);
      try {
        const result = await generateAiReport({ ...form, sourceDraft: draft }, abortRef.current.signal);
        setDraft(result.draft);
        setProvider(result.provider);
        if (result.isTemplateOnly) setStatus(result.warning);
        else setStatus('Draft berhasil dibuat. Periksa seluruh isi sebelum digunakan.');
      } finally {
        window.clearTimeout(statusTimer);
      }
    } catch (error) {
      if (error.name === 'AbortError') {
        setStatus('Pembuatan draft dibatalkan. Isian Anda tetap tersimpan.');
      } else {
        setStatus(`${error.message} Draft template lokal tidak diubah.`);
        if (error.errors) setErrors(error.errors);
      }
    } finally {
      setLoading(false);
      abortRef.current = null;
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(draft);
      Swal.fire({ icon: 'success', title: 'Draft Disalin', timer: 1200, showConfirmButton: false });
    } catch {
      Swal.fire({ icon: 'error', title: 'Tidak Dapat Menyalin', text: 'Pilih teks secara manual lalu salin.', confirmButtonColor: '#2563eb' });
    }
  };

  const handleReset = async () => {
    const result = await Swal.fire({ icon: 'warning', title: 'Hapus Draft?', text: 'Semua isian dan hasil sementara pada perangkat ini akan dihapus.', showCancelButton: true, confirmButtonText: 'Hapus', cancelButtonText: 'Batal', confirmButtonColor: '#dc2626' });
    if (!result.isConfirmed) return;
    sessionStorage.removeItem(STORAGE_KEY);
    setForm({ ...emptyState, period: initialPeriod(), facts: {} });
    setDraft('');
    setProvider('');
    setChartData(null);
    setErrors({});
    setStatus('');
  };

  return (
    <AppLayout title="Asisten Laporan AI" showBackButton>
      <div className="mx-auto max-w-5xl space-y-5 px-3 py-5 sm:px-6 sm:py-7">
        <section className="relative overflow-hidden rounded-3xl bg-linear-to-br from-slate-900 via-blue-950 to-blue-800 p-5 text-white shadow-xl sm:p-7">
          <div className="absolute -right-10 -top-10 h-36 w-36 rounded-full bg-cyan-400/20 blur-2xl" />
          <div className="relative flex items-start gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/15 shadow-inner backdrop-blur"><i className="fas fa-wand-magic-sparkles text-xl text-cyan-300" /></span>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-300">INSAN-J</p>
              <h1 className="mt-1 text-xl font-black sm:text-2xl">Asisten Penyusunan Laporan</h1>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-blue-100">Buat laporan lengkap melalui template lokal dan grafik data. AI hanya digunakan bila Anda memilih untuk merapikan narasi.</p>
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div><h2 className="font-black text-slate-800">1. Pilih laporan dan periode</h2><p className="mt-1 text-xs text-slate-500">Data tidak disimpan ke database.</p></div>
            <button type="button" onClick={() => navigate('/rekap-limbah')} className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200">Ke Rekap</button>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            {Object.entries(REPORT_TYPES).map(([key, type]) => (
              <button key={key} type="button" onClick={() => handleTypeChange(key)} className={`rounded-2xl border p-3 text-left transition ${form.reportType === key ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-sm' : 'border-slate-200 text-slate-600 hover:border-blue-200'}`}>
                <i className={`${type.icon} mb-2 block`} /><span className="text-xs font-bold leading-tight">{type.shortLabel}</span>
              </button>
            ))}
          </div>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            {[['start', 'Tanggal awal'], ['end', 'Tanggal akhir']].map(([key, label]) => (
              <label key={key} className="block text-sm font-bold text-slate-700">{label}<input type="date" value={form.period[key]} onChange={event => updateForm('period', { ...form.period, [key]: event.target.value })} className={`mt-2 w-full rounded-xl border px-3 py-3 font-normal outline-none focus:ring-2 focus:ring-blue-500 ${errors[`period${key === 'start' ? 'Start' : 'End'}`] ? 'border-red-400' : 'border-slate-300'}`} /><span className="mt-1 block text-xs font-normal text-red-600">{errors[`period${key === 'start' ? 'Start' : 'End'}`]}</span></label>
            ))}
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div><h2 className="font-black text-slate-800">2. Lengkapi fakta</h2><p className="mt-1 text-xs text-slate-500">Gunakan angka dan informasi yang sudah diverifikasi.</p></div>
            {config.supportsRecap && <button type="button" onClick={handleRecap} disabled={recapLoading} className="rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white shadow-md shadow-blue-200 disabled:opacity-60"><i className={`fas ${recapLoading ? 'fa-spinner fa-spin' : 'fa-chart-simple'} mr-2`} />{recapLoading ? 'Mengambil…' : 'Ambil Data Rekap'}</button>}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {config.fields.map(field => (
              <label key={field.key} className={`${field.multiline ? 'sm:col-span-2' : ''} block text-sm font-bold text-slate-700`}>{field.label}{field.required && <span className="text-red-500"> *</span>}
                {field.multiline ? <textarea rows="3" value={form.facts[field.key] ?? ''} onChange={event => updateFact(field.key, event.target.value)} className={`mt-2 w-full resize-y rounded-xl border px-3 py-3 font-normal outline-none focus:ring-2 focus:ring-blue-500 ${errors[field.key] ? 'border-red-400' : 'border-slate-300'}`} /> : <input type={field.type || 'text'} min={field.type === 'number' ? '0' : undefined} step={field.type === 'number' ? '0.01' : undefined} value={form.facts[field.key] ?? ''} onChange={event => updateFact(field.key, event.target.value)} className={`mt-2 w-full rounded-xl border px-3 py-3 font-normal outline-none focus:ring-2 focus:ring-blue-500 ${errors[field.key] ? 'border-red-400' : 'border-slate-300'}`} />}
                {errors[field.key] && <span className="mt-1 block text-xs font-normal text-red-600">{errors[field.key]}</span>}
              </label>
            ))}
          </div>
          <div className="mt-5 grid gap-4">
            {[['constraints', 'Kendala/temuan'], ['actions', 'Tindakan dan rekomendasi'], ['additionalNotes', 'Catatan tambahan']].map(([key, label]) => <label key={key} className="block text-sm font-bold text-slate-700">{label}<textarea rows="3" value={form[key]} onChange={event => updateForm(key, event.target.value)} placeholder="Kosongkan jika belum tersedia; draft akan menandainya untuk dilengkapi." className="mt-2 w-full resize-y rounded-xl border border-slate-300 px-3 py-3 font-normal outline-none focus:ring-2 focus:ring-blue-500" /></label>)}
          </div>
          <div className="mt-5 flex flex-col gap-2 sm:flex-row">
            <button type="button" onClick={handleBuildLocal} disabled={loading} className="flex-1 rounded-2xl bg-linear-to-r from-blue-600 to-cyan-500 px-5 py-3.5 font-black text-white shadow-lg shadow-blue-200 disabled:opacity-60"><i className="fas fa-file-circle-plus mr-2" />Buat Laporan Lengkap</button>
            <button type="button" onClick={handleReset} disabled={loading} className="rounded-2xl border border-slate-200 px-5 py-3 font-bold text-slate-600 disabled:opacity-50">Hapus Draft</button>
          </div>
          {status && <div role="status" aria-live="polite" className="mt-4 rounded-2xl border border-blue-100 bg-blue-50 p-3 text-sm text-blue-800"><i className="fas fa-circle-info mr-2" />{status}</div>}
        </section>

        {(loading || draft) && <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-black text-slate-800">3. Periksa dan edit draft</h2><p className="mt-1 text-xs text-slate-500">Perubahan tersimpan sementara pada tab ini.</p></div>{sourceInfo && <span className={`rounded-full border px-3 py-1.5 text-xs font-bold ${sourceInfo.color}`}><i className={`fas ${sourceInfo.icon} mr-1.5`} />{sourceInfo.label}</span>}</div>
          {chartData && form.reportType === 'medical_waste' && <div className="mb-5"><ReportCharts ref={chartsRef} data={chartData} /></div>}
          <textarea value={draft} onChange={event => setDraft(event.target.value)} rows="28" className="w-full resize-y rounded-2xl border border-slate-300 bg-slate-50 p-4 font-mono text-sm leading-relaxed text-slate-800 outline-none focus:bg-white focus:ring-2 focus:ring-blue-500" />
          {draft && <><label className={`mt-4 flex cursor-pointer items-start gap-3 rounded-2xl border p-4 ${errors.privacyConfirmed ? 'border-red-300 bg-red-50' : 'border-violet-100 bg-violet-50/60'}`}><input type="checkbox" checked={form.privacyConfirmed} onChange={event => updateForm('privacyConfirmed', event.target.checked)} className="mt-1 h-4 w-4 accent-violet-600" /><span className="text-sm text-slate-700"><strong>Saya memastikan isian tidak mengandung data pasien</strong><span className="mt-1 block text-xs text-slate-500">Konfirmasi ini hanya diperlukan jika memakai tombol AI.</span>{errors.privacyConfirmed && <span className="mt-1 block text-xs text-red-600">{errors.privacyConfirmed}</span>}</span></label><div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">{loading ? <button type="button" onClick={() => abortRef.current?.abort()} className="rounded-xl border border-red-200 px-4 py-2.5 text-sm font-bold text-red-600">Batalkan AI</button> : <button type="button" onClick={handlePolishWithAi} className="rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-bold text-white shadow-md"><i className="fas fa-wand-magic-sparkles mr-2" />Rapikan dengan AI</button>}<button type="button" onClick={handleCopy} className="rounded-xl border border-blue-200 px-4 py-2.5 text-sm font-bold text-blue-700"><i className="fas fa-copy mr-2" />Salin</button><button type="button" onClick={() => downloadWord(draft, form.reportType, chartsRef.current?.innerHTML || '')} className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white shadow-md"><i className="fas fa-file-word mr-2" />Unduh Word + Grafik</button></div></>}
        </section>}
      </div>
    </AppLayout>
  );
}
