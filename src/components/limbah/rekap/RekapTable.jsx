import React from 'react';
import { formatKg } from '../../../lib/rekapQueries';

function EmptyState() {
  return (
    <div className="px-5 py-10 text-center text-slate-400">
      <i className="fas fa-inbox mb-3 text-3xl text-slate-300"></i>
      <p className="text-sm font-semibold">Tidak ada data rekapitulasi</p>
      <p className="mt-1 text-xs">Belum ada data untuk periode yang dipilih.</p>
    </div>
  );
}

function MobileValue({ label, value, tone = 'slate', highlight = false }) {
  const toneClasses = {
    slate: 'text-slate-800',
    blue: 'text-blue-700',
    orange: 'text-orange-700',
    red: 'text-red-600'
  };

  return (
    <div className="min-w-0">
      <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-slate-400">{label}</p>
      <p
        className={`break-words text-sm font-bold tabular-nums ${toneClasses[tone]} ${
          highlight ? 'inline-block rounded-lg bg-red-50 px-2 py-1' : ''
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function MobileRekapCards({ tableRows, summary }) {
  if (tableRows.length === 0) return <EmptyState />;

  return (
    <div className="space-y-3 p-3">
      {tableRows.map((row, idx) => {
        const isNegative = row.sisaAkhir < 0;

        return (
          <article
            key={row.yearMonth}
            className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
          >
            <div className="flex items-center gap-3 border-b border-slate-100 bg-slate-50 px-4 py-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-black text-blue-700">
                {idx + 1}
              </span>
              <h3 className="min-w-0 flex-1 truncate text-sm font-extrabold text-slate-900">
                {row.monthName}
              </h3>
              {!row.hasData && (
                <span className="shrink-0 rounded-full bg-slate-200 px-2 py-1 text-[10px] font-bold text-slate-500">
                  Tanpa data
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 gap-x-4 gap-y-4 px-4 py-4">
              <MobileValue label="Sisa awal" value={formatKg(row.sisaAwal)} />
              <MobileValue
                label="Timbulan"
                value={row.hasData ? formatKg(row.timbulan) : '—'}
                tone="blue"
              />
              <MobileValue
                label="Diangkut"
                value={row.hasData ? formatKg(row.diangkut) : '—'}
                tone="orange"
              />
              <MobileValue
                label="Sisa akhir"
                value={formatKg(row.sisaAkhir)}
                tone={isNegative ? 'red' : 'slate'}
                highlight={isNegative}
              />
            </div>
          </article>
        );
      })}

      <div className="rounded-xl bg-slate-900 px-4 py-4 text-white shadow-sm">
        <p className="mb-4 text-xs font-black uppercase tracking-widest text-slate-300">
          Total Periode
        </p>
        <div className="grid grid-cols-2 gap-x-4 gap-y-4">
          <MobileValue label="Total timbulan" value={formatKg(summary.totalTimbulan)} tone="blue" />
          <MobileValue label="Total diangkut" value={formatKg(summary.totalDiangkut)} tone="orange" />
          <div className="col-span-2 border-t border-slate-700 pt-3">
            <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-slate-400">
              Sisa akumulasi
            </p>
            <p
              className={`text-base font-black tabular-nums ${
                summary.sisaAkumulasi < 0 ? 'text-red-300' : 'text-white'
              }`}
            >
              {formatKg(summary.sisaAkumulasi)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function DesktopRekapTable({ tableRows, summary }) {
  return (
    <table className="w-full border-collapse text-left">
      <thead>
        <tr className="border-b border-slate-200 bg-slate-50 text-xs font-bold uppercase tracking-wider text-slate-600">
          <th className="w-16 px-4 py-3.5 text-center">No</th>
          <th className="px-4 py-3.5">Bulan</th>
          <th className="px-4 py-3.5 text-right">Sisa Awal</th>
          <th className="px-4 py-3.5 text-right">Timbulan</th>
          <th className="px-4 py-3.5 text-right">Diangkut</th>
          <th className="px-4 py-3.5 text-right">Sisa Akhir</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100 text-sm font-medium text-slate-700">
        {tableRows.length === 0 ? (
          <tr>
            <td colSpan="6">
              <EmptyState />
            </td>
          </tr>
        ) : (
          tableRows.map((row, idx) => (
            <tr key={row.yearMonth} className="transition-colors hover:bg-slate-50/80">
              <td className="px-4 py-3.5 text-center font-semibold text-slate-400">{idx + 1}</td>
              <td className="px-4 py-3.5 font-bold text-slate-800">{row.monthName}</td>
              <td className="px-4 py-3.5 text-right font-mono text-slate-600">
                {formatKg(row.sisaAwal)}
              </td>
              <td className="px-4 py-3.5 text-right font-mono">
                {row.hasData ? (
                  <span className="font-semibold text-slate-800">{formatKg(row.timbulan)}</span>
                ) : (
                  <span className="text-xs italic text-slate-400">Tidak ada data</span>
                )}
              </td>
              <td className="px-4 py-3.5 text-right font-mono">
                {row.hasData ? (
                  <span className="font-semibold text-slate-800">{formatKg(row.diangkut)}</span>
                ) : (
                  <span className="text-xs italic text-slate-400">Tidak ada data</span>
                )}
              </td>
              <td className="px-4 py-3.5 text-right font-mono font-bold">
                {row.sisaAkhir < 0 ? (
                  <span className="rounded bg-red-50 px-2 py-0.5 font-bold text-red-600">
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
          <tr className="border-t-2 border-slate-200 bg-slate-100/80 text-sm font-black text-slate-900">
            <td className="px-4 py-4 text-center"></td>
            <td className="px-4 py-4 uppercase tracking-wider text-slate-800">TOTAL</td>
            <td className="px-4 py-4 text-center font-normal text-slate-400">—</td>
            <td className="px-4 py-4 text-right font-mono text-blue-700">
              {formatKg(summary.totalTimbulan)}
            </td>
            <td className="px-4 py-4 text-right font-mono text-orange-700">
              {formatKg(summary.totalDiangkut)}
            </td>
            <td className="px-4 py-4 text-right font-mono">
              {summary.sisaAkumulasi < 0 ? (
                <span className="rounded bg-red-100 px-2 py-0.5 text-red-600">
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
  );
}

export default function RekapTable({ tableRows, summary, hasAnomaly, loading }) {
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-100 bg-white p-12 text-slate-400 shadow-sm">
        <i className="fas fa-circle-notch fa-spin mb-3 text-4xl text-blue-500"></i>
        <p className="text-center text-sm font-bold uppercase tracking-wider text-slate-500">
          Memuat Rekapitulasi Data...
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {hasAnomaly && (
        <div className="flex items-start gap-3 rounded-xl border-l-4 border-amber-500 bg-amber-50 p-4 text-amber-800 shadow-sm">
          <i className="fas fa-exclamation-triangle mt-0.5 shrink-0 text-lg text-amber-500"></i>
          <div>
            <h4 className="text-sm font-bold">Peringatan Ketidaksesuaian Data</h4>
            <p className="mt-0.5 text-xs font-medium">
              Terdapat ketidaksesuaian antara data timbulan dan pengangkutan. Periksa kembali data sumber.
            </p>
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
        <div className="md:hidden">
          <MobileRekapCards tableRows={tableRows} summary={summary} />
        </div>
        <div className="hidden md:block">
          <DesktopRekapTable tableRows={tableRows} summary={summary} />
        </div>
      </div>
    </div>
  );
}
