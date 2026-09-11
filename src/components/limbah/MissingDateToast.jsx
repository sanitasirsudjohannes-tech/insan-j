import { useEffect } from 'react';
import Swal from 'sweetalert2';
import withReactContent from 'sweetalert2-react-content';
import { supabase } from '../../lib/supabase';
import { getLocalDateString } from '../../lib/localDate';
import { fetchAllSupabaseRows } from '../../lib/supabasePagination';
import { fetchDatabaseAggregation } from '../../lib/databaseAggregations';

const MySwal = withReactContent(Swal);
const STORAGE_PREFIX = 'insan_j_missing_date_toast';

const formatDate = (dateStr) => new Date(`${dateStr}T00:00:00`).toLocaleDateString('id-ID', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

async function fetchMissingDates() {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

  if (yesterday < startOfMonth) return [];

  const startDate = getLocalDateString(startOfMonth);
  const endDate = getLocalDateString(yesterday);
  const aggregated = await fetchDatabaseAggregation('dashboard_missing_waste_dates', {
    start_date: startDate,
    end_date: endDate,
  });

  if (aggregated !== null) return aggregated;

  const [padatData, ruanganData] = await Promise.all(
    ['limbah_padat', 'limbah_ruangan'].map((table) => fetchAllSupabaseRows(() => supabase
      .from(table)
      .select('tanggal')
      .gte('tanggal', startDate)
      .lte('tanggal', endDate)
      .order('tanggal', { ascending: true })
      .order('id', { ascending: true })))
  );

  const filledDates = new Set([
    ...padatData.map((item) => item.tanggal),
    ...ruanganData.map((item) => item.tanggal),
  ]);
  const missingDates = [];

  for (const date = new Date(startOfMonth); date <= yesterday; date.setDate(date.getDate() + 1)) {
    const value = getLocalDateString(date);
    if (!filledDates.has(value)) missingDates.push(value);
  }

  return missingDates;
}

export default function MissingDateToast({ user, enabled = true }) {
  useEffect(() => {
    if (!enabled || !user?.id || !navigator.onLine) return undefined;

    let cancelled = false;
    const todayKey = getLocalDateString();
    const storageKey = `${STORAGE_PREFIX}:${user.id}:${todayKey}`;

    try {
      if (localStorage.getItem(storageKey)) return undefined;
    } catch {
      // Toast tetap dapat ditampilkan jika penyimpanan browser tidak tersedia.
    }

    const showWarning = async () => {
      try {
        const missingDates = await fetchMissingDates();
        if (cancelled || missingDates.length === 0) return;

        try {
          localStorage.setItem(storageKey, 'shown');
        } catch {
          // Kegagalan penyimpanan tidak boleh menghalangi peringatan.
        }

        const visibleDates = missingDates.slice(0, 3).map(formatDate);
        const remaining = missingDates.length - visibleDates.length;
        const dateText = remaining > 0
          ? `${visibleDates.join(', ')} dan ${remaining} tanggal lainnya`
          : visibleDates.join(', ');

        await MySwal.fire({
          icon: 'warning',
          title: `Ada ${missingDates.length} tanggal belum diisi`,
          html: `<div style="text-align:left;font-size:0.875rem;line-height:1.5"><strong>${dateText}</strong><br><span>Periksa kembali data limbah. Jika pengisian dilakukan setelah hari libur, centang <strong>Distribusi Tanggal</strong> agar data tercatat pada tanggal yang sesuai.</span></div>`,
          toast: true,
          position: 'top-end',
          showCloseButton: true,
          showConfirmButton: false,
          timer: 12000,
          timerProgressBar: true,
        });
      } catch (error) {
        console.error('Gagal memeriksa tanggal kosong pada halaman input:', error);
      }
    };

    showWarning();

    return () => {
      cancelled = true;
      MySwal.close();
    };
  }, [enabled, user?.id]);

  return null;
}
