import { FETCH_BATCH_SIZE } from '../../lib/limbah/constants';
import { useState, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import Swal from 'sweetalert2';
import withReactContent from 'sweetalert2-react-content';
import { getSetting } from '../../lib/api';
import { loadExcelLibrary } from '../../lib/excelLoader';
import { buildRuanganPrintHTML } from '../../components/limbah/ruangan/ruanganPrintTemplate';
import { formatDateFromExcel } from '../../lib/excelDateHelpers';
import { printViaHiddenIframe } from '../../lib/printHelpers';
import { getLocalMonthString } from '../../lib/localDate';
import { escapeImportHTML, insertImportRowsAtomically, parseNonNegativeImportNumber } from '../../lib/excelImport';

const MySwal = withReactContent(Swal);

const fetchRuanganReportRows = async ({
  startDate,
  endDate,
  ruangan
}) => {
  const rows = [];
  let from = 0;
  while (true) {
    let query = supabase.from('limbah_ruangan').select('tanggal,ruangan,infeksius,jarum_suntik,botol_obat,sitotoksik,petugas,keterangan').gte('tanggal', startDate).lte('tanggal', endDate).order('tanggal', {
      ascending: true
    }).order('ruangan', {
      ascending: true
    }).order('id', {
      ascending: true
    }).range(from, from + FETCH_BATCH_SIZE - 1);
    if (ruangan) query = query.eq('ruangan', ruangan);
    const {
      data,
      error
    } = await query;
    if (error) throw error;
    const batch = data || [];
    rows.push(...batch);
    if (batch.length < FETCH_BATCH_SIZE) return rows;
    from += batch.length;
  }
};

export default function useRuanganReports({
  user,
  filterMonth,
  ruanganList,
  fetchData
}) {
  const [importing, setImporting] = useState(false);
  const importInputRef = useRef(null);
  const handleExportExcel = async () => {
    const {
      value: fv
    } = await MySwal.fire({
      title: 'Export Data Limbah',
      html: `<div class="text-left mt-4 space-y-4"><div><label class="block text-sm font-bold text-gray-700 mb-1.5">Bulan & Tahun</label><input id="swal-export-month" type="month" class="w-full border border-gray-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-emerald-500 outline-none text-sm bg-gray-50" value="${getLocalMonthString()}"/></div><div><label class="block text-sm font-bold text-gray-700 mb-1.5">Filter Ruangan (Opsional)</label><select id="swal-export-ruangan" class="w-full border border-gray-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-emerald-500 outline-none text-sm bg-gray-50 appearance-none"><option value="">-- Semua Ruangan --</option>${ruanganList.map(r => `<option value="${r}">${r}</option>`).join('')}</select></div></div>`,
      focusConfirm: false,
      showCancelButton: true,
      confirmButtonText: '<i class="fas fa-file-excel mr-2"></i>Export Excel',
      cancelButtonText: 'Batal',
      confirmButtonColor: '#059669',
      preConfirm: () => ({
        month: document.getElementById('swal-export-month').value,
        ruangan: document.getElementById('swal-export-ruangan').value
      })
    });
    if (!fv || !fv.month) return;
    const {
      month: sel,
      ruangan: selR
    } = fv;
    const [y, m] = sel.split('-');
    const s = `${y}-${m}-01`,
      en = `${y}-${m}-${String(new Date(y, m, 0).getDate()).padStart(2, '0')}`;
    MySwal.fire({
      title: 'Mengambil Data...',
      allowOutsideClick: false,
      didOpen: () => MySwal.showLoading()
    });
    try {
      const exportData = await fetchRuanganReportRows({
        startDate: s,
        endDate: en,
        ruangan: selR
      });
      if (!exportData?.length) {
        MySwal.fire('Informasi', 'Tidak ada data untuk filter yang dipilih.', 'info');
        return;
      }
      const monthNames = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
      const mLabel = `${monthNames[parseInt(m) - 1]} ${y}`;
      const wsData = [['LAPORAN LIMBAH MEDIS PADAT PER RUANGAN'], [`Periode: ${mLabel}` + (selR ? ` | Ruangan: ${selR}` : '')], [`Dicetak: ${new Date().toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      })}`], [], ['No.', 'Tanggal', 'Ruangan', 'Infeksius (Kg)', 'Jarum Suntik (Kg)', 'Botol Obat (Kg)', 'Sitotoksik (Kg)', 'Total (Kg)', 'Petugas', 'Keterangan']];
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
        wsData.push([idx + 1, new Date(item.tanggal).toLocaleDateString('id-ID'), item.ruangan, inf, jar, bot, sit, tot, item.petugas || '', item.keterangan || '']);
      });
      wsData.push(['', 'TOTAL', '', tI, tJ, tB, tS, tI + tJ + tB + tS, '', '']);
      const XLSX = await loadExcelLibrary();
      const ws = XLSX.utils.aoa_to_sheet(wsData);
      ws['!cols'] = [{
        wch: 5
      }, {
        wch: 14
      }, {
        wch: 24
      }, {
        wch: 16
      }, {
        wch: 18
      }, {
        wch: 16
      }, {
        wch: 16
      }, {
        wch: 16
      }, {
        wch: 18
      }, {
        wch: 24
      }];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, `Limbah Ruangan ${mLabel}`);
      XLSX.writeFile(wb, `Laporan_Limbah_Ruangan_${selR ? selR + '_' : ''}${mLabel.replace(' ', '_')}.xlsx`);
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
    const r1 = ruanganList[0] || 'Poli Jantung',
      r2 = ruanganList[1] || 'Cempaka';
    const ws = XLSX.utils.aoa_to_sheet([['No.', 'Tanggal', 'Ruangan', 'Limbah Infeksius (Kg)', 'Jarum Suntik (Kg)', 'Botol Obat (Kg)', 'Sitotoksik (Kg)', 'Keterangan'], ['', 'Format: YYYY-MM-DD', 'Pilih dari daftar ruangan yang valid', '', '', '', '', ''], [1, '2025-01-15', r1, 1.5, 0.5, 0.2, 0, 'Rutin'], [2, '2025-01-15', r2, 2.0, 0.8, 0.4, 0.1, 'Rutin']]);
    ws['!cols'] = [{
      wch: 5
    }, {
      wch: 16
    }, {
      wch: 24
    }, {
      wch: 22
    }, {
      wch: 18
    }, {
      wch: 16
    }, {
      wch: 16
    }, {
      wch: 20
    }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Template Limbah Ruangan');
    XLSX.writeFile(wb, 'Template_Import_Limbah_Ruangan.xlsx');
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
          const s = rows[i].join('').toLowerCase();
          if (s.includes('tanggal') && s.includes('ruangan')) {
            headerIdx = i;
            break;
          }
        }
        if (headerIdx === -1) {
          MySwal.fire('Format Salah', 'Header Tanggal dan Ruangan tidak ditemukan. Gunakan template yang disediakan.', 'error');
          return;
        }
        const dataRows = rows.slice(headerIdx + 1).map((row, index) => ({
          row,
          rowNumber: headerIdx + index + 2
        })).filter(({
          row: r
        }) => {
          const dateText = String(r[1] ?? '').trim().toLowerCase();
          const hasAnyData = r.slice(1, 8).some(value => String(value ?? '').trim() !== '');
          return hasAnyData && !dateText.includes('format') && !dateText.includes('total');
        });
        if (!dataRows.length) {
          MySwal.fire('Tidak Ada Data', 'Tidak ditemukan baris data yang valid.', 'warning');
          return;
        }
        const officialRooms = new Map(ruanganList.map(room => [room.trim().toLocaleLowerCase('id-ID'), room]));
        const payloads = [];
        const validationErrors = [];
        dataRows.forEach(({
          row: r,
          rowNumber
        }) => {
          const tanggal = formatDateFromExcel(r[1], XLSX);
          const rawRuangan = String(r[2] ?? '').trim();
          const ruangan = officialRooms.get(rawRuangan.toLocaleLowerCase('id-ID'));
          const numberFields = [['Infeksius', r[3], 'infeksius'], ['Jarum Suntik', r[4], 'jarum_suntik'], ['Botol Obat', r[5], 'botol_obat'], ['Sitotoksik', r[6], 'sitotoksik']];
          const parsedNumbers = {};
          const rowErrors = [];
          if (!tanggal) rowErrors.push(`tanggal "${String(r[1] ?? '').trim()}" tidak valid`);
          if (!ruangan) rowErrors.push(`ruangan "${rawRuangan}" tidak terdaftar`);
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
            ruangan,
            ...parsedNumbers,
            keterangan: r[7] ? String(r[7]).trim() : '',
            petugas: user?.nama || 'Petugas',
            waktu_input: new Date().toISOString(),
            created_by: user?.id
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
        if (!payloads.length) {
          MySwal.fire('Gagal', 'Tidak ada baris data yang dapat diimpor.', 'error');
          return;
        }
        const {
          isConfirmed
        } = await MySwal.fire({
          title: 'Konfirmasi Import',
          html: `<p>Ditemukan <strong>${payloads.length} data limbah ruangan</strong>. Lanjutkan import?</p>`,
          icon: 'question',
          showCancelButton: true,
          confirmButtonColor: '#059669',
          confirmButtonText: 'Ya, Import!'
        });
        if (!isConfirmed) return;
        setImporting(true);
        MySwal.fire({
          title: 'Mengimport Data...',
          allowOutsideClick: false,
          didOpen: () => MySwal.showLoading()
        });
        await insertImportRowsAtomically(supabase, 'limbah_ruangan', payloads);
        fetchData();
        MySwal.fire({
          icon: 'success',
          title: 'Import Berhasil!',
          text: `${payloads.length} data berhasil diimport.`,
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
    const currentMonth = filterMonth || getLocalMonthString();
    const {
      value: fv
    } = await MySwal.fire({
      title: 'Cetak Laporan Limbah',
      html: `<div class="text-left mt-4 space-y-4"><div><label class="block text-sm font-bold text-gray-700 mb-1.5">Bulan & Tahun</label><input id="swal-print-month" type="month" class="w-full border border-gray-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 outline-none text-sm bg-gray-50" value="${currentMonth}"/></div><div><label class="block text-sm font-bold text-gray-700 mb-1.5">Ruangan (Opsional)</label><select id="swal-print-ruangan" class="w-full border border-gray-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 outline-none text-sm bg-gray-50 appearance-none"><option value="">-- Semua Ruangan --</option>${ruanganList.map(r => `<option value="${r}">${r}</option>`).join('')}</select></div></div>`,
      focusConfirm: false,
      showCancelButton: true,
      confirmButtonText: '<i class="fas fa-print mr-2"></i>Cetak',
      cancelButtonText: 'Batal',
      confirmButtonColor: '#2563eb',
      preConfirm: () => {
        const mi = document.getElementById('swal-print-month');
        if (!mi?.value) {
          Swal.showValidationMessage('Silakan pilih bulan terlebih dahulu.');
          return false;
        }
        return {
          month: mi.value,
          ruangan: document.getElementById('swal-print-ruangan')?.value || ''
        };
      }
    });
    if (!fv) return;
    const {
      month: sel,
      ruangan: selR
    } = fv;
    const [y, m] = sel.split('-');
    const s = `${y}-${m}-01`,
      en = `${y}-${m}-${String(new Date(+y, +m, 0).getDate()).padStart(2, '0')}`;
    try {
      MySwal.fire({
        title: 'Menyiapkan Laporan...',
        html: 'Mohon tunggu, data sedang diproses.',
        allowOutsideClick: false,
        allowEscapeKey: false,
        didOpen: () => MySwal.showLoading()
      });
      const printData = await fetchRuanganReportRows({
        startDate: s,
        endDate: en,
        ruangan: selR
      });
      if (!printData?.length) {
        MySwal.fire({
          icon: 'info',
          title: 'Tidak Ada Data',
          text: 'Tidak ada data limbah untuk periode dan ruangan yang dipilih.',
          confirmButtonColor: '#2563eb'
        });
        return;
      }
      const monthNames = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
      const periodeText = `${monthNames[+m - 1]} ${y}`;
      const ruanganText = selR ? `Ruangan: ${selR}` : 'Semua Ruangan';
      const printedDate = new Date().toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      });
      const kepalaUnit = await getSetting('kepala_unit_sanitasi', null);
      const html = buildRuanganPrintHTML(printData, periodeText, ruanganText, printedDate, kepalaUnit);
      MySwal.close();
      const printed = await printViaHiddenIframe(html);
      if (!printed) {
        MySwal.fire('Gagal', 'Browser tidak dapat membuka dialog cetak.', 'error');
      }
    } catch (error) {
      MySwal.fire({
        icon: 'error',
        title: 'Gagal Mencetak',
        text: 'Terjadi kesalahan saat mengambil data: ' + error.message,
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
