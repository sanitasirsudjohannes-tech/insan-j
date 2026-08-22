import React from 'react';
import { MONTH_NAMES } from '../../../lib/rekapQueries';

export default function RekapFilter({
  selectedYear,
  setSelectedYear,
  selectedMonth,
  setSelectedMonth,
  availableYears,
  onPrint,
  isPrinting
}) {
  return (
    <div className="bg-white rounded-2xl p-4 md:p-5 shadow-sm border border-slate-100 mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <label htmlFor="select-tahun" className="text-xs font-bold text-slate-600 uppercase tracking-wider">
            Tahun:
          </label>
          <div className="relative">
            <select
              id="select-tahun"
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="appearance-none bg-slate-50 border border-slate-200 text-slate-800 font-semibold text-sm rounded-xl px-4 py-2 pr-9 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none cursor-pointer hover:bg-slate-100 transition-all"
            >
              {availableYears.map(yr => (
                <option key={yr} value={yr}>
                  {yr}
                </option>
              ))}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-400">
              <i className="fas fa-chevron-down text-xs"></i>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <label htmlFor="select-periode" className="text-xs font-bold text-slate-600 uppercase tracking-wider">
            Periode:
          </label>
          <div className="relative">
            <select
              id="select-periode"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="appearance-none bg-slate-50 border border-slate-200 text-slate-800 font-semibold text-sm rounded-xl px-4 py-2 pr-9 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none cursor-pointer hover:bg-slate-100 transition-all"
            >
              <option value="semua">Semua Bulan</option>
              {MONTH_NAMES.map((name, idx) => (
                <option key={idx + 1} value={String(idx + 1)}>
                  {name}
                </option>
              ))}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-400">
              <i className="fas fa-chevron-down text-xs"></i>
            </div>
          </div>
        </div>
      </div>

      {/* Action Button */}
      <button
        onClick={onPrint}
        disabled={isPrinting}
        className="inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold text-sm px-5 py-2.5 rounded-xl shadow-md shadow-blue-500/20 hover:shadow-lg hover:shadow-blue-500/30 transition-all duration-200 disabled:opacity-50 cursor-pointer"
      >
        <i className={`fas ${isPrinting ? 'fa-spinner fa-spin' : 'fa-print'}`}></i>
        <span>{isPrinting ? 'Mencetak...' : 'Cetak Rekap'}</span>
      </button>
    </div>
  );
}
