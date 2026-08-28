import React from 'react';
import { formatKg } from '../../../lib/rekapQueries';

export default function RekapSummaryCards({ summary }) {
  const { totalTimbulan, totalDiangkut, sisaAkumulasi, rataRataTimbulan } = summary || {};

  const cards = [
    {
      title: 'Total Timbulan',
      value: formatKg(totalTimbulan),
      icon: 'fas fa-recycle',
      bgGradient: 'from-blue-500 to-indigo-600',
      shadowColor: 'shadow-blue-500/20',
      badgeBg: 'bg-blue-50 text-blue-600 border-blue-200'
    },
    {
      title: 'Total Diangkut',
      value: formatKg(totalDiangkut),
      icon: 'fas fa-truck',
      bgGradient: 'from-amber-500 to-orange-600',
      shadowColor: 'shadow-orange-500/20',
      badgeBg: 'bg-orange-50 text-orange-600 border-orange-200'
    },
    {
      title: 'Sisa / Akumulasi',
      value: formatKg(sisaAkumulasi),
      icon: 'fas fa-dumpster',
      bgGradient: sisaAkumulasi > 0 ? 'from-red-500 to-rose-600' : 'from-emerald-500 to-teal-600',
      shadowColor: sisaAkumulasi > 0 ? 'shadow-red-500/20' : 'shadow-emerald-500/20',
      badgeBg: sisaAkumulasi > 0 ? 'bg-red-50 text-red-600 border-red-200' : 'bg-emerald-50 text-emerald-600 border-emerald-200'
    },
    {
      title: 'Rata-rata Timbulan',
      value: formatKg(rataRataTimbulan, ' kg/bulan'),
      icon: 'fas fa-chart-line',
      bgGradient: 'from-purple-500 to-violet-600',
      shadowColor: 'shadow-purple-500/20',
      badgeBg: 'bg-purple-50 text-purple-600 border-purple-200'
    }
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-6">
      {cards.map((c, i) => (
        <div
          key={i}
          className="bg-white rounded-xl md:rounded-2xl p-3.5 md:p-5 shadow-sm border border-slate-100 hover:shadow-md transition-all duration-200 flex min-w-0 flex-col items-center justify-center text-center"
        >
          <div className={`w-9 h-9 md:w-10 md:h-10 rounded-full bg-gradient-to-br ${c.bgGradient} text-white flex items-center justify-center shadow-lg ${c.shadowColor} mb-2.5`}>
              <i className={`${c.icon} text-sm`}></i>
          </div>
          <span className="min-h-7 text-[10px] md:text-xs font-bold uppercase tracking-wide text-slate-500 leading-tight flex items-center">
            {c.title}
          </span>
          <h3 className="mt-1 max-w-full truncate text-lg md:text-2xl font-black text-slate-800 tracking-tight">
            {c.value}
          </h3>
        </div>
      ))}
    </div>
  );
}
