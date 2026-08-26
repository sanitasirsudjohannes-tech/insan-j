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

function CompactValue({ label, value, tone = 'slate', highlight = false }) {
  const toneClasses = {
    slate: 'text-slate-800',
    blue: 'text-blue-700',
    orange: 'text-orange-700',
    red: 'text-red-600',
    lightBlue: 'text-blue-300',
    lightOrange: 'text-orange-300'
  };

  return (
    <div className="min-w-0 text-center">
      <p className="mb-0.5 truncate text-[8px] font-bold uppercase tracking-tight text-slate-400">{label}</p>
      <p
        className={`truncate text-[10px] font-extrabold tabular-nums sm:text-xs ${toneClasses[tone]} ${
          highlight ? 'rounded-md bg-red-50 px-0.5 py-0.5' : ''
        }`}
        title={`${value} kg`}
      >
        {value}<span className="ml-0.5 text-[7px] font-semibold text-slate-400">kg</span>
      </p>
    </div>
  );
}

function MobileRekapCards({ tableRows, summary }) {
  if (tableRows.length === 0) return <EmptyState />;

  return (
    <div className="space-y-2 p-2.5">
      {tableRows.map((row, idx) => {
        const isNegative = row.sisaAkhir < 0;

        return (
          <article
            key={row.yearMonth}
            className="grid grid-cols-[minmax(58px,1.15fr)_repeat(4,minmax(0,1fr))] items-center gap-1 rounded-xl border border-slate-200 bg-white px-2 py-2.5 shadow-sm"
          >
            <div className="min-w-0 border-r border-slate-100 pr-1.5">
              <p className="text-[8px] font-bold uppercase tracking-tight text-slate-400">{idx + 1}</p>
              <h3 className="truncate text-[11px] font-extrabold text-slate-900 sm:text-xs" title={row.monthName}>
                {row.monthName}
              </h3>
              {!row.hasData && (
                <span className="block truncate text-[8px] font-bold text-slate-400">Tanpa data</span>
              )}
            </div>

              <CompactValue label="S. Awal" value={formatKg(row.sisaAwal, '')} />
              <CompactValue
                label="Timbulan"
                value={row.hasData ? formatKg(row.timbulan, '') : '—'}
                tone="blue"
              />
              <CompactValue
                label="Diangkut"
                value={row.hasData ? formatKg(row.diangkut, '') : '—'}
                tone="orange"
              />
              <CompactValue
                label="S. Akhir"
                value={formatKg(row.sisaAkhir, '')}
                tone={isNegative ? 'red' : 'slate'}
                highlight={isNegative}
              />
          </article>
        );
      })}

      <div className="grid grid-cols-[minmax(72px,1.15fr)_repeat(3,minmax(0,1fr))] items-center gap-1 rounded-xl bg-slate-900 px-2.5 py-3 text-white shadow-sm">
        <p className="text-[10px] font-black uppercase tracking-wide text-slate-300">Total Periode</p>
        <CompactValue label="Timbulan" value={formatKg(summary.totalTimbulan, '')} tone="lightBlue" />
        <CompactValue label="Diangkut" value={formatKg(summary.totalDiangkut, '')} tone="lightOrange" />
        <div className="min-w-0 text-center">
          <p className="mb-0.5 truncate text-[8px] font-bold uppercase tracking-tight text-slate-400">Sisa</p>
          <p className={`truncate text-[10px] font-extrabold tabular-nums sm:text-xs ${summary.sisaAkumulasi < 0 ? 'text-red-300' : 'text-white'}`}>
            {formatKg(summary.sisaAkumulasi, '')}<span className="ml-0.5 text-[7px] text-slate-400">kg</span>
          </p>
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
