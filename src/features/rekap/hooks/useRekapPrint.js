import { useRef, useState } from 'react';
import Swal from 'sweetalert2';
import { calculateRekapitulasi, MONTH_NAMES } from '../domain/rekapCalculations';

export default function useRekapPrint({ allData, tableRows, summary, selectedYear, selectedMonth }) {
  const [isPrinting, setIsPrinting] = useState(false);
  const frameRef = useRef(null);

  const handlePrint = async () => {
    const { value: printMonth, isConfirmed } = await Swal.fire({
      title: 'Pilih Periode Cetak',
      text: `Tahun ${selectedYear}`,
      input: 'select',
      inputOptions: {
        semua: 'Semua Bulan',
        ...MONTH_NAMES.reduce((options, name, index) => {
          options[String(index + 1)] = name;
          return options;
        }, {})
      },
      inputValue: selectedMonth || 'semua',
      showCancelButton: true,
      confirmButtonText: 'Cetak',
      cancelButtonText: 'Batal',
      reverseButtons: true,
      customClass: {
        input: 'swal2-select'
      }
    });

    if (!isConfirmed) return;

    setIsPrinting(true);
    try {
      const printData = calculateRekapitulasi(allData, selectedYear, printMonth || 'semua');
      const { printRekap } = await import('../services/rekapPrintService');
      await printRekap({
        tableRows: printData.tableRows,
        summary: printData.summary,
        selectedYear,
        selectedMonth: printMonth || 'semua',
        frameRef
      });
    } catch (err) {
      console.error('Gagal mencetak rekap:', err);
      Swal.fire({
        icon: 'error',
        title: 'Gagal Cetak',
        text: 'Terjadi kesalahan saat memproses cetak laporan.'
      });
    } finally {
      setIsPrinting(false);
    }
  };

  return { isPrinting, handlePrint };
}
