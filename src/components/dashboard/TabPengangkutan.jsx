import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, LineChart, Line, ReferenceLine
} from 'recharts';

export default function TabPengangkutan() {
  const [chartData, setChartData] = useState([]);
  const [allData, setAllData] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState('');
  const [summary, setSummary] = useState({ masuk: 0, diangkut: 0, sisa: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      try {
        const { data: limbahRows } = await supabase
          .from('limbah_padat')
          .select('tanggal, infeksius, jarum_suntik, botol_obat, sitotoksik')
          .order('tanggal', { ascending: true });

        const { data: angkutRows } = await supabase
          .from('pengangkutan_limbah')
          .select('tanggal, jumlah_kg')
          .order('tanggal', { ascending: true });

        const limbahMap = {};
        (limbahRows || []).forEach(row => {
          const key = row.tanggal;
          const total = (row.infeksius || 0) + (row.jarum_suntik || 0) + (row.botol_obat || 0) + (row.sitotoksik || 0);
          limbahMap[key] = (limbahMap[key] || 0) + total;
        });

        const angkutMap = {};
        (angkutRows || []).forEach(row => {
          angkutMap[row.tanggal] = (angkutMap[row.tanggal] || 0) + (parseFloat(row.jumlah_kg) || 0);
        });

        const allDates = [...new Set([...Object.keys(limbahMap), ...Object.keys(angkutMap)])].sort();

        let kumulatifSisa = 0;
        const combined = allDates.map(date => {
        const masuk = limbahMap[date] || 0;
        const diangkut = angkutMap[date] || 0;

        kumulatifSisa += masuk - diangkut;

        const d = new Date(date);

        return {
          fullDate: date,
          bulanTahun: `${d.getFullYear()}-${String(
            d.getMonth() + 1
          ).padStart(2, '0')}`,
          tanggal: d.toLocaleDateString('id-ID', {
            day: 'numeric',
            month: 'short'
          }),
          masuk: parseFloat(masuk.toFixed(2)),
          diangkut: parseFloat(diangkut.toFixed(2)),
          sisa: parseFloat(kumulatifSisa.toFixed(2)),
        };
      });

      setAllData(combined);

      if (combined.length > 0) {
        const latestMonth = combined[combined.length - 1].bulanTahun;
        setSelectedMonth(latestMonth);

        setChartData(
          combined.filter(item => item.bulanTahun === latestMonth)
        );
      }
        const totalMasuk = Object.values(limbahMap).reduce((a, b) => a + b, 0);
        const totalAngkut = Object.values(angkutMap).reduce((a, b) => a + b, 0);
        setSummary({
          masuk: totalMasuk.toFixed(2),
          diangkut: totalAngkut.toFixed(2),
          sisa: (totalMasuk - totalAngkut).toFixed(2)
        });
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, []);

  useEffect(() => {
    if (!selectedMonth || !allData.length) return;

    const filtered = allData.filter(
      item => item.bulanTahun === selectedMonth
    );

    setChartData(filtered);
  }, [selectedMonth, allData]);

  const availableMonths = [
    ...new Set(allData.map(item => item.bulanTahun))
  ];

  const cards = [
    { label: 'Total Limbah Masuk', value: `${summary.masuk} Kg`, icon: 'fa-plus-circle', color: 'border-blue-500', iconBg: 'bg-blue-100 text-blue-500' },
    { label: 'Total Diangkut', value: `${summary.diangkut} Kg`, icon: 'fa-truck', color: 'border-orange-500', iconBg: 'bg-orange-100 text-orange-500' },
    { label: 'Sisa Limbah', value: `${summary.sisa} Kg`, icon: 'fa-biohazard', color: parseFloat(summary.sisa) > 0 ? 'border-red-500' : 'border-green-500', iconBg: parseFloat(summary.sisa) > 0 ? 'bg-red-100 text-red-500' : 'bg-green-100 text-green-500' },
  ];

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <i className="fas fa-spinner fa-spin text-blue-500 text-4xl"></i>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {cards.map(c => (
          <div key={c.label} className={`bg-white p-6 rounded-lg shadow-sm border-b-4 ${c.color} hover:shadow-md transition-shadow`}>
            <div className="flex justify-between items-center">
              <div>
                <p className="text-xs text-gray-500 font-bold uppercase tracking-wider">{c.label}</p>
                <h3 className="text-2xl font-black text-gray-800 mt-1">{c.value}</h3>
              </div>
              <div className={`w-12 h-12 rounded-full flex items-center justify-center text-xl shadow-inner ${c.iconBg}`}>
                <i className={`fas ${c.icon}`}></i>
              </div>
            </div>
          </div>
        ))}
      </div>

      {chartData.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm p-8 text-center border border-gray-100">
          <i className="fas fa-inbox text-gray-300 text-5xl mb-4"></i>
          <p className="text-gray-500 font-medium">Belum ada data limbah.</p>
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
              <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
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
            </div>
          </div>

          {/* Line Chart: sisa kumulatif */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-shadow">
            <h3 className="text-sm font-bold text-gray-700 mb-6 flex items-center">
              <span className="w-8 h-8 rounded-lg bg-red-50 text-red-500 flex items-center justify-center mr-3"><i className="fas fa-chart-line"></i></span>
              Sisa Limbah Kumulatif (Stok)
            </h3>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
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
            </div>
          </div>
        </div>
        </>
      )}
    </div>
  );
}
