import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import Swal from 'sweetalert2';
import withReactContent from 'sweetalert2-react-content';
import { getSetting } from '../../lib/api';
import { loadExcelLibrary } from '../../lib/excelLoader';
import { buildPadatPrintHTML } from '../../components/limbah/padat/padatPrintTemplate';
import { printViaHiddenIframe } from '../../lib/printHelpers';
import { formatDateFromExcel } from '../../lib/excelDateHelpers';
import { getLocalMonthString } from '../../lib/localDate';
import { escapeImportHTML, insertImportRowsAtomically, parseNonNegativeImportNumber } from '../../lib/excelImport';
import { getAccumulatedData } from '../../lib/limbah/padatData';

const MySwal = withReactContent(Swal);

export default function usePadatReports({
  user,
  filterMonth,
  fetchData
}) {
  const [importing, setImporting] = useState(false);
  const importInputRef = useRef(null);
  const printFrameRef = useRef(null);
  useEffect(() => {
    // Iframe dibuat saat mencetak, bukan saat effect dipasang. Baca ref
    // terbaru pada cleanup agar cetakan terakhir tetap dibersihkan.
    const frameRef = printFrameRef;
    return () => {
      const frame = frameRef.current;
      if (frame?.parentNode) frame.parentNode.removeChild(frame);
    };
  }, []);
  const handleExportExcel = async () => {
    const {
      value: selectedMonth
    } = await MySwal.fire({
      title: 'Export Data Limbah',
      html: `<div class="text-left mt-4"><label class="block text-sm font-bold text-gray-700 mb-1.5">Bulan & Tahun</label><input id="swal-input-month" type="month" class="w-full border border-gray-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 outline-none text-sm bg-gray-50" value="${filterMonth || getLocalMonthString()}"></div>`,
      focusConfirm: false,
      showCancelButton: true,
      confirmButtonText: '<i class="fas fa-file-excel mr-2"></i>Export',
      cancelButtonText: 'Batal',
      confirmButtonColor: '#059669',
      preConfirm: () => document.getElementById('swal-input-month').value
    });
    if (!selectedMonth) return;
    MySwal.fire({
      title: 'Mengambil Data...',
      allowOutsideClick: false,
      didOpen: () => MySwal.showLoading()
    });
    try {
      const exportData = await getAccumulatedData(selectedMonth);
      exportData.sort((a, b) => a.tanggal.localeCompare(b.tanggal));
      if (!exportData.length) {
        MySwal.fire('Informasi', 'Tidak ada data untuk bulan ini.', 'info');
        return;
      }
      const [year, month] = selectedMonth.split('-');
      const monthNames = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
      const monthLabel = `${monthNames[parseInt(month) - 1]} ${year}`;
      const wsData = [['LAPORAN LIMBAH MEDIS PADAT (AKUMULASI HARIAN)'], [`Periode: ${monthLabel}`], [`Dicetak: ${new Date().toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      })}`], [], ['No.', 'Tanggal', 'Limbah Infeksius (Kg)', 'Jarum Suntik (Kg)', 'Botol Obat (Kg)', 'Sitotoksik (Kg)', 'Total Harian (Kg)', 'Keterangan Sumber']];
      let tI = 0,
        tJ = 0,
        tB = 0,
        tS = 0;
      exportData.forEach((item, idx) => {
        const inf = parseFloat(item.infeksius) || 0,
          jar = parseFloat(item.jarum_suntik) || 0,
          bot = parseFloat(item.botol_obat) || 0,
          sit = parseFloat(item.sitotoksik) || 0,
          tot = inf + jar + bot + sit;
        tI += inf;
        tJ += jar;
        tB += bot;
        tS += sit;
        const src = [];
        if (item.ruanganCount > 0) src.push(`Akumulasi ${item.ruanganCount} ruangan`);
        if (item.isManual) src.push('Input Manual');
        wsData.push([idx + 1, new Date(item.tanggal).toLocaleDateString('id-ID'), inf, jar, bot, sit, tot, src.join(' & ')]);
      });
      wsData.push([], ['TOTAL BULANAN', '', tI, tJ, tB, tS, tI + tJ + tB + tS]);
      const XLSX = await loadExcelLibrary();
      const ws = XLSX.utils.aoa_to_sheet(wsData);
      ws['!cols'] = [{
        wch: 5
      }, {
        wch: 14
      }, {
        wch: 22
      }, {
        wch: 18
      }, {
        wch: 16
      }, {
        wch: 14
      }, {
        wch: 18
      }];
      ws['!merges'] = [{
        s: {
          r: 0,
          c: 0
        },
        e: {
          r: 0,
          c: 6
        }
      }, {
        s: {
          r: 1,
          c: 0
        },
        e: {
          r: 1,
          c: 6
        }
      }, {
        s: {
          r: 2,
          c: 0
        },
        e: {
          r: 2,
          c: 6
        }
      }];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, `Limbah ${monthLabel}`);
      XLSX.writeFile(wb, `Laporan_Limbah_Padat_${monthLabel.replace(' ', '_')}.xlsx`);
      MySwal.fire({
        icon: 'success',
        title: 'Export Berhasil!',
        text: `${exportData.length} data berhasil diekspor.`,
        timer: 2000,
        showConfirmButton: false
      });
    } catch (error) {
      MySwal.fire('Gagal', 'Terjadi kesalahan: ' + error.message, 'error');
    }
  };

  // ── Download Template ─────────────────────────────────────────────────────────
  const handleDownloadTemplate = async () => {
    const XLSX = await loadExcelLibrary();
    const ws = XLSX.utils.aoa_to_sheet([['No.', 'Tanggal', 'Limbah Infeksius (Kg)', 'Jarum Suntik (Kg)', 'Botol Obat (Kg)', 'Sitotoksik (Kg)'], ['', 'Petunjuk: Isi tanggal format DD-MM-YYYY, misal: 15-01-2025', '', '', '', ''], [1, '01-01-2025', 0.5, 0.2, 0.1, 0.05], [2, '02-01-2025', 0.8, 0.3, 0.15, 0.1]]);
    ws['!cols'] = [{
      wch: 5
    }, {
      wch: 20
    }, {
      wch: 22
    }, {
      wch: 18
    }, {
      wch: 16
    }, {
      wch: 14
    }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Template');
    XLSX.writeFile(wb, 'Template_Import_Limbah_Padat.xlsx');
  };

  // ── Import Excel ──────────────────────────────────────────────────────────────
  const handleImportFile = e => {
    const file = e.target.files[0];
    if (!file) return;
    e.target.value = '';
    const reader = new FileReader();
    reader.onload = async evt => {
      try {
        const XLSX = await loadExcelLibrary();
        const wb = XLSX.read(evt.target.result, {
          type: 'binary',
          cellDates: false
        });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, {
          header: 1,
          defval: ''
        });
        let headerIdx = -1;
        for (let i = 0; i < rows.length; i++) {
          if (rows[i].join('').toLowerCase().includes('tanggal')) {
            headerIdx = i;
            break;
          }
        }
        if (headerIdx === -1) {
          MySwal.fire('Format Salah', 'Tidak ditemukan header "Tanggal". Gunakan template yang tersedia.', 'error');
          return;
        }
        const dataRows = rows.slice(headerIdx + 1).map((row, index) => ({
          row,
          rowNumber: headerIdx + index + 2
        })).filter(({
          row
        }) => {
          const dateText = String(row[1] ?? '').trim().toLowerCase();
          const hasAnyData = row.slice(1, 6).some(value => String(value ?? '').trim() !== '');
          return hasAnyData && !dateText.includes('petunjuk') && !dateText.includes('total');
        });
        if (!dataRows.length) {
          MySwal.fire('Tidak Ada Data', 'Tidak ditemukan baris data yang valid.', 'warning');
          return;
        }
        const payloads = [];
        const validationErrors = [];
        const importTime = new Date().toISOString();
        dataRows.forEach(({
          row,
          rowNumber
        }) => {
          const tanggal = formatDateFromExcel(row[1], XLSX);
          const numberFields = [['Infeksius', row[2], 'infeksius'], ['Jarum Suntik', row[3], 'jarum_suntik'], ['Botol Obat', row[4], 'botol_obat'], ['Sitotoksik', row[5], 'sitotoksik']];
          const parsedNumbers = {};
          const rowErrors = [];
          if (!tanggal) rowErrors.push(`tanggal "${String(row[1] ?? '').trim()}" tidak valid`);
          numberFields.forEach(([label, rawValue, key]) => {
            const parsed = parseNonNegativeImportNumber(rawValue);
            if (parsed.error) rowErrors.push(`${label} ${parsed.error}`);else parsedNumbers[key] = parsed.value;
          });
          if (rowErrors.length > 0) {
            validationErrors.push(`Baris ${rowNumber}: ${rowErrors.join('; ')}`);
            return;
          }
          payloads.push({
            tanggal,
            petugas: user?.nama || 'Petugas',
            ...parsedNumbers,
            waktu_input: importTime
          });
        });
        if (validationErrors.length > 0) {
          const shownErrors = validationErrors.slice(0, 10);
          const remaining = validationErrors.length - shownErrors.length;
          MySwal.fire({
            icon: 'error',
            title: 'Data Excel Belum Valid',
            html: `<div class="text-left text-sm"><p class="mb-3">Perbaiki data berikut, lalu impor kembali. Tidak ada data yang disimpan.</p><ul class="list-disc pl-5 space-y-1 max-h-64 overflow-y-auto">${shownErrors.map(error => `<li>${escapeImportHTML(error)}</li>`).join('')}</ul>${remaining > 0 ? `<p class="mt-3 font-semibold">Dan ${remaining} kesalahan lainnya.</p>` : ''}</div>`,
            confirmButtonColor: '#dc2626'
          });
          return;
        }
        const {
          isConfirmed
        } = await MySwal.fire({
          title: 'Konfirmasi Import',
          html: `<p>Ditemukan <strong>${payloads.length} baris data</strong>. Lanjutkan import?</p>`,
          icon: 'question',
          showCancelButton: true,
          confirmButtonColor: '#16a34a',
          confirmButtonText: 'Ya, Import!'
        });
        if (!isConfirmed) return;
        setImporting(true);
        MySwal.fire({
          title: 'Mengimport Data...',
          allowOutsideClick: false,
          didOpen: () => MySwal.showLoading()
        });
        const inserted = await insertImportRowsAtomically(supabase, 'limbah_padat', payloads);
        await fetchData();
        MySwal.fire({
          icon: 'success',
          title: 'Import Berhasil!',
          text: `${inserted} data berhasil diimport.`,
          timer: 2500,
          showConfirmButton: false
        });
      } catch (err) {
        MySwal.fire('Gagal Import', err.message || 'Terjadi kesalahan saat membaca file.', 'error');
      } finally {
        setImporting(false);
      }
    };
    reader.readAsBinaryString(file);
  };

  // ── Print ─────────────────────────────────────────────────────────────────────
  const handlePrint = async () => {
    const {
      value: formValues
    } = await MySwal.fire({
      title: 'Cetak Laporan',
      html: `<div class="text-left mt-4"><label class="block text-sm font-bold text-gray-700 mb-1.5">Bulan & Tahun</label><input id="swal-input-month" type="month" class="w-full border border-gray-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 outline-none text-sm bg-gray-50" value="${filterMonth || new Date().toISOString().slice(0, 7)}"></div>`,
      focusConfirm: false,
      showCancelButton: true,
      confirmButtonText: '<i class="fas fa-print mr-2"></i>Cetak',
      cancelButtonText: 'Batal',
      confirmButtonColor: '#2563eb',
      preConfirm: () => {
        const i = document.getElementById('swal-input-month');
        return i ? i.value : '';
      }
    });
    if (!formValues) return;
    MySwal.fire({
      title: 'Menyiapkan Laporan...',
      text: 'Mohon tunggu sebentar',
      allowOutsideClick: false,
      allowEscapeKey: false,
      didOpen: () => MySwal.showLoading()
    });
    try {
      const printData = await getAccumulatedData(formValues);
      printData.sort((a, b) => a.tanggal.localeCompare(b.tanggal));
      if (!printData.length) {
        MySwal.fire({
          icon: 'info',
          title: 'Tidak Ada Data',
          text: 'Tidak ada data limbah untuk bulan yang dipilih.',
          confirmButtonColor: '#2563eb'
        });
        return;
      }
      const kepalaUnit = await getSetting('kepala_unit_sanitasi', null);
      const html = buildPadatPrintHTML(printData, formValues, kepalaUnit);
      MySwal.close();
      const success = await printViaHiddenIframe(html, printFrameRef);
      if (!success) MySwal.fire({
        icon: 'error',
        title: 'Gagal Membuka Cetakan',
        text: 'Browser tidak mendukung cetak langsung. Coba Chrome/Safari terbaru.',
        confirmButtonColor: '#2563eb'
      });
    } catch (error) {
      MySwal.fire({
        icon: 'error',
        title: 'Gagal',
        text: 'Terjadi kesalahan saat mengambil data cetak: ' + (error.message || error),
        confirmButtonColor: '#dc2626'
      });
    }
  };
  return {
    importing,
    importInputRef,
    handleExportExcel,
    handleDownloadTemplate,
    handleImportFile,
    handlePrint
  };
}
