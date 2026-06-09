import { useState, useEffect } from 'react';
import AppLayout from '../AppLayout';
import { supabase } from '../../lib/supabase';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, LineChart, Line, ReferenceLine
} from 'recharts';

export default function DashboardUser({ user }) {
  const [chartData, setChartData] = useState([]);
  const [summary, setSummary] = useState({ masuk: 0, diangkut: 0, sisa: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      try {
        // Ambil 30 data limbah masuk terbaru
        const { data: limbahRows } = await supabase
          .from('limbah_padat')
          .select('tanggal, infeksius, jarum_suntik, botol_obat, sitotoksik')
          .order('tanggal', { ascending: true })
          .limit(60);

        // Ambil semua pengangkutan
        const { data: angkutRows } = await supabase
          .from('pengangkutan_limbah')
          .select('tanggal, jumlah_kg')
          .order('tanggal', { ascending: true });

        // Agregat limbah masuk per tanggal
        const limbahMap = {};
        (limbahRows || []).forEach(row => {
          const key = row.tanggal;
          const total = (row.infeksius || 0) + (row.jarum_suntik || 0) + (row.botol_obat || 0) + (row.sitotoksik || 0);
          limbahMap[key] = (limbahMap[key] || 0) + total;
        });

        // Agregat pengangkutan per tanggal
        const angkutMap = {};
        (angkutRows || []).forEach(row => {
          angkutMap[row.tanggal] = (angkutMap[row.tanggal] || 0) + (parseFloat(row.jumlah_kg) || 0);
        });

        // Gabungkan semua tanggal unik
        const allDates = [...new Set([...Object.keys(limbahMap), ...Object.keys(angkutMap)])].sort();

        // Hitung kumulatif sisa (net stock)
        let kumulatifSisa = 0;
        const combined = allDates.map(date => {
          const masuk = limbahMap[date] || 0;
          const diangkut = angkutMap[date] || 0;
          kumulatifSisa += masuk - diangkut;
          return {
            tanggal: new Date(date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }),
            masuk: parseFloat(masuk.toFixed(2)),
            diangkut: parseFloat(diangkut.toFixed(2)),
            sisa: parseFloat(kumulatifSisa.toFixed(2)),
          };
        });

        // Ambil 30 hari terakhir untuk chart
        const recent = combined.slice(-30);
        setChartData(recent);

        // Summary total keseluruhan
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

  const cards = [
    { label: 'Total Limbah Masuk', value: `${summary.masuk} Kg`, icon: 'fa-plus-circle', color: 'border-blue-500', iconBg: 'bg-blue-100 text-blue-500' },
    { label: 'Total Diangkut', value: `${summary.diangkut} Kg`, icon: 'fa-truck', color: 'border-orange-500', iconBg: 'bg-orange-100 text-orange-500' },
    { label: 'Sisa Limbah (Stok)', value: `${summary.sisa} Kg`, icon: 'fa-biohazard', color: parseFloat(summary.sisa) > 0 ? 'border-red-500' : 'border-green-500', iconBg: parseFloat(summary.sisa) > 0 ? 'bg-red-100 text-red-500' : 'bg-green-100 text-green-500' },
  ];

  return (
    <AppLayout title="Dashboard Petugas">
      <div className="container mx-auto px-4 py-8">

        {/* Welcome */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-8 border-l-4 border-blue-500">
          <h2 className="text-2xl font-bold text-gray-800">Selamat Datang, {user?.nama}!</h2>
          <p className="text-gray-500 mt-1">Monitoring limbah medis padat — masuk vs. diangkut.</p>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <i className="fas fa-spinner fa-spin text-blue-500 text-4xl"></i>
          </div>
        ) : (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
              {cards.map(c => (
                <div key={c.label} className={`bg-white p-6 rounded-lg shadow-md border-b-4 ${c.color}`}>
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-xs text-gray-500 font-bold uppercase">{c.label}</p>
                      <h3 className="text-2xl font-bold text-gray-800 mt-1">{c.value}</h3>
                    </div>
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center text-xl ${c.iconBg}`}>
                      <i className={`fas ${c.icon}`}></i>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {chartData.length === 0 ? (
              <div className="bg-white rounded-lg shadow-lg p-8 text-center">
                <i className="fas fa-inbox text-gray-300 text-5xl mb-4"></i>
                <p className="text-gray-500">Belum ada data limbah.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

                {/* Bar Chart: masuk vs diangkut */}
                <div className="bg-white rounded-lg shadow-lg p-6">
                  <h3 className="text-base font-bold text-gray-700 mb-4">
                    <i className="fas fa-chart-bar mr-2 text-blue-500"></i>
                    Limbah Masuk vs Diangkut (Harian)
                  </h3>
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData} margin={{ top: 5, right: 10, left: -15, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="tanggal" tick={{ fontSize: 10 }} />
                        <YAxis tick={{ fontSize: 10 }} />
                        <Tooltip formatter={(v) => `${v} Kg`} />
                        <Legend />
                        <Bar dataKey="masuk" name="Masuk (Kg)" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="diangkut" name="Diangkut (Kg)" fill="#f97316" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Line Chart: sisa kumulatif */}
                <div className="bg-white rounded-lg shadow-lg p-6">
                  <h3 className="text-base font-bold text-gray-700 mb-4">
                    <i className="fas fa-chart-line mr-2 text-red-500"></i>
                    Sisa Limbah Kumulatif (Stok)
                  </h3>
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData} margin={{ top: 5, right: 10, left: -15, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="tanggal" tick={{ fontSize: 10 }} />
                        <YAxis tick={{ fontSize: 10 }} />
                        <Tooltip formatter={(v) => `${v} Kg`} />
                        <Legend />
                        <ReferenceLine y={0} stroke="#9ca3af" strokeDasharray="4 4" />
                        <Line
                          type="monotone"
                          dataKey="sisa"
                          name="Sisa Limbah (Kg)"
                          stroke="#ef4444"
                          strokeWidth={2.5}
                          dot={{ r: 3 }}
                          activeDot={{ r: 5 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                  <p className="text-xs text-gray-400 mt-2 text-center">
                    Sisa = kumulatif limbah masuk dikurangi yang sudah diangkut
                  </p>
                </div>

              </div>
            )}
          </>
        )}
      </div>
    </AppLayout>
  );
}