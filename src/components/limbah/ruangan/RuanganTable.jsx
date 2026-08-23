/**
 * RuanganTable – tabel data limbah per ruangan (desktop + mobile card).
 */
import { useState, useEffect } from 'react';

export default function RuanganTable({
  data,
  loading,
  page,
  itemsPerPage,
  totalData,
  filterMonth,
  filterDate,
  filterRuangan,
  ruanganList,
  setFilterMonth,
  setFilterDate,
  setFilterRuangan,
  setPage,
  onEdit,
  onDelete,
  onPrint,
}) {
  const [showFilter, setShowFilter] = useState(false);

  // Lock body scroll when filter panel open on mobile
  useEffect(() => {
    if (showFilter) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [showFilter]);

  const activeFilterCount = [filterMonth, filterDate, filterRuangan].filter(Boolean).length;

  const handleClearFilters = () => {
    setFilterMonth('');
    setFilterDate('');
    setFilterRuangan('');
    setPage(1);
  };

  // Filter Panel content (shared between mobile overlay and panel)
  const FilterPanel = () => (
    <div className="space-y-4">
      {/* Ruangan */}
      <div>
        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">
          <i className="fas fa-door-open mr-1.5 text-emerald-500" />Ruangan
        </label>
        <select
          value={filterRuangan}
          onChange={(e) => { setFilterRuangan(e.target.value); setPage(1); }}
          className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-medium outline-none focus:ring-2 focus:ring-emerald-500 bg-gray-50"
        >
          <option value="">Semua Ruangan</option>
          {ruanganList.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
      </div>

      {/* Periode toggle */}
      <div>
        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">
          <i className="fas fa-calendar mr-1.5 text-blue-500" />Periode
        </label>
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl mb-2.5">
          <button
            type="button"
            onClick={() => { setFilterDate(''); }}
            className={`flex-1 text-xs py-2 rounded-lg font-semibold transition ${!filterDate ? 'bg-white shadow-sm text-blue-700' : 'text-gray-400 hover:text-gray-600'}`}
          >
            <i className="fas fa-calendar-alt mr-1" />Per Bulan
          </button>
          <button
            type="button"
            onClick={() => { setFilterMonth(''); if (!filterDate) setFilterDate(new Date().toISOString().split('T')[0]); }}
            className={`flex-1 text-xs py-2 rounded-lg font-semibold transition ${filterDate ? 'bg-white shadow-sm text-blue-700' : 'text-gray-400 hover:text-gray-600'}`}
          >
            <i className="fas fa-calendar-day mr-1" />Per Tanggal
          </button>
        </div>

        {!filterDate ? (
          <input
            type="month"
            value={filterMonth}
            onChange={(e) => { setFilterMonth(e.target.value); setPage(1); }}
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-medium outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50"
          />
        ) : (
          <input
            type="date"
            value={filterDate}
            onChange={(e) => { setFilterDate(e.target.value); setPage(1); }}
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-medium outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50"
          />
        )}
      </div>

      {/* Active filter badges */}
      {activeFilterCount > 0 && (
        <div className="pt-3 border-t border-gray-100">
          <p className="text-[10px] font-bold text-gray-400 uppercase mb-1.5">Filter Aktif</p>
          <div className="flex flex-wrap gap-1.5">
            {filterMonth && <span className="text-xs bg-blue-100 text-blue-700 px-2.5 py-1 rounded-full font-semibold">📅 {filterMonth}</span>}
            {filterDate && <span className="text-xs bg-blue-100 text-blue-700 px-2.5 py-1 rounded-full font-semibold">📆 {new Date(filterDate).toLocaleDateString('id-ID',{day:'numeric',month:'short',year:'numeric'})}</span>}
            {filterRuangan && <span className="text-xs bg-emerald-100 text-emerald-700 px-2.5 py-1 rounded-full font-semibold">🚪 {filterRuangan}</span>}
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
      {/* Header bar */}
      <div className="bg-slate-800 text-white px-4 py-3 flex items-center justify-between gap-3">
        <h2 className="text-base font-bold flex items-center gap-2 min-w-0">
          <i className="fas fa-table shrink-0" />
          <span className="truncate">Data Limbah Ruangan</span>
          <span className="text-[11px] font-normal text-slate-300 shrink-0">({totalData})</span>
        </h2>

        <div className="flex items-center gap-2 shrink-0">
          {/* Filter button */}
          <button
            onClick={() => setShowFilter(true)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition ${
              activeFilterCount > 0
                ? 'bg-emerald-500 hover:bg-emerald-600 text-white'
                : 'bg-white/10 hover:bg-white/20 text-white border border-white/20'
            }`}
          >
            <i className="fas fa-filter" />
            Filter
            {activeFilterCount > 0 && (
              <span className="bg-white text-emerald-700 text-[10px] font-black w-4 h-4 rounded-full flex items-center justify-center">
                {activeFilterCount}
              </span>
            )}
          </button>

          {/* Print button */}
          {onPrint && (
            <button
              onClick={onPrint}
              className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-xl transition text-xs font-semibold flex items-center gap-1.5 shadow-sm"
            >
              <i className="fas fa-print" /> Cetak
            </button>
          )}
        </div>
      </div>

      {/* ── Filter Overlay (backdrop + panel) ─────────────────── */}
      {showFilter && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
          onClick={() => setShowFilter(false)}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />

          {/* Panel */}
          <div
            className="relative bg-white w-full sm:max-w-sm sm:mx-4 rounded-t-3xl sm:rounded-2xl shadow-2xl z-10"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drag handle (mobile only) */}
            <div className="flex justify-center pt-3 pb-1 sm:hidden">
              <div className="w-10 h-1.5 bg-gray-300 rounded-full" />
            </div>

            {/* Panel header */}
            <div className="flex justify-between items-center px-5 pt-4 pb-3 border-b border-gray-100">
              <span className="text-base font-bold text-gray-800">
                <i className="fas fa-filter mr-2 text-emerald-500" />Filter Data
              </span>
              <div className="flex items-center gap-2">
                {activeFilterCount > 0 && (
                  <button
                    onClick={handleClearFilters}
                    className="text-xs text-red-500 hover:text-red-700 font-semibold px-2.5 py-1.5 rounded-lg hover:bg-red-50 transition flex items-center gap-1"
                  >
                    <i className="fas fa-times" /> Reset
                  </button>
                )}
                <button
                  onClick={() => setShowFilter(false)}
                  className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 flex items-center justify-center transition"
                >
                  <i className="fas fa-times text-xs" />
                </button>
              </div>
            </div>

            {/* Panel body */}
            <div className="px-5 py-4">
              <FilterPanel />
            </div>

            {/* Apply button */}
            <div className="px-5 pb-6 sm:pb-4">
              <button
                onClick={() => setShowFilter(false)}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-xl font-bold text-sm transition shadow-sm"
              >
                Terapkan Filter
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Desktop table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-100 text-gray-700 text-xs uppercase tracking-wider border-b">
              <th className="px-3 py-2.5 font-bold">No.</th>
              <th className="px-3 py-2.5 font-bold">Tanggal</th>
              <th className="px-3 py-2.5 font-bold">Ruangan</th>
              <th className="px-3 py-2.5 font-bold text-right">Infeksius</th>
              <th className="px-3 py-2.5 font-bold text-right">Jarum</th>
              <th className="px-3 py-2.5 font-bold text-right">Botol</th>
              <th className="px-3 py-2.5 font-bold text-right">Sitotoksik</th>
              <th className="px-3 py-2.5 font-bold text-right">Total</th>
              <th className="px-3 py-2.5 font-bold">Petugas</th>
              <th className="px-3 py-2.5 font-bold text-center">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 text-xs">
            {loading ? (
              <tr><td colSpan="10" className="text-center py-10">
                <i className="fas fa-spinner fa-spin text-emerald-500 text-2xl mb-2 block" />
                <span className="text-gray-500 text-xs font-semibold">Memuat data...</span>
              </td></tr>
            ) : data.length === 0 ? (
              <tr><td colSpan="10" className="text-center py-12 text-gray-400">
                <i className="fas fa-inbox text-4xl mb-3 block opacity-40" />Belum ada data limbah ruangan.
              </td></tr>
            ) : (
              data.map((item, idx) => {
                const rowNo = (page - 1) * itemsPerPage + idx + 1;
                const inf = parseFloat(item.infeksius || 0);
                const jar = parseFloat(item.jarum_suntik || 0);
                const bot = parseFloat(item.botol_obat || 0);
                const sit = parseFloat(item.sitotoksik || 0);
                const total = inf + jar + bot + sit;
                return (
                  <tr key={item.id} className={item.isOffline ? "bg-amber-50/70 hover:bg-amber-100/70 border-l-4 border-l-amber-500 transition-colors" : "hover:bg-emerald-50/40 transition-colors"}>
                    <td className="px-3 py-2 text-gray-400 font-medium">{rowNo}</td>
                    <td className="px-3 py-2 font-medium text-gray-800 whitespace-nowrap">
                      {new Date(item.tanggal).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                      {item.isOffline && <span className="ml-1.5 inline-flex items-center gap-1 text-[9px] font-extrabold bg-amber-200 text-amber-900 border border-amber-400 px-1.5 py-px rounded-full shadow-2xs animate-pulse"><i className="fas fa-wifi-slash text-amber-700" />Draft</span>}
                    </td>
                    <td className="px-3 py-2 font-bold text-emerald-700">
                      <span className="inline-block bg-emerald-100 text-emerald-800 text-[10px] px-2 py-0.5 rounded-lg">{item.ruangan}</span>
                    </td>
                    <td className="px-3 py-2 text-right text-red-600 font-semibold">{inf.toFixed(2)}</td>
                    <td className="px-3 py-2 text-right text-orange-600 font-semibold">{jar.toFixed(2)}</td>
                    <td className="px-3 py-2 text-right text-blue-600 font-semibold">{bot.toFixed(2)}</td>
                    <td className="px-3 py-2 text-right text-purple-600 font-semibold">{sit.toFixed(2)}</td>
                    <td className="px-3 py-2 text-right font-black text-slate-800">{total.toFixed(2)} Kg</td>
                    <td className="px-3 py-2 text-gray-600">{item.petugas || '-'}</td>
                    <td className="px-3 py-2 text-center whitespace-nowrap">
                      <button onClick={() => onEdit(item)} className="bg-blue-100 text-blue-600 hover:bg-blue-200 px-2 py-1 rounded-lg mx-0.5 transition active:scale-95 text-xs"><i className="fas fa-edit" /></button>
                      <button onClick={() => onDelete(item)} className="bg-red-100 text-red-600 hover:bg-red-200 px-2 py-1 rounded-lg mx-0.5 transition active:scale-95 text-xs"><i className="fas fa-trash" /></button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile card list */}
      <div className="md:hidden divide-y divide-gray-100">
        {loading ? (
          <div className="text-center py-10">
            <i className="fas fa-spinner fa-spin text-emerald-500 text-2xl" />
            <p className="text-gray-500 text-xs mt-2">Memuat data...</p>
          </div>
        ) : data.length === 0 ? (
          <div className="text-center py-10 text-gray-400">
            <i className="fas fa-inbox text-3xl mb-2 block opacity-50" />
            <p className="text-xs">Belum ada data limbah ruangan.</p>
          </div>
        ) : (
          data.map((item, idx) => {
            const rowNo = (page - 1) * itemsPerPage + idx + 1;
            const inf = parseFloat(item.infeksius || 0);
            const jar = parseFloat(item.jarum_suntik || 0);
            const bot = parseFloat(item.botol_obat || 0);
            const sit = parseFloat(item.sitotoksik || 0);
            const total = inf + jar + bot + sit;
            return (
              <div key={item.id} className={`flex items-start gap-3 px-4 py-3 border-l-4 ${item.isOffline ? 'border-l-amber-500 bg-amber-50/60' : 'border-l-emerald-400'}`}>
                <span className="text-[10px] text-gray-400 font-bold pt-0.5 w-5 shrink-0">{rowNo}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap mb-1">
                    <span className="text-xs font-bold text-gray-800">{new Date(item.tanggal).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                    <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-px rounded-full">{item.ruangan}</span>
                    {item.isOffline && <span className="text-[9px] font-bold bg-amber-200 text-amber-900 px-1.5 py-px rounded-full animate-pulse">Draft</span>}
                  </div>
                  <div className="grid grid-cols-5 gap-x-1 gap-y-0.5 text-[10px]">
                    <div><span className="text-gray-400">Infeksius</span><br /><span className="font-bold text-red-600">{inf.toFixed(2)}</span></div>
                    <div><span className="text-gray-400">Jarum</span><br /><span className="font-bold text-orange-600">{jar.toFixed(2)}</span></div>
                    <div><span className="text-gray-400">Botol</span><br /><span className="font-bold text-blue-600">{bot.toFixed(2)}</span></div>
                    <div><span className="text-gray-400">Sito</span><br /><span className="font-bold text-purple-600">{sit.toFixed(2)}</span></div>
                    <div><span className="text-gray-400">Total</span><br /><span className="font-black text-slate-800">{total.toFixed(2)}</span></div>
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <button onClick={() => onEdit(item)} className="w-7 h-7 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center text-xs"><i className="fas fa-edit" /></button>
                  <button onClick={() => onDelete(item)} className="w-7 h-7 rounded-lg bg-red-100 text-red-600 flex items-center justify-center text-xs"><i className="fas fa-trash" /></button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
