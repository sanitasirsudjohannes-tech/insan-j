import { useEffect, useRef, useState } from 'react';
import { supabase } from '../../lib/supabase';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, AreaChart, Area
} from 'recharts';

// Jenis limbah anorganik beserta satuan masing-masing
const ANORGANIK_TYPES = [
  { key: 'infus',         label: 'Infus',        color: '#3b82f6', icon: 'fa-tint',                satuan: 'Kg'   },
  { key: 'jerigen',       label: 'Jerigen',      color: '#f59e0b', icon: 'fa-prescription-bottle', satuan: 'Buah' },
  { key: 'kertas',        label: 'Kertas',       color: '#64748b', icon: 'fa-file-alt',            satuan: 'Kg'   },
  { key: 'kardus',        label: 'Kardus',       color: '#ea580c', icon: 'fa-box-open',            satuan: 'Kg'   },
  { key: 'botol_mineral', label: 'Botol Mineral',color: '#06b6d4', icon: 'fa-wine-bottle',         satuan: 'Kg'   },
  { key: 'bayclin_dll',   label: 'Bayclin dll',  color: '#8b5cf6', icon: 'fa-flask',               satuan: 'Kg'   },
];

const MONTH_NAMES = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];

function formatMonthLabel(yyyyMm) {
  if (!yyyyMm) return '';
  const [y, m] = yyyyMm.split('-');
  return `${MONTH_NAMES[parseInt(m, 10) - 1]} ${y}`;
}

export default function TabAnorganik() {
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [summary, setSummary] = useState({});
  const [dailyData, setDailyData] = useState([]);
  const [monthlyData, setMonthlyData] = useState([]);
  const [chartReady, setChartReady] = useState(false);
  const [fetchError, setFetchError] = useState('');
  const [reloadCount, setReloadCount] = useState(0);
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

    const fetchAnorganik = async () => {
      setLoading(true);
      setFetchError('');
      try {
        if (!selectedMonth) throw new Error('Silakan pilih bulan terlebih dahulu.');

        // Build date range for the selected month
        const [y, m] = selectedMonth.split('-');
        const start = `${y}-${m}-01`;
        const end   = `${y}-${m}-${String(new Date(+y, +m, 0).getDate()).padStart(2, '0')}`;

        const [filteredResult, allResult] = await Promise.all([
          supabase
            .from('limbah_anorganik')
            .select('tanggal, infus, jerigen, kertas, kardus, botol_mineral, bayclin_dll')
            .gte('tanggal', start)
            .lte('tanggal', end)
            .order('tanggal', { ascending: true }),
          supabase
            .from('limbah_anorganik')
            .select('tanggal, infus, jerigen, kertas, kardus, botol_mineral, bayclin_dll')
            .order('tanggal', { ascending: true }),
        ]);

        if (currentFetchId !== fetchIdRef.current) return;

        const { data: filteredRows, error: errF } = filteredResult;
        if (errF) throw errF;

        const { data: allRows, error: errA } = allResult;
        if (errA) throw errA;

        // ── Process filtered rows ──────────────────────────────────────
        const dailyMap = {};
        const totals   = {};

        (filteredRows || []).forEach(row => {
          const tgl = row.tanggal;
          if (!tgl) return;

          ANORGANIK_TYPES.forEach(t => {
            const val = parseFloat(row[t.key]) || 0;
            totals[t.key] = (totals[t.key] || 0) + val;
          });

          if (!dailyMap[tgl]) {
            dailyMap[tgl] = {
              tanggal: new Date(tgl).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }),
              rawDate: tgl,
              total: 0,
            };
            ANORGANIK_TYPES.forEach(t => { dailyMap[tgl][t.key] = 0; });
          }
          ANORGANIK_TYPES.forEach(t => {
            const val = parseFloat(row[t.key]) || 0;
            dailyMap[tgl][t.key] += val;
            if (t.satuan === 'Kg') dailyMap[tgl].total += val;
          });
        });

        const sortedDaily = Object.values(dailyMap).sort((a, b) => a.rawDate.localeCompare(b.rawDate));

        // ── Process all rows for monthly trend ────────────────────────
        const monthlyMap = {};
        (allRows || []).forEach(row => {
          const tgl = row.tanggal;
          if (!tgl) return;
          const mk = tgl.substring(0, 7);
          if (!monthlyMap[mk]) {
            monthlyMap[mk] = {
              label: new Date(tgl).toLocaleDateString('id-ID', { month: 'short', year: 'numeric' }),
              key: mk,
              total: 0,
            };
          }
          ANORGANIK_TYPES.forEach(t => {
            if (t.satuan === 'Kg') monthlyMap[mk].total += parseFloat(row[t.key]) || 0;
          });
        });

        const sortedMonthly = Object.values(monthlyMap).sort((a, b) => a.key.localeCompare(b.key));
        if (currentFetchId !== fetchIdRef.current) return;

        setDailyData(sortedDaily);
        setSummary(totals);
        setMonthlyData(sortedMonthly.slice(-12));

      } catch (err) {
        if (currentFetchId !== fetchIdRef.current) return;

        console.error('Error fetching limbah anorganik dashboard:', err);
        setSummary({});
        setDailyData([]);
        setMonthlyData([]);
        setFetchError(err.message || 'Data dashboard tidak dapat dimuat.');
      } finally {
        if (currentFetchId === fetchIdRef.current) setLoading(false);
      }
    };

    fetchAnorganik();

    return () => {
      fetchIdRef.current += 1;
    };
  }, [selectedMonth, reloadCount]);

  return (
    <div className="animate-fade-in">
      {/* ── Month Picker Header ──────────────────────────────────────── */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">
            <i className="fas fa-recycle mr-1.5 text-cyan-500" />
            Dashboard Limbah Anorganik
          </p>
          <p className="text-lg font-black text-gray-800 mt-0.5">{formatMonthLabel(selectedMonth)}</p>
        </div>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <i className="fas fa-calendar-alt text-gray-400" />
          </div>
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none transition-shadow text-gray-700 font-semibold shadow-sm text-sm w-full sm:w-auto"
          />
        </div>
      </div>

      {/* ── Summary Cards ─────────────────────────────────────────────── */}
      {loading ? (
        <div className="flex justify-center py-16">
          <i className="fas fa-spinner fa-spin text-cyan-500 text-4xl" />
        </div>
      ) : fetchError ? (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl px-5 py-8 text-center">
          <i className="fas fa-exclamation-triangle text-rose-500 text-3xl mb-3" />
          <p className="font-bold text-rose-800">Data dashboard tidak dapat dimuat</p>
          <p className="text-sm text-rose-600 mt-1">{fetchError}</p>
          <button
            type="button"
            onClick={() => setReloadCount(value => value + 1)}
            className="mt-4 bg-rose-600 hover:bg-rose-700 text-white px-4 py-2 rounded-xl text-sm font-semibold transition"
          >
            <i className="fas fa-redo-alt mr-2" />Coba Lagi
          </button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4 mb-8">
            {ANORGANIK_TYPES.map(t => (
              <div
                key={t.key}
                className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col items-center text-center hover:shadow-md transition-shadow"
              >
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center mb-2"
                  style={{ backgroundColor: `${t.color}18`, color: t.color }}
                >
                  <i className={`fas ${t.icon}`} />
                </div>
                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wide leading-tight mb-1">{t.label}</p>
                <h3 className="text-lg font-black" style={{ color: t.color }}>
                  {t.satuan === 'Buah'
                    ? Math.round(summary[t.key] || 0)
                    : ((summary[t.key] || 0).toFixed ? (summary[t.key] || 0).toFixed(1) : '0')}
                  <span className="text-[10px] font-normal text-gray-400 ml-0.5">{t.satuan}</span>
                </h3>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {/* Grafik Harian per Jenis – scoped to selected month */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-shadow">
              <h3 className="text-sm font-bold text-gray-700 mb-6 flex items-center">
                <span className="w-8 h-8 rounded-lg bg-cyan-50 text-cyan-500 flex items-center justify-center mr-3">
                  <i className="fas fa-layer-group" />
                </span>
                Harian — {formatMonthLabel(selectedMonth)}
              </h3>
              <div className="h-80">
                {dailyData.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-gray-400">
                    <i className="fas fa-inbox text-4xl mb-3 opacity-30" />
                    <p className="text-sm">Belum ada data bulan ini</p>
                  </div>
                ) : chartReady ? (
                  <ResponsiveContainer width="99%" height="100%" minWidth={1} minHeight={1}>
                    <BarChart data={dailyData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="tanggal" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                      <Tooltip
                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                        formatter={(val, name) => {
                          const type = ANORGANIK_TYPES.find(item => item.label === name);
                          return [`${Math.round(val * 100) / 100} ${type?.satuan || ''}`, name];
                        }}
                      />
                      <Legend iconType="circle" wrapperStyle={{ fontSize: '10px', paddingTop: '10px' }} />
                      {ANORGANIK_TYPES.map(t => (
                        <Bar key={t.key} dataKey={t.key} name={t.label} stackId={t.satuan} fill={t.color} maxBarSize={40} />
                      ))}
                    </BarChart>
                  </ResponsiveContainer>
                ) : null}
              </div>
            </div>

            {/* Grafik Total Bulanan – all-time last 12 months */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-shadow">
              <h3 className="text-sm font-bold text-gray-700 mb-6 flex items-center">
                <span className="w-8 h-8 rounded-lg bg-amber-50 text-amber-500 flex items-center justify-center mr-3">
                  <i className="fas fa-calendar-alt" />
                </span>
                Tren Total Bulanan dalam Kg (12 Bulan Terakhir)
              </h3>
              <div className="h-80">
                {monthlyData.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-gray-400">
                    <i className="fas fa-inbox text-4xl mb-3 opacity-30" />
                    <p className="text-sm">Belum ada data</p>
                  </div>
                ) : chartReady ? (
                  <ResponsiveContainer width="99%" height="100%" minWidth={1} minHeight={1}>
                    <AreaChart data={monthlyData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                      <defs>
                        <linearGradient id="colorAnorganik" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                      <Tooltip
                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                        formatter={(val) => [`${Math.round(val * 100) / 100} Kg`, 'Total Anorganik']}
                      />
                      <Area
                        type="monotone"
                        dataKey="total"
                        stroke="#06b6d4"
                        strokeWidth={3}
                        fillOpacity={1}
                        fill="url(#colorAnorganik)"
                        activeDot={{ r: 6, strokeWidth: 0 }}
                      />
                    </AreaChart>
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
