import { forwardRef } from 'react';
import {
  Bar, BarChart, CartesianGrid, Cell, LabelList, Legend, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';

const COLORS = ['#2563eb', '#f59e0b', '#10b981', '#8b5cf6'];
const kg = value => `${new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 }).format(Number(value) || 0)} kg`;

const ChartCard = ({ title, subtitle, children }) => (
  <article className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
    <h3 className="text-sm font-black text-slate-800">{title}</h3>
    <p className="mb-3 text-[11px] text-slate-500">{subtitle}</p>
    <div className="h-64 w-full">{children}</div>
  </article>
);

const ReportCharts = forwardRef(function ReportCharts({ data }, ref) {
  if (!data || (!data.balanceFlow?.length && !data.composition?.some(item => item.value > 0))) return null;
  return (
    <section ref={ref} className="space-y-3" aria-label="Grafik laporan limbah">
      <div className="grid gap-3 lg:grid-cols-2">
        {data.balanceFlow?.length > 0 && <ChartCard title="Ringkasan Neraca Limbah" subtitle="Saldo awal + timbulan − diangkut = saldo akhir">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.balanceFlow} margin={{ top: 24, right: 8, left: -15, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip formatter={kg} />
              <Bar name="Jumlah" dataKey="value" radius={[5, 5, 0, 0]}>
                {data.balanceFlow.map((item, index) => <Cell key={item.name} fill={COLORS[index % COLORS.length]} />)}
                <LabelList dataKey="value" position="top" formatter={value => new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 }).format(value)} style={{ fontSize: 10, fill: '#475569' }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>}
        <ChartCard title="Komposisi Jenis Limbah" subtitle="Proporsi berat setiap jenis limbah">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data.composition} dataKey="value" nameKey="name" innerRadius={48} outerRadius={78} paddingAngle={2}>
                {data.composition.map((item, index) => <Cell key={item.name} fill={COLORS[index % COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={kg} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
      {data.rooms?.length > 0 && (
        <ChartCard title="Ruangan Penghasil Limbah Terbesar" subtitle="Maksimal 10 ruangan berdasarkan total berat">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.rooms} layout="vertical" margin={{ top: 4, right: 18, left: 35, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
              <XAxis type="number" tick={{ fontSize: 10 }} />
              <YAxis type="category" dataKey="name" width={95} tick={{ fontSize: 9 }} />
              <Tooltip formatter={kg} />
              <Bar name="Total Limbah" dataKey="value" fill="#8b5cf6" radius={[0, 5, 5, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      )}
    </section>
  );
});

export default ReportCharts;
