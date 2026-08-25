import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { getLocalDateString } from '../../lib/localDate';
import { fetchAllSupabaseRows } from '../../lib/supabasePagination';

export default function DashboardNotification() {
  const [missingDates, setMissingDates] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMissingDates = async () => {
      setLoading(true);
      try {
        const today = new Date();
        const year = today.getFullYear();
        const month = today.getMonth();

        // Array of dates from 1st of month to yesterday
        const datesToCheck = [];
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);

        const startOfMonth = new Date(year, month, 1);

        // If yesterday is before the start of the month, we don't check anything
        if (yesterday >= startOfMonth) {
          for (let d = new Date(startOfMonth); d <= yesterday; d.setDate(d.getDate() + 1)) {
            // format YYYY-MM-DD
            const formattedDate = getLocalDateString(d);
            datesToCheck.push(formattedDate);
          }
        }

        if (datesToCheck.length === 0) {
          setLoading(false);
          return;
        }

        const startDateStr = datesToCheck[0];
        const endDateStr = datesToCheck[datesToCheck.length - 1];

        const [padatData, ruanganData] = await Promise.all([
          'limbah_padat',
          'limbah_ruangan',
        ].map(table => fetchAllSupabaseRows(() => supabase
          .from(table)
          .select('tanggal')
          .gte('tanggal', startDateStr)
          .lte('tanggal', endDateStr)
          .order('tanggal', { ascending: true })
          .order('id', { ascending: true }))));

        const padatDates = new Set(padatData.map(d => d.tanggal));
        const ruanganDates = new Set(ruanganData.map(d => d.tanggal));

        // Date is missing only if it's absent in BOTH tables
        const missed = datesToCheck.filter(d => !padatDates.has(d) && !ruanganDates.has(d));

        setMissingDates(missed);
      } catch (error) {
        console.error("Error fetching missing dates:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchMissingDates();
  }, []);

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  if (loading || missingDates.length === 0) return null;

  return (
    <div className="mb-6 animate-fade-in">
      <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-r-lg shadow-sm">
        <div className="flex">
          <div className="flex-shrink-0">
            <i className="fas fa-exclamation-circle text-red-500 mt-1"></i>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-bold text-red-800">
              Peringatan: Terdapat Tanggal yang Belum Diinput (Data Limbah)
            </h3>
            <div className="mt-2 text-sm text-red-700">
              <p>Cek kembali tanggal di bulan ini, karena belum memiliki riwayat:</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {missingDates.map(date => (
                  <span key={date} className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                    {formatDate(date)}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
