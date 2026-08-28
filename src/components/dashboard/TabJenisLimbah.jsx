import { useState, useEffect, useMemo, useRef } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, AreaChart, Area
} from 'recharts';

import { fetchWasteRows } from '../../lib/wasteQueries';
import { fetchDatabaseAggregation } from '../../lib/databaseAggregations';

export default function TabJenisLimbah() {
  const currentYear = String(new Date().getFullYear());
  const [loading, setLoading] = useState(true);
  const [dailyData, setDailyData] = useState([]);
  const [monthlyData, setMonthlyData] = useState([]);
  const [summary, setSummary] = useState({ infeksius: 0, jarum: 0, botol: 0, sito: 0 });
  const [chartReady, setChartReady] = useState(false);
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedMonth, setSelectedMonth] = useState('');
  const [availableYears, setAvailableYears] = useState([currentYear]);
  const [averages, setAverages] = useState({ total: 0, daily: 0, monthly: 0, activeDays: 0, activeMonths: 0 });
  const fetchIdRef = useRef(0);

  useEffect(() => {
    if (!loading) {
      const timer = setTimeout(() => setChartReady(true), 150);
      return () => clearTimeout(timer);
    } else {
      setChartReady(false);
    }
  }, [loading]);

  useEffect(() => {
    const currentFetchId = ++fetchIdRef.current;
    const fetchLimbah = async () => {
      setLoading(true);
      try {
        const aggregated = await fetchDatabaseAggregation('dashboard_jenis_limbah_summary', {
          requested_year: Number(selectedYear),
          requested_month: selectedMonth ? Number(selectedMonth) : null,
        });

        if (currentFetchId !== fetchIdRef.current) return;

        if (aggregated) {
          const resolvedYear = String(aggregated.selectedYear || selectedYear);
          const years = [...new Set([
            ...(aggregated.availableYears || []).map(String),
            resolvedYear,
          ])].sort((a, b) => b.localeCompare(a));

          setAvailableYears(years);
          setDailyData((aggregated.daily || []).map(row => ({
            tanggal: new Date(row.tanggal).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }),
            rawDate: row.tanggal,
            infeksius: Number(row.infeksius) || 0,
            jarum_suntik: Number(row.jarum_suntik) || 0,
            botol_obat: Number(row.botol_obat) || 0,
            sitotoksik: Number(row.sitotoksik) || 0,
            total: (Number(row.infeksius) || 0) + (Number(row.jarum_suntik) || 0)
              + (Number(row.botol_obat) || 0) + (Number(row.sitotoksik) || 0),
          })));
          setMonthlyData((aggregated.monthly || []).map(row => ({
            label: new Date(`${row.bulan}-01`).toLocaleDateString('id-ID', { month: 'short', year: 'numeric' }),
            key: row.bulan,
            total: Number(row.total) || 0,
          })));
          setSummary({
            infeksius: Math.round(Number(aggregated.summary?.infeksius) || 0),
            jarum: Math.round(Number(aggregated.summary?.jarum_suntik) || 0),
            botol: Math.round(Number(aggregated.summary?.botol_obat) || 0),
            sito: Math.round(Number(aggregated.summary?.sitotoksik) || 0),
          });
          setAverages({
            total: Number(aggregated.totalWaste) || 0,
            daily: Number(aggregated.dailyAverage) || 0,
            monthly: aggregated.monthlyAverage == null ? null : Number(aggregated.monthlyAverage) || 0,
            activeDays: Number(aggregated.activeDays) || 0,
            activeMonths: Number(aggregated.activeMonths) || 0,
          });
          if (resolvedYear !== selectedYear) setSelectedYear(resolvedYear);
          return;
        }

        const targetYear = Number(selectedYear);
        const monthNumber = selectedMonth ? Number(selectedMonth) : null;
        const startDate = monthNumber
          ? `${targetYear}-${String(monthNumber).padStart(2, '0')}-01`
          : `${targetYear}-01-01`;
        const nextMonth = monthNumber === 12 ? 1 : monthNumber + 1;
        const endDate = monthNumber
          ? `${monthNumber === 12 ? targetYear + 1 : targetYear}-${String(nextMonth).padStart(2, '0')}-01`
          : `${targetYear + 1}-01-01`;
        const [{ padatRows, ruanganRows }, yearlySummary] = await Promise.all([
          fetchWasteRows({ startDate, endDate }),
          fetchDatabaseAggregation('rekap_limbah_yearly_summary', {
            requested_year: targetYear,
          }),
        ]);

        if (currentFetchId !== fetchIdRef.current) return;
        setAvailableYears([...new Set([
          ...(yearlySummary?.availableYears || []).map(String),
          selectedYear,
        ])].sort((a, b) => b.localeCompare(a)));

        const dailyMap = {};
        const monthlyMap = {};

        // Fungsi bantu untuk menggabungkan (sum) satu baris ke dalam dailyMap & monthlyMap
        const accumulateRow = (row) => {
          const tgl = row.tanggal;
          if (!tgl) return;

          const inf = parseFloat(row.infeksius) || 0;
          const jar = parseFloat(row.jarum_suntik) || 0;
          const bot = parseFloat(row.botol_obat) || 0;
          const sit = parseFloat(row.sitotoksik) || 0;

          // Daily
          if (!dailyMap[tgl]) {
            dailyMap[tgl] = {
              tanggal: new Date(tgl).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }),
              rawDate: tgl,
              infeksius: 0,
              jarum_suntik: 0,
              botol_obat: 0,
              sitotoksik: 0,
              total: 0
            };
          }
          dailyMap[tgl].infeksius += inf;
          dailyMap[tgl].jarum_suntik += jar;
          dailyMap[tgl].botol_obat += bot;
          dailyMap[tgl].sitotoksik += sit;
          dailyMap[tgl].total += inf + jar + bot + sit;

          // Monthly
          const monthKey = tgl.substring(0, 7); // YYYY-MM
          if (!monthlyMap[monthKey]) {
            const dateObj = new Date(tgl);
            const monthName = dateObj.toLocaleDateString('id-ID', { month: 'short', year: 'numeric' });
            monthlyMap[monthKey] = { label: monthName, key: monthKey, total: 0 };
          }
          monthlyMap[monthKey].total += inf + jar + bot + sit;
        };

        (padatRows || []).forEach(accumulateRow);
        (ruanganRows || []).forEach(accumulateRow);

        const sortedDaily = Object.values(dailyMap).sort((a, b) => a.rawDate.localeCompare(b.rawDate));
        setDailyData(sortedDaily.slice(-30)); // last 30 days

        const sortedMonthly = Object.values(monthlyMap).sort((a, b) => a.key.localeCompare(b.key));
        setMonthlyData(sortedMonthly); // maksimal 12 bulan pada tahun terpilih

        // Total ringkasan hanya untuk tahun yang sedang dipilih.
        let tInf = 0, tJar = 0, tBot = 0, tSit = 0;
        [...(padatRows || []), ...(ruanganRows || [])].forEach(r => {
          tInf += parseFloat(r.infeksius) || 0;
          tJar += parseFloat(r.jarum_suntik) || 0;
          tBot += parseFloat(r.botol_obat) || 0;
          tSit += parseFloat(r.sitotoksik) || 0;
        });
        setSummary({
          infeksius: Math.round(tInf),
          jarum: Math.round(tJar),
          botol: Math.round(tBot),
          sito: Math.round(tSit)
        });
        const total = tInf + tJar + tBot + tSit;
        const activeDays = Object.keys(dailyMap).length;
        const activeMonths = Object.keys(monthlyMap).length;
        setAverages({
          total,
          daily: activeDays ? total / activeDays : 0,
          monthly: monthNumber ? null : (activeMonths ? total / activeMonths : 0),
          activeDays,
          activeMonths,
        });

      } catch (error) {
        if (currentFetchId !== fetchIdRef.current) return;
        console.error("Error fetching limbah jenis:", error);
      } finally {
        if (currentFetchId === fetchIdRef.current) setLoading(false);
      }
    };
    fetchLimbah();

    return () => {
      fetchIdRef.current += 1;
    };
  }, [selectedYear, selectedMonth]);

  const monthNames = useMemo(() => [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ], []);

  const periodLabel = selectedMonth
    ? `${monthNames[Number(selectedMonth) - 1]} ${selectedYear}`
    : `Tahun ${selectedYear}`;

  const formatKg = (value) => new Intl.NumberFormat('id-ID', {
    maximumFractionDigits: 2,
  }).format(Number(value) || 0);

  const types = useMemo(() => [
    { key: 'infeksius', label: 'Infeksius', color: '#ef4444', icon: 'fa-viruses' },
    { key: 'jarum_suntik', label: 'Jarum Suntik', color: '#f59e0b', icon: 'fa-syringe' },
    { key: 'botol_obat', label: 'Botol Obat', color: '#3b82f6', icon: 'fa-pills' },
    { key: 'sitotoksik', label: 'Sitotoksik', color: '#8b5cf6', icon: 'fa-skull-crossbones' }
  ], []);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <i className="fas fa-spinner fa-spin text-blue-500 text-4xl"></i>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">
            <i className="fas fa-layer-group mr-1.5 text-indigo-500" />
            Jenis dan Tren Limbah
          </p>
          <p className="text-lg font-black text-gray-800 mt-0.5">{periodLabel}</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <i className="fas fa-calendar-alt text-gray-400" />
          </div>
          <select
            value={selectedYear}
            onChange={(event) => {
              setSelectedYear(event.target.value);
              setSelectedMonth('');
            }}
            className="appearance-none w-full sm:w-40 pl-10 pr-10 py-2.5 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-shadow text-gray-700 font-semibold shadow-sm text-sm"
            aria-label="Pilih tahun jenis dan tren limbah"
          >
            {availableYears.map(year => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
            <i className="fas fa-chevron-down text-gray-400 text-xs" />
          </div>
        </div>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <i className="fas fa-calendar-day text-gray-400" />
          </div>
          <select
            value={selectedMonth}
            onChange={(event) => setSelectedMonth(event.target.value)}
            className="appearance-none w-full sm:w-44 pl-10 pr-10 py-2.5 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-shadow text-gray-700 font-semibold shadow-sm text-sm"
            aria-label="Pilih bulan jenis dan tren limbah"
          >
            <option value="">Semua bulan</option>
            {monthNames.map((month, index) => (
              <option key={month} value={index + 1}>{month}</option>
            ))}
          </select>
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
            <i className="fas fa-chevron-down text-gray-400 text-xs" />
          </div>
        </div>
        </div>
      </div>

      {/* Summary per jenis limbah */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Infeksius', val: summary.infeksius, color: 'text-red-500', bg: 'bg-red-50', icon: 'fa-viruses' },
          { label: 'Jarum Suntik', val: summary.jarum, color: 'text-amber-500', bg: 'bg-amber-50', icon: 'fa-syringe' },
          { label: 'Botol Obat', val: summary.botol, color: 'text-blue-500', bg: 'bg-blue-50', icon: 'fa-pills' },
          { label: 'Sitotoksik', val: summary.sito, color: 'text-purple-500', bg: 'bg-purple-50', icon: 'fa-skull-crossbones' }
        ].map((item, idx) => (
          <div key={idx} className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex flex-col items-center justify-center text-center hover:shadow-md transition-shadow">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-3 ${item.bg} ${item.color}`}>
              <i className={`fas ${item.icon}`}></i>
            </div>
            <p className="text-xs text-gray-500 font-bold uppercase tracking-wide">{item.label}</p>
            <h3 className={`text-xl font-black mt-1 ${item.color}`}>{item.val} <span className="text-xs font-normal text-gray-400">Kg</span></h3>
          </div>
        ))}
      </div>

      <div className={`grid ${selectedMonth ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1 sm:grid-cols-3'} gap-4 mb-8`}>
        <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Total periode</p>
          <p className="text-2xl font-black text-gray-800 mt-1">{formatKg(averages.total)} <span className="text-xs font-normal text-gray-400">Kg</span></p>
        </div>
        <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Rata-rata per hari tercatat</p>
          <p className="text-2xl font-black text-indigo-600 mt-1">{formatKg(averages.daily)} <span className="text-xs font-normal text-gray-400">Kg/hari</span></p>
          <p className="text-xs text-gray-400 mt-1">Berdasarkan {averages.activeDays} hari dengan data</p>
        </div>
        {!selectedMonth && (
          <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Rata-rata per bulan tercatat</p>
            <p className="text-2xl font-black text-emerald-600 mt-1">{formatKg(averages.monthly)} <span className="text-xs font-normal text-gray-400">Kg/bulan</span></p>
            <p className="text-xs text-gray-400 mt-1">Berdasarkan {averages.activeMonths} bulan dengan data</p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Grafik Limbah Harian Berdasarkan Jenis */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-shadow">
          <h3 className="text-sm font-bold text-gray-700 mb-6 flex items-center">
            <span className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-500 flex items-center justify-center mr-3"><i className="fas fa-layer-group"></i></span>
            Limbah Harian {periodLabel}{selectedMonth ? '' : ' (30 Hari Terakhir)'}
          </h3>
          <div className="h-80">
            {dailyData.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-gray-400">
                <i className="fas fa-inbox text-4xl mb-3 opacity-30"></i>
                <p>Belum ada data</p>
              </div>
            ) : chartReady ? (
              <ResponsiveContainer width="99%" height="100%" minWidth={1} minHeight={1}>
                <BarChart data={dailyData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="tanggal" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    formatter={(val, name) => [`${Math.round(val)} Kg`, name.replace('_', ' ')]}
                  />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                  {types.map((type) => (
                    <Bar key={type.key} dataKey={type.key} name={type.label} stackId="a" fill={type.color} maxBarSize={40} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            ) : null}
          </div>
        </div>

        {/* Grafik Total Limbah Per Bulan */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-shadow">
          <h3 className="text-sm font-bold text-gray-700 mb-6 flex items-center">
            <span className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-500 flex items-center justify-center mr-3"><i className="fas fa-calendar-alt"></i></span>
            Total Limbah Per Bulan — {periodLabel}
          </h3>
          <div className="h-80">
            {monthlyData.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-gray-400">
                <i className="fas fa-inbox text-4xl mb-3 opacity-30"></i>
                <p>Belum ada data</p>
              </div>
            ) : chartReady ? (
              <ResponsiveContainer width="99%" height="100%" minWidth={1} minHeight={1}>
                <AreaChart data={monthlyData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                  <defs>
                    <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    formatter={(val) => [`${Math.round(val)} Kg`, 'Total Limbah']}
                  />
                  <Area type="monotone" dataKey="total" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorTotal)" activeDot={{ r: 6, strokeWidth: 0 }} />
                </AreaChart>
              </ResponsiveContainer>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
