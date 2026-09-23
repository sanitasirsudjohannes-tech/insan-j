import { useEffect, useState } from 'react';
import Swal from 'sweetalert2';
import { buildLocalReport } from '../domain/reportBuilder.js';
import { REPORT_TYPES } from '../constants/reportTypes.js';
import { validateReportPayload } from '../domain/reportValidation.js';
import { fetchMedicalWasteRecap } from '../../../lib/reportRecap';
import { fetchWaterReportRecap } from '../services/waterReportRecap.js';
import { STORAGE_KEY, emptyState, initialPeriod, loadSavedState } from '../services/reportDraftStorage';
const numberValue = value => Math.round((Number(value) || 0) * 100) / 100;

export function useReportAssistant() {
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
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ form, draft, chartData }));
    } catch {
      setStatus('Penyimpanan sementara tidak tersedia atau penuh. Salin atau unduh draft sebelum menutup halaman.');
    }
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
      const recap = form.reportType === 'medical_waste'
        ? await fetchMedicalWasteRecap(form.period.start, form.period.end)
        : await fetchWaterReportRecap(form.period.start, form.period.end, form.reportType);
      const facts = form.reportType === 'medical_waste'
        ? Object.fromEntries(Object.entries(recap.facts).map(([key, value]) => [key, numberValue(value)]))
        : recap.facts;
      setForm(current => ({ ...current, facts: { ...current.facts, ...facts }, analytics: recap.analytics }));
      setChartData(form.reportType === 'medical_waste' ? recap.charts : null);
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

  return { form, draft, setDraft, chartData, errors, recapLoading, status, config, updateForm, updateFact, handleTypeChange, handleRecap, handleBuildLocal, handleCopy, handleReset };
}
