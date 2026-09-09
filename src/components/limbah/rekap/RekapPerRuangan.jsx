import { useMemo, useState } from 'react';
import { MONTH_NAMES } from '../../../lib/rekapQueries';
import { calculateRuanganTotals } from '../../../lib/limbah/rekapRuanganCalculations';
import { loadExcelLibrary } from '../../../lib/excelLoader';
import { EmptyState, ErrorState, MobileListSkeleton, TableRowsSkeleton } from '../../ui/DataStates';

const numberFormatter = new Intl.NumberFormat('id-ID', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

const formatKg = value => `${numberFormatter.format(Number(value) || 0)} kg`;

const wasteColumns = [
  ['Infeksius', 'infeksius', 'text-red-600'],
  ['Jarum suntik', 'jarum_suntik', 'text-orange-600'],
  ['Botol obat', 'botol_obat', 'text-blue-600'],
  ['Sitotoksik', 'sitotoksik', 'text-purple-600']
];

const WasteValues = ({ row, compact = false }) => {
  if (compact) {
    return (
      <div className="grid grid-cols-2 gap-2 text-xs">
        {wasteColumns.map(([label, field, color]) => (
      <div key={field} className="rounded-xl bg-slate-50 px-3 py-2">
        <span className="block text-[10px] text-slate-400">{label}</span>
        <strong className={color}>{formatKg(row[field])}</strong>
      </div>
        ))}
      </div>
    );
  }

  return (
    <>
      {wasteColumns.map(([, field, color]) => (
      <td key={field} className={`px-3 py-3 text-right font-semibold whitespace-nowrap ${color}`}>
        {formatKg(row[field])}
      </td>
      ))}
    </>
  );
};

export default function RekapPerRuangan({
  rows,
  loading,
  error,
  selectedYear,
  selectedMonth,
  availableYears,
  onYearChange,
  onMonthChange,
  onRetry
}) {
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('total-desc');
  const [exporting, setExporting] = useState(false);

  const visibleRows = useMemo(() => {
    const keyword = search.trim().toLocaleLowerCase('id-ID');
    const filtered = keyword
      ? rows.filter(row => row.ruangan.toLocaleLowerCase('id-ID').includes(keyword))
      : [...rows];

    return filtered.sort((a, b) => {
      if (sortBy === 'name-asc') return a.ruangan.localeCompare(b.ruangan, 'id-ID');
      if (sortBy === 'name-desc') return b.ruangan.localeCompare(a.ruangan, 'id-ID');
      if (sortBy === 'total-asc') return a.total - b.total;
      return b.total - a.total;
    });
  }, [rows, search, sortBy]);

  const totals = useMemo(() => calculateRuanganTotals(visibleRows), [visibleRows]);
  const periodLabel = `${MONTH_NAMES[Number(selectedMonth) - 1]} ${selectedYear}`;

  const handleExport = async () => {
    if (!visibleRows.length) return;
    setExporting(true);
    try {
      const XLSX = await loadExcelLibrary();
      const worksheetRows = [
        ['REKAP LIMBAH MEDIS PADAT PER RUANGAN'],
        [`Periode: ${periodLabel}`],
        [],
        ['No.', 'Ruangan', 'Infeksius (kg)', 'Jarum Suntik (kg)', 'Botol Obat (kg)', 'Sitotoksik (kg)', 'Total (kg)', 'Jumlah Entri'],
        ...visibleRows.map((row, index) => [
          index + 1, row.ruangan, row.infeksius, row.jarum_suntik,
          row.botol_obat, row.sitotoksik, row.total, row.jumlahEntri
        ]),
        ['', 'TOTAL', totals.infeksius, totals.jarum_suntik, totals.botol_obat, totals.sitotoksik, totals.total, '']
      ];
      const worksheet = XLSX.utils.aoa_to_sheet(worksheetRows);
      worksheet['!cols'] = [
        { wch: 6 }, { wch: 28 }, { wch: 18 }, { wch: 20 },
        { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 14 }
      ];
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Rekap per Ruangan');
      XLSX.writeFile(workbook, `Rekap_Per_Ruangan_${selectedYear}-${String(selectedMonth).padStart(2, '0')}.xlsx`);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm md:p-5">
        <div className="grid gap-3 md:grid-cols-[auto_auto_1fr_auto_auto] md:items-end">
          <label className="text-xs font-bold uppercase tracking-wider text-slate-600">
            Tahun
            <select value={selectedYear} onChange={event => onYearChange(event.target.value)} className="mt-1 block w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-blue-500">
              {availableYears.map(year => <option key={year} value={year}>{year}</option>)}
            </select>
          </label>
          <label className="text-xs font-bold uppercase tracking-wider text-slate-600">
            Bulan
            <select value={selectedMonth} onChange={event => onMonthChange(event.target.value)} className="mt-1 block w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-blue-500">
              {MONTH_NAMES.map((month, index) => <option key={month} value={String(index + 1)}>{month}</option>)}
            </select>
          </label>
          <label className="text-xs font-bold uppercase tracking-wider text-slate-600">
            Cari ruangan
            <div className="relative mt-1">
              <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400" />
              <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Nama ruangan..." className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </label>
          <label className="text-xs font-bold uppercase tracking-wider text-slate-600">
            Urutkan
            <select value={sortBy} onChange={event => setSortBy(event.target.value)} className="mt-1 block w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-blue-500">
              <option value="total-desc">Total terbesar</option>
              <option value="total-asc">Total terkecil</option>
              <option value="name-asc">Nama A–Z</option>
              <option value="name-desc">Nama Z–A</option>
            </select>
          </label>
          <button type="button" onClick={handleExport} disabled={exporting || !visibleRows.length} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50">
            <i className={`fas ${exporting ? 'fa-spinner fa-spin' : 'fa-file-excel'}`} />
            Excel
          </button>
        </div>
      </div>

      {!loading && !error && rows.length > 0 && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          {[
            ['Total', totals.total, 'text-slate-900'],
            ['Infeksius', totals.infeksius, 'text-red-600'],
            ['Jarum suntik', totals.jarum_suntik, 'text-orange-600'],
            ['Botol obat', totals.botol_obat, 'text-blue-600'],
            ['Sitotoksik', totals.sitotoksik, 'text-purple-600']
          ].map(([label, value, color]) => (
            <div key={label} className="rounded-2xl border border-slate-100 bg-white p-3 shadow-sm">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
              <p className={`mt-1 text-base font-black ${color}`}>{formatKg(value)}</p>
            </div>
          ))}
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
        {error ? (
          <ErrorState title="Rekap per ruangan gagal dimuat" description={error} onRetry={onRetry} />
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-xs">
                <thead className="border-b bg-slate-50 text-slate-600">
                  <tr>
                    <th className="px-3 py-3 text-left">No.</th>
                    <th className="px-3 py-3 text-left">Ruangan</th>
                    <th className="px-3 py-3 text-right">Infeksius</th>
                    <th className="px-3 py-3 text-right">Jarum Suntik</th>
                    <th className="px-3 py-3 text-right">Botol Obat</th>
                    <th className="px-3 py-3 text-right">Sitotoksik</th>
                    <th className="px-3 py-3 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading ? <TableRowsSkeleton columns={7} rows={6} /> : visibleRows.map((row, index) => (
                    <tr key={row.ruangan} className="hover:bg-blue-50/40">
                      <td className="px-3 py-3 text-slate-400">{index + 1}</td>
                      <td className="px-3 py-3 font-bold text-slate-800">{row.ruangan}</td>
                      <WasteValues row={row} />
                      <td className="px-3 py-3 text-right font-black text-slate-900 whitespace-nowrap">{formatKg(row.total)}</td>
                    </tr>
                  ))}
                </tbody>
                {!loading && visibleRows.length > 0 && (
                  <tfoot className="border-t-2 border-slate-200 bg-slate-50 font-black">
                    <tr>
                      <td className="px-3 py-3" />
                      <td className="px-3 py-3">TOTAL</td>
                      <WasteValues row={totals} />
                      <td className="px-3 py-3 text-right whitespace-nowrap">{formatKg(totals.total)}</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>

            <div className="divide-y divide-slate-100 md:hidden">
              {loading ? <MobileListSkeleton rows={5} /> : visibleRows.map(row => (
                <article key={row.ruangan} className="p-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <h3 className="min-w-0 truncate font-black text-slate-800">{row.ruangan}</h3>
                    <span className="shrink-0 rounded-full bg-blue-100 px-2.5 py-1 text-xs font-black text-blue-700">{formatKg(row.total)}</span>
                  </div>
                  <WasteValues row={row} compact />
                </article>
              ))}
            </div>

            {!loading && visibleRows.length === 0 && (
              <EmptyState title={rows.length ? 'Ruangan tidak ditemukan' : 'Belum ada data ruangan'} description={rows.length ? 'Coba gunakan kata pencarian lain.' : `Belum ada data pada ${periodLabel}.`} icon="fas fa-hospital" />
            )}
          </>
        )}
      </div>
    </div>
  );
}
