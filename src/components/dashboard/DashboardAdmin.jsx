import { useState, useEffect } from 'react';
import AppLayout from '../AppLayout';
import { supabase } from '../../lib/supabase';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Cell, LabelList } from 'recharts';

export default function DashboardAdmin() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalInspeksi: 0,
    rataKebersihan: 0
  });
  const [chartData, setChartData] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [chartReady, setChartReady] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setChartReady(true), 100);
    return () => clearTimeout(timer);
  }, []);

  const formatMonthYear = (yyyy_mm) => {
    if (!yyyy_mm) return '';
    const [year, month] = yyyy_mm.split('-');
    const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
    return `${months[parseInt(month, 10) - 1]} ${year}`;
  };

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const tables = [
          { name: 'ruang_bangunan', label: 'Bangunan' },
          { name: 'limbah_medis', label: 'Limbah' },
          { name: 'pemeriksaan_toilet', label: 'Toilet' },
          { name: 'pemeriksaan_reservoir', label: 'Reservoir' },
          { name: 'pemeriksaan_gizi', label: 'Gizi' }
        ];

        let startDate, endDate;
        if (selectedMonth) {
          startDate = `${selectedMonth}-01`;
          const dateObj = new Date(startDate);
          dateObj.setMonth(dateObj.getMonth() + 1);
          endDate = dateObj.toISOString().split('T')[0];
        }

        const promises = tables.map(async (table) => {
          let query = supabase.from(table.name).select('persen');

          if (selectedMonth) {
            query = query.gte('tanggal_pemeriksaan', startDate).lt('tanggal_pemeriksaan', endDate);
          }

          const { data, error } = await query;

          if (error) throw new Error(error.message);
          return { label: table.label, data: data || [] };
        });

        const results = await Promise.all(promises);

        let allItems = [];
        const newChartData = [];

        results.forEach(res => {
          const tableData = res.data;
          allItems = [...allItems, ...tableData];

          let avgPersen = 0;
          if (tableData.length > 0) {
            const sum = tableData.reduce((acc, curr) => acc + (parseFloat(curr.persen) || 0), 0);
            avgPersen = Math.round(sum / tableData.length);
          }
          newChartData.push({
            name: res.label,
            nilai: avgPersen,
            jumlah: tableData.length
          });
        });

        const totalInspeksi = allItems.length;

        let sumOverall = 0;

        allItems.forEach(item => {
          sumOverall += parseFloat(item.persen) || 0;
        });

        const rataKebersihan = totalInspeksi > 0 ? Math.round(sumOverall / totalInspeksi) : 0;

        setStats({
          totalInspeksi,
          rataKebersihan
        });
        setChartData(newChartData);

      } catch (err) {
        console.error("Error fetching admin stats:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [selectedMonth]);

  const colors = ['#3b82f6', '#10b981', '#8b5cf6', '#f59e0b', '#6366f1'];

  return (
    <AppLayout title="Dashboard Admin">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8 flex flex-col md:flex-row md:items-center md:justify-between border-b border-gray-100 pb-6">
          <div>
            <h2 className="text-3xl font-extrabold text-gray-800">Dashboard Statistik</h2>
            <p className="text-gray-500 mt-2 font-medium">Ringkasan inspeksi sanitasi RSUD Prof. DR. W.Z. Johannes Kupang pada {selectedMonth ? formatMonthYear(selectedMonth) : 'sepanjang waktu'}</p>
          </div>

          <div className="mt-4 md:mt-0 relative w-full sm:w-auto">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <i className="fas fa-calendar-alt text-gray-400"></i>
            </div>
            <input
              type="month"
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-shadow text-gray-700 font-semibold shadow-sm"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
            />
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
            <i className="fas fa-circle-notch fa-spin text-5xl text-blue-500 mb-4"></i>
            <p className="text-gray-500 font-bold tracking-wide">MENGAMBIL DATA...</p>
          </div>
        ) : (
          <div className="animate-fade-in">
            {/* Scorecards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex items-center hover:shadow-md transition-shadow">
                <div className="bg-blue-50 text-blue-600 w-14 h-14 rounded-xl flex items-center justify-center text-2xl mr-4 shadow-inner"><i className="fas fa-clipboard-check"></i></div>
                <div><p className="text-sm text-gray-500 font-bold mb-1">Total Inspeksi</p><h3 className="text-2xl font-black text-gray-800">{stats.totalInspeksi}</h3></div>
              </div>
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex items-center hover:shadow-md transition-shadow">
                <div className="bg-green-50 text-green-600 w-14 h-14 rounded-xl flex items-center justify-center text-2xl mr-4 shadow-inner"><i className="fas fa-percentage"></i></div>
                <div><p className="text-sm text-gray-500 font-bold mb-1">Rata-rata Kepatuhan</p><h3 className="text-2xl font-black text-gray-800">{stats.rataKebersihan}%</h3></div>
              </div>
            </div>

            {/* Bar Chart */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 md:p-8 hover:shadow-md transition-shadow">
              <h3 className="text-xl font-bold text-gray-800 mb-8 flex items-center"><i className="fas fa-chart-column mr-3 text-indigo-500"></i>Rata-Rata Persentase per Kategori</h3>
              <div className="h-[350px] w-full">
                {stats.totalInspeksi === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-gray-400">
                    <i className="fas fa-folder-open text-5xl mb-4 opacity-40"></i>
                    <p className="font-semibold">Belum ada data bulan ini</p>
                  </div>
                ) : chartReady ? (
                  <ResponsiveContainer width="99%" height="100%" minWidth={1} minHeight={1}>
                    <BarChart data={chartData} margin={{ top: 30, right: 10, left: -20, bottom: 40 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontWeight: '700', fontSize: 11 }} height={60} dy={15} angle={-35} textAnchor="end" />
                      <YAxis domain={[0, 100]} axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontWeight: '600', fontSize: 12 }} dx={-5} />
                      <RechartsTooltip
                        cursor={{ fill: '#f8fafc' }}
                        contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)' }}
                      />
                      <Bar dataKey="nilai" name="Kepatuhan" radius={[12, 12, 0, 0]} maxBarSize={60}>
                        {chartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
                        ))}
                        <LabelList dataKey="nilai" position="top" formatter={(val) => `${val}%`} style={{ fill: '#334155', fontWeight: '900', fontSize: 14 }} dy={-5} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : null}
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
