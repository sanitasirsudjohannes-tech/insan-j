import { useState, useEffect } from 'react';
import AppLayout from '../AppLayout';
import { supabase } from '../../lib/supabase';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from 'recharts';

export default function DashboardUser({ user }) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const { data: dbData, error } = await supabase
          .from('limbah_padat')
          .select('tanggal, infeksius, jarum_suntik, botol_obat, sitotoksik')
          .order('tanggal', { ascending: true }) // chronological order for charts
          .limit(30);

        if (error) throw error;

        // Format dates for the chart
        const formattedData = (dbData || []).map(item => ({
          ...item,
          tanggal: new Date(item.tanggal).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }),
          total: (item.infeksius || 0) + (item.jarum_suntik || 0) + (item.botol_obat || 0) + (item.sitotoksik || 0)
        }));

        setData(formattedData);
      } catch (err) {
        console.error("Error fetching limbah data:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const totalInfeksius = data.reduce((sum, item) => sum + (item.infeksius || 0), 0);
  const totalJarum = data.reduce((sum, item) => sum + (item.jarum_suntik || 0), 0);
  const totalBotol = data.reduce((sum, item) => sum + (item.botol_obat || 0), 0);
  const totalSitotoksik = data.reduce((sum, item) => sum + (item.sitotoksik || 0), 0);

  return (
    <AppLayout title="Dashboard Petugas">
      <div className="container mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow-lg p-6 mb-8 flex items-center border-l-4 border-blue-500">
          <div>
            <h2 className="text-2xl font-bold text-gray-800">Selamat Datang, {user?.nama}!</h2>
            <p className="text-gray-600">Berikut adalah statistik limbah medis padat harian.</p>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <i className="fas fa-spinner fa-spin text-blue-500 text-4xl"></i>
          </div>
        ) : data.length === 0 ? (
          <div className="bg-white rounded-lg shadow-lg p-8 text-center">
            <i className="fas fa-inbox text-gray-400 text-5xl mb-4"></i>
            <h3 className="text-xl font-bold text-gray-700">Belum Ada Data</h3>
            <p className="text-gray-500 mt-2">Data limbah padat belum diinput.</p>
          </div>
        ) : (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
              <div className="bg-white p-6 rounded-lg shadow-md border-b-4 border-red-500">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-sm text-gray-500 font-bold uppercase">Infeksius</p>
                    <h3 className="text-2xl font-bold text-gray-800">{totalInfeksius.toFixed(2)} Kg</h3>
                  </div>
                  <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center text-red-500 text-xl">
                    <i className="fas fa-biohazard"></i>
                  </div>
                </div>
              </div>
              <div className="bg-white p-6 rounded-lg shadow-md border-b-4 border-orange-500">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-sm text-gray-500 font-bold uppercase">Jarum Suntik</p>
                    <h3 className="text-2xl font-bold text-gray-800">{totalJarum.toFixed(2)} Kg</h3>
                  </div>
                  <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center text-orange-500 text-xl">
                    <i className="fas fa-syringe"></i>
                  </div>
                </div>
              </div>
              <div className="bg-white p-6 rounded-lg shadow-md border-b-4 border-blue-500">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-sm text-gray-500 font-bold uppercase">Botol Obat</p>
                    <h3 className="text-2xl font-bold text-gray-800">{totalBotol.toFixed(2)} Kg</h3>
                  </div>
                  <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center text-blue-500 text-xl">
                    <i className="fas fa-pills"></i>
                  </div>
                </div>
              </div>
              <div className="bg-white p-6 rounded-lg shadow-md border-b-4 border-purple-500">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-sm text-gray-500 font-bold uppercase">Sitotoksik</p>
                    <h3 className="text-2xl font-bold text-gray-800">{totalSitotoksik.toFixed(2)} Kg</h3>
                  </div>
                  <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center text-purple-500 text-xl">
                    <i className="fas fa-skull-crossbones"></i>
                  </div>
                </div>
              </div>
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Bar Chart */}
              <div className="bg-white rounded-lg shadow-lg p-6">
                <h3 className="text-lg font-bold text-gray-800 mb-6">Grafik Komposisi Limbah</h3>
                <div className="h-80 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="tanggal" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="infeksius" name="Infeksius (Kg)" stackId="a" fill="#ef4444" />
                      <Bar dataKey="jarum_suntik" name="Jarum Suntik (Kg)" stackId="a" fill="#f97316" />
                      <Bar dataKey="botol_obat" name="Botol Obat (Kg)" stackId="a" fill="#3b82f6" />
                      <Bar dataKey="sitotoksik" name="Sitotoksik (Kg)" stackId="a" fill="#a855f7" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Line Chart */}
              <div className="bg-white rounded-lg shadow-lg p-6">
                <h3 className="text-lg font-bold text-gray-800 mb-6">Tren Total Limbah Harian</h3>
                <div className="h-80 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="tanggal" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Line type="monotone" dataKey="total" name="Total Limbah (Kg)" stroke="#10b981" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </AppLayout>
  );
}
