import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { getLocalDateString } from '../../lib/localDate';
import { fetchAllSupabaseRows } from '../../lib/supabasePagination';
import { fetchDatabaseAggregation } from '../../lib/databaseAggregations';

const buildCheckPeriod = () => {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const currentMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const previousMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const previousMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0);

  const ranges = [[previousMonthStart, previousMonthEnd]];
  if (yesterday >= currentMonthStart) ranges.push([currentMonthStart, yesterday]);

  const dates = [];
  for (const [start, end] of ranges) {
    for (const date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
      dates.push(getLocalDateString(date));
    }
  }

  return { dates, ranges };
};

export default function DashboardNotification() {
  const [missingDates, setMissingDates] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMissingDates = async () => {
      setLoading(true);
      try {
        const { dates: datesToCheck, ranges } = buildCheckPeriod();
        if (datesToCheck.length === 0) return;

        const aggregatedRanges = await Promise.all(ranges.map(([start, end]) =>
          fetchDatabaseAggregation('dashboard_missing_waste_dates', {
            start_date: getLocalDateString(start),
            end_date: getLocalDateString(end),
          })
        ));

        if (aggregatedRanges.every(result => result !== null)) {
          setMissingDates([...new Set(aggregatedRanges.flat())].sort());
          return;
        }

        const startDateStr = datesToCheck[0];
        const endDateStr = datesToCheck[datesToCheck.length - 1];
        const [padatData, ruanganData] = await Promise.all(
          ['limbah_padat', 'limbah_ruangan'].map(table => fetchAllSupabaseRows(() => supabase
            .from(table)
            .select('tanggal')
            .gte('tanggal', startDateStr)
            .lte('tanggal', endDateStr)
            .order('tanggal', { ascending: true })
            .order('id', { ascending: true })))
        );

        const padatDates = new Set(padatData.map(item => item.tanggal));
        const ruanganDates = new Set(ruanganData.map(item => item.tanggal));
        setMissingDates(datesToCheck.filter(date => !padatDates.has(date) && !ruanganDates.has(date)));
      } catch (error) {
        console.error('Error fetching missing dates:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchMissingDates();
  }, []);

  const formatDate = (dateStr) => new Date(`${dateStr}T00:00:00`).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

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
              <p>Cek kembali tanggal pada bulan berjalan dan satu bulan sebelumnya:</p>
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
