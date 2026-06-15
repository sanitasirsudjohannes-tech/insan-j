import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, AreaChart, Area
} from 'recharts';

export default function TabJenisLimbah() {
  const [loading, setLoading] = useState(true);
  const [dailyData, setDailyData] = useState([]);
  const [monthlyData, setMonthlyData] = useState([]);
  const [summary, setSummary] = useState({ infeksius: 0, jarum: 0, botol: 0, sito: 0 });
  const [chartReady, setChartReady] = useState(false);

  useEffect(() => {
    if (!loading) {
      const timer = setTimeout(() => setChartReady(true), 150);
      return () => clearTimeout(timer);
    } else {
      setChartReady(false);
    }
  }, [loading]);

  useEffect(() => {
    const fetchLimbah = async () => {
      setLoading(true);
      try {
        const { data: rows, error } = await supabase
          .from('limbah_padat')
          .select('tanggal, infeksius, jarum_suntik, botol_obat, sitotoksik')
          .order('tanggal', { ascending: true });

        if (error) throw error;

        // Process daily data (last 30 days of data)
        const dailyMap = {};
        const monthlyMap = {};

        (rows || []).forEach(row => {
          const tgl = row.tanggal;
          const inf = parseFloat(row.infeksius) || 0;
          const jar = parseFloat(row.jarum_suntik) || 0;
          const bot = parseFloat(row.botol_obat) || 0;
          const sit = parseFloat(row.sitotoksik) || 0;
          const total = inf + jar + bot + sit;

          // For daily
          dailyMap[tgl] = {
            tanggal: new Date(tgl).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }),
            rawDate: tgl,
            infeksius: inf,
            jarum_suntik: jar,
            botol_obat: bot,
            sitotoksik: sit,
            total
          };

          // For monthly
          const monthKey = tgl.substring(0, 7); // YYYY-MM
          if (!monthlyMap[monthKey]) {
            const dateObj = new Date(tgl);
            const monthName = dateObj.toLocaleDateString('id-ID', { month: 'short', year: 'numeric' });
            monthlyMap[monthKey] = { label: monthName, key: monthKey, total: 0 };
          }
          monthlyMap[monthKey].total += total;
        });

        const sortedDaily = Object.values(dailyMap).sort((a, b) => a.rawDate.localeCompare(b.rawDate));
        setDailyData(sortedDaily.slice(-30)); // last 30 days

        const sortedMonthly = Object.values(monthlyMap).sort((a, b) => a.key.localeCompare(b.key));
        setMonthlyData(sortedMonthly.slice(-12)); // last 12 months

        // Calculate total summary overall
        let tInf = 0, tJar = 0, tBot = 0, tSit = 0;
        (rows || []).forEach(r => {
          tInf += parseFloat(r.infeksius) || 0;
          tJar += parseFloat(r.jarum_suntik) || 0;
          tBot += parseFloat(r.botol_obat) || 0;
          tSit += parseFloat(r.sitotoksik) || 0;
        });
        setSummary({
          infeksius: tInf.toFixed(2),
          jarum: tJar.toFixed(2),
          botol: tBot.toFixed(2),
          sito: tSit.toFixed(2)
        });

      } catch (error) {
        console.error("Error fetching limbah jenis:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchLimbah();
  }, []);

  const types = React.useMemo(() => [
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

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Grafik Limbah Harian Berdasarkan Jenis */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-shadow">
          <h3 className="text-sm font-bold text-gray-700 mb-6 flex items-center">
            <span className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-500 flex items-center justify-center mr-3"><i className="fas fa-layer-group"></i></span>
            Limbah Harian (Berdasarkan Jenis)
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
                    formatter={(val, name) => [`${val} Kg`, name.replace('_', ' ')]}
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
            Total Limbah Per Bulan
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
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    formatter={(val) => [`${parseFloat(val).toFixed(2)} Kg`, 'Total Limbah']}
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
