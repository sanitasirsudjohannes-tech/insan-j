import { supabase } from '../supabase';
import Swal from 'sweetalert2';
import withReactContent from 'sweetalert2-react-content';
import { getSetting } from '../api';
import { buildAnorganikPrintHTML } from '../../components/limbah/anorganik/anorganikPrintTemplate';
import { printViaHiddenIframe } from '../printHelpers';
import { getLocalMonthString } from '../localDate';
import { fetchAllSupabaseRows } from '../supabasePagination';

const MySwal = withReactContent(Swal);

export const printAnorganikReport = async ({
  filterMonth,
  ruanganList
}) => {
  const currentMonth = filterMonth || getLocalMonthString();
  const {
    value: fv
  } = await MySwal.fire({
    title: 'Cetak Laporan Limbah Anorganik',
    html: `<div class="text-left mt-4 space-y-4"><div><label class="block text-sm font-bold text-gray-700 mb-1.5">Bulan &amp; Tahun</label><input id="swal-print-month" type="month" class="w-full border border-gray-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-cyan-500 outline-none text-sm bg-gray-50" value="${currentMonth}"/></div><div><label class="block text-sm font-bold text-gray-700 mb-1.5">Ruangan (Opsional)</label><select id="swal-print-ruangan" class="w-full border border-gray-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-cyan-500 outline-none text-sm bg-gray-50 appearance-none"><option value="">-- Semua Ruangan --</option>${ruanganList.map(r => `<option value="${r}">${r}</option>`).join('')}</select></div></div>`,
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
  const s = `${y}-${m}-01`;
  const en = `${y}-${m}-${String(new Date(+y, +m, 0).getDate()).padStart(2, '0')}`;
  const MONTH_NAMES = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  const periodeText = `${MONTH_NAMES[+m - 1]} ${y}`;
  const ruanganText = selR ? `Ruangan: ${selR}` : 'Semua Ruangan';
  const printedDate = new Date().toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
  try {
    MySwal.fire({
      title: 'Menyiapkan Laporan...',
      html: 'Mohon tunggu, data sedang diproses.',
      allowOutsideClick: false,
      allowEscapeKey: false,
      didOpen: () => MySwal.showLoading()
    });
    const printData = await fetchAllSupabaseRows(() => {
      let query = supabase.from('limbah_anorganik').select('tanggal, ruangan, infus, jerigen, kertas, kardus, botol_mineral, bayclin_dll, petugas, keterangan').gte('tanggal', s).lte('tanggal', en).order('tanggal', {
        ascending: true
      }).order('ruangan', {
        ascending: true
      }).order('id', {
        ascending: true
      });
      if (selR) query = query.eq('ruangan', selR);
      return query;
    });
    if (!printData?.length) {
      MySwal.fire({
        icon: 'info',
        title: 'Tidak Ada Data',
        text: 'Tidak ada data limbah anorganik untuk periode dan ruangan yang dipilih.',
        confirmButtonColor: '#2563eb'
      });
      return;
    }
    const kepalaUnit = await getSetting('kepala_unit_sanitasi', null);
    const html = buildAnorganikPrintHTML(printData, periodeText, ruanganText, printedDate, kepalaUnit);
    MySwal.close();
    const printed = await printViaHiddenIframe(html);
    if (!printed) {
      MySwal.fire('Gagal', 'Browser tidak dapat membuka dialog cetak.', 'error');
    }
  } catch (error) {
    MySwal.fire({
      icon: 'error',
      title: 'Gagal Mencetak',
      text: 'Terjadi kesalahan: ' + error.message,
      confirmButtonColor: '#dc2626'
    });
  }
};
