import Swal from 'sweetalert2';
import { getLocalDateString } from '../../../lib/localDate';
import { REPORT_TYPES } from '../constants/reportTypes.js';
import { buildDocxBlob } from './docxBuilder.js';
import { createReportChartPngs } from './reportChartRenderer.js';
import { buildMedicalWasteTableModels } from '../../../lib/reportTableData';
import { buildWaterTableModels } from './waterTableData.js';

async function createWordFile(draft, reportType, chartImages = [], facts = {}, chartData = null, analytics = null) {
  const filename = `Draft_${REPORT_TYPES[reportType]?.shortLabel || 'Laporan'}_${getLocalDateString()}.docx`.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_.-]/g, '');
  const tables = reportType === 'medical_waste'
    ? buildMedicalWasteTableModels(facts, chartData || {})
    : ['wastewater', 'clean_water'].includes(reportType)
      ? buildWaterTableModels(reportType, analytics || {})
      : [];
  const blob = await buildDocxBlob(draft, chartImages, tables);
  return new File([blob], filename, {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  });
}

async function downloadWord(draft, reportType, chartImages = [], facts = {}, chartData = null, analytics = null) {
  const file = await createWordFile(draft, reportType, chartImages, facts, chartData, analytics);
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

export async function handleWordDownload(draft, reportType, facts, reportChartData = null, includeCharts = false, analytics = null) {
  try {
    const chartImages = includeCharts && reportChartData ? await createReportChartPngs(reportChartData) : [];
    await downloadWord(draft, reportType, chartImages, facts, reportChartData, analytics);
    Swal.fire({
      icon: 'success',
      title: 'File DOCX Disiapkan',
      text: 'Periksa folder Unduhan pada perangkat Anda.',
      timer: 1800,
      showConfirmButton: false
    });
  } catch {
    try {
      await downloadWord(draft, reportType, [], facts, reportChartData, analytics);
      Swal.fire({
        icon: 'warning',
        title: includeCharts ? 'Grafik Tidak Dapat Diproses' : 'Unduhan Dicoba Ulang',
        text: includeCharts ? 'DOCX tanpa grafik tetap berhasil diunduh. Silakan coba kembali setelah membuka ulang halaman.' : 'DOCX berhasil disiapkan setelah percobaan ulang.',
        confirmButtonColor: '#2563eb'
      });
      return;
    } catch {
      // Gunakan menu berbagi bawaan perangkat sebagai pilihan terakhir.
    }
    const file = await createWordFile(draft, reportType, [], facts, reportChartData, analytics);
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

