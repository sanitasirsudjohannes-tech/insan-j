import React from 'react';
import { formatKg } from '../../../lib/rekapQueries';

export default function RekapTable({ tableRows, summary, hasAnomaly, loading }) {
  if (loading) {
    return (
      <div className="bg-white rounded-2xl p-12 shadow-sm border border-slate-100 flex flex-col items-center justify-center text-slate-400">
        <i className="fas fa-circle-notch fa-spin text-4xl text-blue-500 mb-3"></i>
        <p className="font-bold text-sm tracking-wider uppercase text-slate-500">Memuat Rekapitulasi Data...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Anomaly Alert Banner */}
      {hasAnomaly && (
        <div className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded-xl shadow-sm flex items-start gap-3 text-amber-800">
          <i className="fas fa-exclamation-triangle text-amber-500 text-lg mt-0.5 shrink-0"></i>
          <div>
            <h4 className="font-bold text-sm">Peringatan Ketidaksesuaian Data</h4>
            <p className="text-xs mt-0.5 font-medium">
              Terdapat ketidaksesuaian antara data timbulan dan pengangkutan. Periksa kembali data sumber.
            </p>
          </div>
        </div>
      )}

      {/* Main Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 text-xs font-bold uppercase tracking-wider">
                <th className="py-3.5 px-4 text-center w-16">No</th>
                <th className="py-3.5 px-4">Bulan</th>
                <th className="py-3.5 px-4 text-right">Sisa Awal</th>
                <th className="py-3.5 px-4 text-right">Timbulan</th>
                <th className="py-3.5 px-4 text-right">Diangkut</th>
                <th className="py-3.5 px-4 text-right">Sisa Akhir</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm font-medium text-slate-700">
              {tableRows.length === 0 ? (
                <tr>
                  <td colSpan="6" className="py-8 text-center text-slate-400 font-medium">
                    Tidak ada data rekapitulasi untuk periode ini.
                  </td>
                </tr>
              ) : (
                tableRows.map((row, idx) => (
                  <tr
                    key={row.yearMonth}
                    className="hover:bg-slate-50/80 transition-colors"
                  >
                    <td className="py-3.5 px-4 text-center text-slate-400 font-semibold">{idx + 1}</td>
                    <td className="py-3.5 px-4 font-bold text-slate-800">{row.monthName}</td>
                    <td className="py-3.5 px-4 text-right text-slate-600 font-mono">
                      {formatKg(row.sisaAwal)}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono">
                      {row.hasData ? (
                        <span className="text-slate-800 font-semibold">{formatKg(row.timbulan)}</span>
                      ) : (
                        <span className="text-slate-400 italic text-xs">Tidak ada data</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono">
                      {row.hasData ? (
                        <span className="text-slate-800 font-semibold">{formatKg(row.diangkut)}</span>
                      ) : (
                        <span className="text-slate-400 italic text-xs">Tidak ada data</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-bold">
                      {row.sisaAkhir < 0 ? (
                        <span className="text-red-600 bg-red-50 px-2 py-0.5 rounded font-bold">
                          {formatKg(row.sisaAkhir)}
                        </span>
                      ) : (
                        <span className="text-slate-900">{formatKg(row.sisaAkhir)}</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {tableRows.length > 0 && (
              <tfoot>
                <tr className="bg-slate-100/80 font-black text-sm text-slate-900 border-t-2 border-slate-200">
                  <td className="py-4 px-4 text-center"></td>
                  <td className="py-4 px-4 uppercase tracking-wider text-slate-800">TOTAL</td>
                  <td className="py-4 px-4 text-center text-slate-400 font-normal">—</td>
                  <td className="py-4 px-4 text-right font-mono text-blue-700">
                    {formatKg(summary.totalTimbulan)}
                  </td>
                  <td className="py-4 px-4 text-right font-mono text-orange-700">
                    {formatKg(summary.totalDiangkut)}
                  </td>
                  <td className="py-4 px-4 text-right font-mono">
                    {summary.sisaAkumulasi < 0 ? (
                      <span className="text-red-600 bg-red-100 px-2 py-0.5 rounded">
                        {formatKg(summary.sisaAkumulasi)}
                      </span>
                    ) : (
                      <span className="text-slate-900">{formatKg(summary.sisaAkumulasi)}</span>
                    )}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}
