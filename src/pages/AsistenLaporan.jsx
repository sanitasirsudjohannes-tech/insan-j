import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';
import AppLayout from '../components/AppLayout';
import ReportCharts from '../components/reports/ReportCharts';
import { getLocalDateString } from '../lib/localDate';
import { buildLocalReport, REPORT_TYPES, validateReportPayload } from '../lib/reportAssistant';
import { fetchMedicalWasteRecap } from '../lib/reportRecap';
import { buildDocxBlob, createReportChartPngs } from '../lib/docxExport';
import { buildMedicalWasteTableModels } from '../lib/reportTableData';

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
  analytics: null,
  constraints: '',
  actions: '',
  additionalNotes: '',
};

function loadSavedState() {
  try {
    const saved = JSON.parse(sessionStorage.getItem(STORAGE_KEY));
    return saved?.form
      ? {
          ...emptyState,
          ...saved.form,
          period: { ...initialPeriod(), ...saved.form.period }
        }
      : emptyState;
  } catch {
    return emptyState;
  }
}

async function createWordFile(draft, reportType, chartImages = [], facts = {}, chartData = null) {
  const filename = `Draft_${REPORT_TYPES[reportType]?.shortLabel || 'Laporan'}_${getLocalDateString()}.docx`.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_.-]/g, '');
  const tables = reportType === 'medical_waste' ? buildMedicalWasteTableModels(facts, chartData || {}) : [];
  const blob = await buildDocxBlob(draft, chartImages, tables);
  return new File([blob], filename, {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  });
}

async function downloadWord(draft, reportType, chartImages = [], facts = {}, chartData = null) {
  const file = await createWordFile(draft, reportType, chartImages, facts, chartData);
  const blobUrl = URL.createObjectURL(file);
  const link = document.createElement('a');
  link.href = blobUrl;
  link.download = file.name;
  link.rel = 'noopener';
  link.style.display = 'none';
  document.body.appendChild(link);

  try {
    link.click();
    await new Promise(resolve => window.setTimeout(resolve, 500));
  } finally {
    link.remove();
    // Android/PWA memerlukan URL tetap aktif sampai pengelola unduhan mengambil file.
    window.setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
  }
}

async function handleWordDownload(draft, reportType, facts, reportChartData = null, includeCharts = false) {
  try {
    const chartImages = includeCharts && reportChartData ? await createReportChartPngs(reportChartData) : [];
    await downloadWord(draft, reportType, chartImages, facts, reportChartData);
    Swal.fire({
      icon: 'success',
      title: 'File DOCX Disiapkan',
      text: 'Periksa folder Unduhan pada perangkat Anda.',
      timer: 1800,
      showConfirmButton: false
    });
  } catch {
    try {
      await downloadWord(draft, reportType, [], facts, reportChartData);
      Swal.fire({
        icon: 'warning',
        title: 'Grafik Tidak Dapat Diproses',
        text: 'DOCX tanpa grafik tetap berhasil diunduh. Silakan coba kembali setelah membuka ulang halaman.',
        confirmButtonColor: '#2563eb'
      });
      return;
    } catch {
      // Gunakan menu berbagi bawaan perangkat sebagai pilihan terakhir.
    }
    const file = await createWordFile(draft, reportType, [], facts, reportChartData);
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: file.name });
        return;
      } catch (error) {
        if (error.name === 'AbortError') return;
      }
    }
    Swal.fire({
      icon: 'error',
      title: 'Unduhan Gagal',
      text: 'Coba gunakan tombol Word tanpa grafik atau buka aplikasi melalui browser Chrome.',
      confirmButtonColor: '#2563eb'
    });
  }
}

export default function AsistenLaporan() {
  const navigate = useNavigate();
  const [form, setForm] = useState(loadSavedState);
  const [draft, setDraft] = useState(() => {
    try {
      return JSON.parse(sessionStorage.getItem(STORAGE_KEY))?.draft || '';
    } catch {
      return '';
    }
  });
  const [chartData, setChartData] = useState(() => {
    try {
      return JSON.parse(sessionStorage.getItem(STORAGE_KEY))?.chartData || null;
    } catch {
      return null;
    }
  });
  const [errors, setErrors] = useState({});
  const [recapLoading, setRecapLoading] = useState(false);
  const [status, setStatus] = useState('');
  const config = REPORT_TYPES[form.reportType];

  useEffect(() => {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ form, draft, chartData }));
  }, [form, draft, chartData]);

  const updateForm = (key, value) => setForm(current => ({ ...current, [key]: value }));
  const updateFact = (key, value) =>
    setForm(current => ({
      ...current,
      facts: { ...current.facts, [key]: value }
    }));

  const handleTypeChange = reportType => {
    setForm(current => ({ ...current, reportType, facts: {}, analytics: null }));
    setErrors({});
    setChartData(null);
  };

  const handleRecap = async () => {
    if (!form.period.start || !form.period.end || form.period.start > form.period.end) {
      setErrors(validateReportPayload(form));
      return;
    }
    setRecapLoading(true);
    try {
      const recap = await fetchMedicalWasteRecap(form.period.start, form.period.end);
      const facts = Object.fromEntries(Object.entries(recap.facts).map(([key, value]) => [key, numberValue(value)]));
      setForm(current => ({ ...current, facts, analytics: recap.analytics }));
      setChartData(recap.charts);
      await Swal.fire({
        icon: 'success',
        title: 'Data Rekap Diambil',
        text: 'Angka berasal dari data yang sudah tersinkron pada periode tersebut.',
        timer: 1800,
        showConfirmButton: false
      });
    } catch {
      Swal.fire({
        icon: 'error',
        title: 'Rekap Gagal Dimuat',
        text: 'Periksa koneksi lalu coba kembali.',
        confirmButtonColor: '#2563eb'
      });
    } finally {
      setRecapLoading(false);
    }
  };

  const handleBuildLocal = () => {
    const validationErrors = validateReportPayload(form);
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length) return;
    setDraft(buildLocalReport(form));
    if (form.reportType === 'medical_waste' && !chartData) {
      setChartData({
        balanceFlow: [
          {
            name: 'Sisa Awal',
            value: Number(form.facts.openingBalanceKg) || 0
          },
          { name: 'Timbulan', value: Number(form.facts.totalGeneratedKg) || 0 },
          {
            name: 'Diangkut',
            value: Number(form.facts.totalTransportedKg) || 0
          },
          { name: 'Sisa Akhir', value: Number(form.facts.remainingKg) || 0 }
        ],
        timeline: [],
        rooms: [],
        composition: [
          { name: 'Infeksius', value: Number(form.facts.infectiousKg) || 0 },
          { name: 'Jarum', value: Number(form.facts.sharpsKg) || 0 },
          { name: 'Botol', value: Number(form.facts.bottleKg) || 0 },
          { name: 'Sitotoksik', value: Number(form.facts.cytotoxicKg) || 0 }
        ]
      });
    }
    setStatus('Laporan lengkap dibuat dari template lokal. Periksa narasi, tabel, dan grafik sebelum digunakan.');
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(draft);
      Swal.fire({
        icon: 'success',
        title: 'Draft Disalin',
        timer: 1200,
        showConfirmButton: false
      });
    } catch {
      Swal.fire({
        icon: 'error',
        title: 'Tidak Dapat Menyalin',
        text: 'Pilih teks secara manual lalu salin.',
        confirmButtonColor: '#2563eb'
      });
    }
  };

  const handleReset = async () => {
    const result = await Swal.fire({
      icon: 'warning',
      title: 'Hapus Draft?',
      text: 'Semua isian dan hasil sementara pada perangkat ini akan dihapus.',
      showCancelButton: true,
      confirmButtonText: 'Hapus',
      cancelButtonText: 'Batal',
      confirmButtonColor: '#dc2626'
    });
    if (!result.isConfirmed) return;
    sessionStorage.removeItem(STORAGE_KEY);
    setForm({ ...emptyState, period: initialPeriod(), facts: {} });
    setDraft('');
    setChartData(null);
    setErrors({});
    setStatus('');
  };

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

        <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <h2 className="font-black text-slate-800">1. Pilih laporan dan periode</h2>
              <p className="mt-1 text-xs text-slate-500">Data tidak disimpan ke database.</p>
            </div>
            <button type="button" onClick={() => navigate('/rekap-limbah')} className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200">
              Ke Rekap
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            {Object.entries(REPORT_TYPES).map(([key, type]) => (
              <button key={key} type="button" onClick={() => handleTypeChange(key)} className={`rounded-2xl border p-3 text-left transition ${form.reportType === key ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-sm' : 'border-slate-200 text-slate-600 hover:border-blue-200'}`}>
                <i className={`${type.icon} mb-2 block`} />
                <span className="text-xs font-bold leading-tight">{type.shortLabel}</span>
              </button>
            ))}
          </div>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            {[
              ['start', 'Tanggal awal'],
              ['end', 'Tanggal akhir']
            ].map(([key, label]) => (
              <label key={key} className="block text-sm font-bold text-slate-700">
                {label}
                <input
                  type="date"
                  value={form.period[key]}
                  onChange={event =>
                    updateForm('period', {
                      ...form.period,
                      [key]: event.target.value
                    })
                  }
                  className={`mt-2 w-full rounded-xl border px-3 py-3 font-normal outline-none focus:ring-2 focus:ring-blue-500 ${errors[`period${key === 'start' ? 'Start' : 'End'}`] ? 'border-red-400' : 'border-slate-300'}`}
                />
                <span className="mt-1 block text-xs font-normal text-red-600">{errors[`period${key === 'start' ? 'Start' : 'End'}`]}</span>
              </label>
            ))}
          </div>
        </section>

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

        {draft && (
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
        )}
      </div>
    </AppLayout>
  );
}
