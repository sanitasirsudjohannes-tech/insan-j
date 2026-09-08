import { useRef, useState } from 'react';
import { loadExcelLibrary } from '../../../lib/excelLoader';
import { formatDateFromExcel } from '../../../lib/excelDateHelpers';
import {
  escapeImportHTML, parseNonNegativeImportNumber
} from '../../../lib/excelImport';
import { getLocalMonthString } from '../../../lib/localDate';
import {
  fetchPengangkutanForExport,
  importPengangkutanRows
} from '../services/pengangkutanService';

export default function usePengangkutanExcel({ user, fetchData, alert }) {
  const MySwal = alert;
  const importRef = useRef(null);
  const [importing, setImporting] = useState(false);

    const handleExport = async () => {
        const { value: month } = await MySwal.fire({
            title: 'Pilih Bulan',
            html: `<input id="m" type="month" class="swal2-input" value="${getLocalMonthString()}">`,
            focusConfirm: false,
            showCancelButton: true,
            confirmButtonText: 'Export',
            preConfirm: () => document.getElementById('m').value
        });
        if (!month) return;

        const [y, mo] = month.split('-');
        MySwal.fire({ title: 'Mengambil data...', allowOutsideClick: false, didOpen: () => MySwal.showLoading() });

        let rows;
        try {
            rows = await fetchPengangkutanForExport(month);
        } catch (error) {
            MySwal.fire('Gagal', error.message || 'Data pengangkutan tidak dapat dimuat.', 'error');
            return;
        }

        if (!rows.length) {
            MySwal.fire('Info', 'Tidak ada data bulan ini.', 'info'); return;
        }

        const monthNames = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
        const label = `${monthNames[parseInt(mo) - 1]} ${y}`;
        let total = 0;

        const wsData = [
            ['LAPORAN PENGANGKUTAN LIMBAH MEDIS PADAT'],
            [`Periode: ${label}`], [],
            ['No.', 'Tanggal', 'Jumlah Diangkut (Kg)', 'Keterangan', 'Petugas'],
            ...rows.map((r, i) => {
                total += parseFloat(r.jumlah_kg) || 0;
                return [i + 1, new Date(r.tanggal).toLocaleDateString('id-ID'), parseFloat(r.jumlah_kg) || 0, r.keterangan || '', r.petugas];
            }),
            ['', 'TOTAL', total, '', '']
        ];

        const XLSX = await loadExcelLibrary();
        const ws = XLSX.utils.aoa_to_sheet(wsData);
        ws['!cols'] = [{ wch: 5 }, { wch: 14 }, { wch: 22 }, { wch: 30 }, { wch: 18 }];
        ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 4 } }, { s: { r: 1, c: 0 }, e: { r: 1, c: 4 } }];

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, `Pengangkutan ${label}`);
        XLSX.writeFile(wb, `Pengangkutan_Limbah_${label.replace(' ', '_')}.xlsx`);
        MySwal.fire({ icon: 'success', title: 'Export Berhasil!', timer: 1800, showConfirmButton: false });
    };

    // ── Import Excel ──
    const handleImportFile = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        e.target.value = '';
        const reader = new FileReader();
        reader.onload = async (evt) => {
            try {
                const XLSX = await loadExcelLibrary();
                const wb = XLSX.read(evt.target.result, { type: 'binary', cellDates: false });
                const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: '' });

                let hIdx = rows.findIndex(r => r.join('').toLowerCase().includes('tanggal'));
                if (hIdx === -1) { MySwal.fire('Format Salah', 'Header Tanggal tidak ditemukan.', 'error'); return; }

                const dataRows = rows.slice(hIdx + 1)
                    .map((row, index) => ({ row, rowNumber: hIdx + index + 2 }))
                    .filter(({ row }) => {
                        const dateText = String(row[1] ?? '').trim().toLowerCase();
                        const hasAnyData = row.slice(1, 4).some(value => String(value ?? '').trim() !== '');
                        return hasAnyData && !dateText.includes('format') && !dateText.includes('total');
                    });
                if (!dataRows.length) { MySwal.fire('Kosong', 'Tidak ada data ditemukan.', 'warning'); return; }

                const payloads = [];
                const validationErrors = [];
                const importTime = new Date().toISOString();

                dataRows.forEach(({ row, rowNumber }) => {
                    const tanggal = formatDateFromExcel(row[1], XLSX);
                    const parsedWeight = parseNonNegativeImportNumber(row[2]);
                    const rowErrors = [];
                    if (!tanggal) rowErrors.push(`tanggal "${String(row[1] ?? '').trim()}" tidak valid`);
                    if (parsedWeight.error) rowErrors.push(`Jumlah Diangkut ${parsedWeight.error}`);

                    if (rowErrors.length > 0) {
                        validationErrors.push(`Baris ${rowNumber}: ${rowErrors.join('; ')}`);
                        return;
                    }

                    payloads.push({
                        tanggal,
                        jumlah_kg: parsedWeight.value,
                        keterangan: String(row[3] || '').trim(),
                        petugas: user?.nama || 'Petugas',
                        waktu_input: importTime,
                    });
                });

                if (validationErrors.length > 0) {
                    const shownErrors = validationErrors.slice(0, 10);
                    const remaining = validationErrors.length - shownErrors.length;
                    MySwal.fire({
                        icon: 'error',
                        title: 'Data Excel Belum Valid',
                        html: `<div class="text-left text-sm"><p class="mb-3">Perbaiki data berikut, lalu impor kembali. Tidak ada data yang disimpan.</p><ul class="list-disc pl-5 space-y-1 max-h-64 overflow-y-auto">${shownErrors.map(error => `<li>${escapeImportHTML(error)}</li>`).join('')}</ul>${remaining > 0 ? `<p class="mt-3 font-semibold">Dan ${remaining} kesalahan lainnya.</p>` : ''}</div>`,
                        confirmButtonColor: '#dc2626',
                    });
                    return;
                }

                const { isConfirmed } = await MySwal.fire({
                    title: 'Konfirmasi Import',
                    html: `<p>Ditemukan <strong>${payloads.length} baris</strong> data. Lanjutkan import?</p>`,
                    icon: 'question', showCancelButton: true, confirmButtonText: 'Ya, Import!'
                });
                if (!isConfirmed) return;

                setImporting(true);
                MySwal.fire({ title: 'Mengimport Data...', allowOutsideClick: false, didOpen: () => MySwal.showLoading() });
                const inserted = await importPengangkutanRows(payloads);

                fetchData();
                MySwal.fire({ icon: 'success', title: `${inserted} data berhasil diimport!`, timer: 2000, showConfirmButton: false });
            } catch (err) {
                MySwal.fire('Gagal Import', err.message, 'error');
            } finally {
                setImporting(false);
            }
        };
        reader.readAsBinaryString(file);
    };

    const handleDownloadTemplate = async () => {
        const XLSX = await loadExcelLibrary();
        const ws = XLSX.utils.aoa_to_sheet([
            ['No.', 'Tanggal', 'Jumlah Diangkut (Kg)', 'Keterangan'],
            ['', 'Format: YYYY-MM-DD, contoh: 2025-01-15', '', ''],
            [1, '2025-01-10', 25.5, 'Pengangkutan rutin'],
            [2, '2025-01-20', 30.0, 'Pengangkutan tambahan'],
        ]);
        ws['!cols'] = [{ wch: 5 }, { wch: 20 }, { wch: 22 }, { wch: 30 }];
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Template');
        XLSX.writeFile(wb, 'Template_Pengangkutan_Limbah.xlsx');
    };


  return { importRef, importing, handleExport, handleImportFile, handleDownloadTemplate };
}
