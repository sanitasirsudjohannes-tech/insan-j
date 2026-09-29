import { useRef, useState } from 'react';
import Swal from 'sweetalert2';
export default function useRekapPrint({ tableRows, summary, selectedYear, selectedMonth }) {
  const [isPrinting, setIsPrinting] = useState(false);
  const frameRef = useRef(null);
  const handlePrint = async () => {
    setIsPrinting(true);
    try {
      const { printRekap } = await import('../services/rekapPrintService');
      await printRekap({ tableRows, summary, selectedYear, selectedMonth, frameRef });
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
