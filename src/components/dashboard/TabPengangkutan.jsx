import { useState, useEffect, useRef } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, LineChart, Line, ReferenceLine
} from 'recharts';

import { fetchDatabaseAggregation } from '../../lib/databaseAggregations';
import { DashboardSkeleton, EmptyState, ErrorState } from '../ui/DataStates';

export default function TabPengangkutan() {
  const [chartData, setChartData] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState('');
  const [availableMonths, setAvailableMonths] = useState([]);
  const [summary, setSummary] = useState({ masuk: 0, diangkut: 0, sisa: 0 });
  const [loading, setLoading] = useState(true);
  const [chartReady, setChartReady] = useState(false);
  const loadedMonthRef = useRef(null);
  const fetchIdRef = useRef(0);
  const [fetchError, setFetchError] = useState('');
  const [reloadCount, setReloadCount] = useState(0);

  useEffect(() => {
    if (!loading) {
      const timer = setTimeout(() => setChartReady(true), 150);
      return () => clearTimeout(timer);
    } else {
      setChartReady(false);
    }
  }, [loading]);

  useEffect(() => {
    if (loadedMonthRef.current === selectedMonth) return;

    const currentFetchId = ++fetchIdRef.current;
    const fetchAll = async () => {
      setLoading(true);
      setFetchError('');
      try {
        const aggregated = await fetchDatabaseAggregation('dashboard_pengangkutan_summary', {
          requested_month: selectedMonth || null,
        });

        if (currentFetchId !== fetchIdRef.current) return;

        if (aggregated) {
          const resolvedMonth = aggregated.selectedMonth || '';
          const formattedRows = (aggregated.daily || []).map(row => {
            const date = new Date(row.tanggal);
            return {
              fullDate: row.tanggal,
              bulanTahun: row.tanggal.slice(0, 7),
              tanggal: date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }),
              masuk: Math.round(Number(row.masuk) || 0),
              diangkut: Math.round(Number(row.diangkut) || 0),
              sisa: Math.round(Number(row.sisa) || 0),
            };
          });

          loadedMonthRef.current = resolvedMonth;
          setAvailableMonths(aggregated.availableMonths || []);
          setChartData(formattedRows);
          setSummary({
            masuk: Math.round(Number(aggregated.summary?.masuk) || 0),
            diangkut: Math.round(Number(aggregated.summary?.diangkut) || 0),
            sisa: Math.round(Number(aggregated.summary?.sisa) || 0),
          });
          if (resolvedMonth !== selectedMonth) setSelectedMonth(resolvedMonth);
          return;
        }

        throw new Error('Optimasi dashboard belum tersedia. Jalankan SQL agregasi Supabase lalu coba kembali.');
      } catch (err) {
        if (currentFetchId !== fetchIdRef.current) return;
        console.error(err);
        setChartData([]);
        setFetchError(err.message || 'Data pengangkutan tidak dapat dimuat.');
      } finally {
        if (currentFetchId === fetchIdRef.current) setLoading(false);
      }
    };
    fetchAll();

    return () => {
      fetchIdRef.current += 1;
    };
  }, [selectedMonth, reloadCount]);

  const cards = [
    { label: 'Total Limbah Masuk — Semua Waktu', value: `${summary.masuk} Kg`, icon: 'fa-plus-circle', color: 'border-blue-500', iconBg: 'bg-blue-100 text-blue-500' },
    { label: 'Total Diangkut — Semua Waktu', value: `${summary.diangkut} Kg`, icon: 'fa-truck', color: 'border-orange-500', iconBg: 'bg-orange-100 text-orange-500' },
    { label: 'Sisa Limbah Saat Ini', value: `${summary.sisa} Kg`, icon: 'fa-biohazard', color: parseFloat(summary.sisa) > 0 ? 'border-red-500' : 'border-green-500', iconBg: parseFloat(summary.sisa) > 0 ? 'bg-red-100 text-red-500' : 'bg-green-100 text-green-500', mobileSpan: 'col-span-2 md:col-span-1' },
  ];

  if (loading) {
    return <DashboardSkeleton cards={3} />;
  }

  if (fetchError) {
    return <ErrorState description={fetchError} onRetry={() => setReloadCount(value => value + 1)} />;
  }

  return (
    <div className="animate-fade-in">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4 mb-8">
        {cards.map(c => (
          <div key={c.label} className={`bg-white p-4 sm:p-6 rounded-lg shadow-sm border-b-4 ${c.color} ${c.mobileSpan || ''} hover:shadow-md transition-shadow`}>
            <div className="flex justify-between items-center gap-2">
              <div className="min-w-0">
                <p className="text-[10px] sm:text-xs text-gray-500 font-bold uppercase tracking-wide sm:tracking-wider leading-tight">{c.label}</p>
                <h3 className="text-lg sm:text-2xl font-black text-gray-800 mt-1 truncate">{c.value}</h3>
              </div>
              <div className={`w-9 h-9 sm:w-12 sm:h-12 shrink-0 rounded-full flex items-center justify-center text-base sm:text-xl shadow-inner ${c.iconBg}`}>
                <i className={`fas ${c.icon}`}></i>
              </div>
            </div>
          </div>
        ))}
      </div>

      {chartData.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100">
          <EmptyState title="Belum ada data pengangkutan" description="Grafik akan muncul setelah limbah masuk dan pengangkutan dicatat." icon="fas fa-truck" />
        </div>
      ) : (
        <>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 bg-white p-4 rounded-xl shadow-sm border border-gray-100">
            <div className="flex items-center mb-3 sm:mb-0">
              <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center mr-3">
                <i className="fas fa-calendar-alt text-blue-500 text-lg"></i>
              </div>
              <div>
                <h3 className="text-gray-800 font-bold text-sm">Periode Laporan</h3>
                <p className="text-xs text-gray-500 font-medium">Pilih bulan untuk melihat grafik</p>
              </div>
            </div>
            <div className="relative">
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="appearance-none w-full sm:w-auto bg-blue-50/50 border border-blue-200 text-blue-700 font-bold px-5 py-2.5 pr-12 rounded-xl shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all cursor-pointer hover:bg-blue-100/50"
              >
                {availableMonths.map(month => {
                  const [year, monthNum] = month.split('-');
                  const label = new Date(Number(year), Number(monthNum) - 1).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
                  return (
                    <option key={month} value={month} className="bg-white text-gray-700 font-medium">{label}</option>
                  );
                })}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-blue-500">
                <i className="fas fa-chevron-down text-sm"></i>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Bar Chart: masuk vs diangkut */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-shadow">
              <h3 className="text-sm font-bold text-gray-700 mb-6 flex items-center">
                <span className="w-8 h-8 rounded-lg bg-blue-50 text-blue-500 flex items-center justify-center mr-3"><i className="fas fa-chart-bar"></i></span>
                Limbah Masuk vs Diangkut (Harian)
              </h3>
              <div className="h-72">
                {chartReady ? (
                  <ResponsiveContainer width="99%" height="100%" minWidth={1} minHeight={1}>
                    <BarChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="tanggal" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                      <Tooltip formatter={(v) => `${v} Kg`} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                      <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                      <Bar dataKey="masuk" name="Masuk" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={40} />
                      <Bar dataKey="diangkut" name="Diangkut" fill="#f97316" radius={[4, 4, 0, 0]} maxBarSize={40} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : null}
              </div>
            </div>

            {/* Line Chart: sisa kumulatif */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-shadow">
              <h3 className="text-sm font-bold text-gray-700 mb-6 flex items-center">
                <span className="w-8 h-8 rounded-lg bg-red-50 text-red-500 flex items-center justify-center mr-3"><i className="fas fa-chart-line"></i></span>
                Sisa Limbah Kumulatif (Stok)
              </h3>
              <div className="h-72">
                {chartReady ? (
                  <ResponsiveContainer width="99%" height="100%" minWidth={1} minHeight={1}>
                    <LineChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="tanggal" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                      <Tooltip formatter={(v) => `${v} Kg`} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                      <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                      <ReferenceLine y={0} stroke="#cbd5e1" strokeDasharray="4 4" />
                      <Line type="monotone" dataKey="sisa" name="Sisa Limbah" stroke="#ef4444" strokeWidth={3} dot={{ r: 0 }} activeDot={{ r: 6, strokeWidth: 0 }} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : null}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
