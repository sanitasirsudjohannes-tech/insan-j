import { useEffect, useState } from 'react';

/**
 * PadatTable – tabel data limbah padat (akumulasi harian) + mobile card.
 *
 * Props:
 *  data, loading, page, itemsPerPage, totalData,
 *  filterMonth, setFilterMonth, setPage,
 *  onEdit, onDelete, onPrint
 */
export default function PadatTable({
  data,
  loading,
  page,
  itemsPerPage,
  totalData,
  filterMonth,
  setFilterMonth,
  setPage,
  onEdit,
  onDelete,
  onPrint,
}) {
  const [showFilter, setShowFilter] = useState(false);
  const activeFilterCount = filterMonth ? 1 : 0;

  useEffect(() => {
    if (!showFilter) return undefined;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [showFilter]);

  const handleClearFilters = () => {
    setFilterMonth('');
    setPage(1);
  };

  return (
    <div className="bg-white rounded-lg shadow-lg overflow-hidden">
      {/* Info banner: keterangan warna baris */}
      <div className="bg-emerald-50 border-b border-emerald-200 px-5 py-2.5 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs text-gray-700">
        <span className="font-semibold text-emerald-800 flex items-center gap-1.5">
          <i className="fas fa-layer-group text-emerald-600" /> Keterangan Baris:
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-emerald-200 border-l-2 border-emerald-600 inline-block" />
          <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-800 border border-emerald-300 px-1.5 py-px rounded-full font-semibold text-[10px]">
            <i className="fas fa-hospital" /> N Ruangan
          </span>
          Akumulasi otomatis dari input per ruangan
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-sky-200 border-l-2 border-sky-600 inline-block" />
          <span className="inline-flex items-center gap-1 bg-sky-100 text-sky-800 border border-sky-300 px-1.5 py-px rounded-full font-semibold text-[10px]">
            <i className="fas fa-edit" /> + Manual
          </span>
          Akumulasi ruangan + input manual
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-gray-200 border-l-2 border-gray-400 inline-block" />
          Input manual (tanpa data ruangan)
        </span>
      </div>

      {/* Header bar */}
      <div className="bg-slate-800 text-white px-4 py-3 flex items-center justify-between gap-3">
        <h2 className="text-base font-bold flex items-center gap-2 min-w-0">
          <i className="fas fa-table shrink-0" />
          <span className="truncate">Data Limbah Padat</span>
          <span className="text-[11px] font-normal text-slate-300 shrink-0">({totalData})</span>
        </h2>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setShowFilter(true)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition ${
              activeFilterCount > 0
                ? 'bg-blue-500 hover:bg-blue-600 text-white'
                : 'bg-white/10 hover:bg-white/20 text-white border border-white/20'
            }`}
          >
            <i className="fas fa-filter" />
            Filter
            {activeFilterCount > 0 && (
              <span className="bg-white text-blue-700 text-[10px] font-black w-4 h-4 rounded-full flex items-center justify-center">
                {activeFilterCount}
              </span>
            )}
          </button>

          {onPrint && (
            <button
              type="button"
              onClick={onPrint}
              className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-xl transition text-xs font-semibold flex items-center gap-1.5 shadow-sm"
            >
              <i className="fas fa-print" /> Cetak
            </button>
          )}
        </div>
      </div>

      {showFilter && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" onClick={() => setShowFilter(false)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div
            className="relative bg-white w-full sm:max-w-sm sm:mx-4 rounded-t-3xl sm:rounded-2xl shadow-2xl z-10"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex justify-center pt-3 pb-1 sm:hidden">
              <div className="w-10 h-1.5 bg-gray-300 rounded-full" />
            </div>
            <div className="flex justify-between items-center px-5 pt-4 pb-3 border-b border-gray-100">
              <span className="text-base font-bold text-gray-800">
                <i className="fas fa-filter mr-2 text-blue-500" />Filter Data
              </span>
              <div className="flex items-center gap-2">
                {activeFilterCount > 0 && (
                  <button
                    type="button"
                    onClick={handleClearFilters}
                    className="text-xs text-red-500 hover:text-red-700 font-semibold px-2.5 py-1.5 rounded-lg hover:bg-red-50 transition flex items-center gap-1"
                  >
                    <i className="fas fa-times" /> Reset
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setShowFilter(false)}
                  className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 flex items-center justify-center transition"
                  aria-label="Tutup filter"
                >
                  <i className="fas fa-times text-xs" />
                </button>
              </div>
            </div>

            <div className="px-5 py-4 space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">
                  <i className="fas fa-calendar mr-1.5 text-blue-500" />Periode
                </label>
                <input
                  type="month"
                  value={filterMonth}
                  onChange={(event) => {
                    setFilterMonth(event.target.value);
                    setPage(1);
                  }}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-medium outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50"
                />
              </div>

              {filterMonth && (
                <div className="pt-3 border-t border-gray-100">
                  <p className="text-[10px] font-bold text-gray-400 uppercase mb-1.5">Filter Aktif</p>
                  <span className="text-xs bg-blue-100 text-blue-700 px-2.5 py-1 rounded-full font-semibold">
                    📅 {filterMonth}
                  </span>
                </div>
              )}
            </div>

            <div className="px-5 pb-6 sm:pb-4">
              <button
                type="button"
                onClick={() => setShowFilter(false)}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-bold text-sm transition shadow-sm"
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
            <tr className="bg-gray-100 text-gray-700 text-xs border-b">
              <th className="px-3 py-2.5">No.</th>
              <th className="px-3 py-2.5">Tanggal</th>
              <th className="px-3 py-2.5 text-right">Infeksius</th>
              <th className="px-3 py-2.5 text-right">Jarum</th>
              <th className="px-3 py-2.5 text-right">Botol</th>
              <th className="px-3 py-2.5 text-right">Sitotoksik</th>
              <th className="px-3 py-2.5 text-center">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="7" className="text-center py-8">
                <i className="fas fa-spinner fa-spin text-blue-500 text-2xl" />
                <p className="text-gray-500 text-sm mt-2">Memuat data...</p>
              </td></tr>
            ) : data.length === 0 ? (
              <tr><td colSpan="7" className="text-center py-8 text-gray-400">
                <i className="fas fa-inbox text-4xl mb-2 block" />Belum ada data.
              </td></tr>
            ) : (
              data.map((item, idx) => {
                const rowNo = (page - 1) * itemsPerPage + idx + 1;
                const isRoomOnly = item.isRoomAccumulation && !item.isManual;
                const isMixed = item.isRoomAccumulation && item.isManual;
                let rowClass = 'border-b hover:bg-gray-50 transition-colors';
                if (item.isOffline) rowClass = 'bg-amber-50/70 hover:bg-amber-100/70 border-l-4 border-l-amber-500 border-b transition-colors';
                else if (isRoomOnly) rowClass = 'bg-emerald-50/60 hover:bg-emerald-100/60 border-l-4 border-l-emerald-500 border-b transition-colors';
                else if (isMixed) rowClass = 'bg-sky-50/60 hover:bg-sky-100/60 border-l-4 border-l-sky-500 border-b transition-colors';
                return (
                  <tr key={item.id} className={rowClass}>
                    <td className="px-3 py-2.5 text-gray-400 text-xs">{rowNo}</td>
                    <td className="px-3 py-2.5 font-medium text-gray-800">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-xs whitespace-nowrap">{new Date(item.tanggal).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                        <div className="flex flex-wrap gap-1">
                          {isRoomOnly && <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 px-1.5 py-px rounded-full"><i className="fas fa-hospital" />{item.ruanganCount} Ruangan</span>}
                          {isMixed && <><span className="inline-flex items-center gap-1 text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 px-1.5 py-px rounded-full"><i className="fas fa-hospital" />{item.ruanganCount}R</span><span className="inline-flex items-center gap-1 text-[10px] font-bold bg-sky-100 text-sky-800 border border-sky-300 px-1.5 py-px rounded-full"><i className="fas fa-edit" />+Manual</span></>}
                          {item.isOffline && <span className="inline-flex items-center gap-1 text-[10px] font-extrabold bg-amber-200 text-amber-900 border border-amber-400 px-1.5 py-px rounded-full animate-pulse"><i className="fas fa-wifi-slash" />Draft</span>}
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-right text-red-600 font-semibold text-xs">{parseFloat(item.infeksius || 0).toFixed(2)}</td>
                    <td className="px-3 py-2.5 text-right text-orange-600 font-semibold text-xs">{parseFloat(item.jarum_suntik || 0).toFixed(2)}</td>
                    <td className="px-3 py-2.5 text-right text-blue-600 font-semibold text-xs">{parseFloat(item.botol_obat || 0).toFixed(2)}</td>
                    <td className="px-3 py-2.5 text-right text-purple-600 font-semibold text-xs">{parseFloat(item.sitotoksik || 0).toFixed(2)}</td>
                    <td className="px-3 py-2.5 text-center">
                      {isRoomOnly ? (
                        <button onClick={() => onEdit(item)} className="bg-emerald-100 text-emerald-700 hover:bg-emerald-200 px-2 py-1 rounded text-xs" title="Lihat Detail"><i className="fas fa-eye" /></button>
                      ) : (
                        <>
                          <button onClick={() => onEdit(item)} className="bg-blue-100 text-blue-600 hover:bg-blue-200 px-2 py-1 rounded mx-0.5 text-xs"><i className="fas fa-edit" /></button>
                          <button onClick={() => onDelete(item)} className="bg-red-100 text-red-600 hover:bg-red-200 px-2 py-1 rounded mx-0.5 text-xs"><i className="fas fa-trash" /></button>
                        </>
                      )}
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
            <i className="fas fa-spinner fa-spin text-blue-500 text-2xl" />
            <p className="text-gray-500 text-xs mt-2">Memuat data...</p>
          </div>
        ) : data.length === 0 ? (
          <div className="text-center py-10 text-gray-400">
            <i className="fas fa-inbox text-3xl mb-2 block opacity-50" />
            <p className="text-xs">Belum ada data.</p>
          </div>
        ) : (
          data.map((item, idx) => {
            const rowNo = (page - 1) * itemsPerPage + idx + 1;
            const isRoomOnly = item.isRoomAccumulation && !item.isManual;
            const isMixed = item.isRoomAccumulation && item.isManual;
            const borderColor = item.isOffline ? 'border-l-amber-500' : isRoomOnly ? 'border-l-emerald-500' : isMixed ? 'border-l-sky-500' : 'border-l-gray-300';
            return (
              <div key={item.id} className={`flex items-start gap-3 px-4 py-3 border-l-4 ${borderColor}`}>
                <span className="text-[10px] text-gray-400 font-bold pt-0.5 w-5 shrink-0">{rowNo}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
                    <span className="text-xs font-bold text-gray-800">{new Date(item.tanggal).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                    {isRoomOnly && <span className="inline-flex items-center gap-1 text-[9px] font-bold bg-emerald-100 text-emerald-800 px-1.5 py-px rounded-full"><i className="fas fa-hospital" />{item.ruanganCount}R</span>}
                    {isMixed && <><span className="inline-flex items-center gap-1 text-[9px] font-bold bg-emerald-100 text-emerald-800 px-1.5 py-px rounded-full"><i className="fas fa-hospital" />{item.ruanganCount}R</span><span className="inline-flex items-center gap-1 text-[9px] font-bold bg-sky-100 text-sky-800 px-1.5 py-px rounded-full">+Manual</span></>}
                    {item.isOffline && <span className="inline-flex items-center gap-1 text-[9px] font-bold bg-amber-200 text-amber-900 px-1.5 py-px rounded-full animate-pulse">Draft</span>}
                  </div>
                  <div className="grid grid-cols-4 gap-x-2 gap-y-0.5 text-[10px]">
                    <div><span className="text-gray-400">Infeksius</span><br /><span className="font-bold text-red-600">{parseFloat(item.infeksius || 0).toFixed(2)}</span></div>
                    <div><span className="text-gray-400">Jarum</span><br /><span className="font-bold text-orange-600">{parseFloat(item.jarum_suntik || 0).toFixed(2)}</span></div>
                    <div><span className="text-gray-400">Botol</span><br /><span className="font-bold text-blue-600">{parseFloat(item.botol_obat || 0).toFixed(2)}</span></div>
                    <div><span className="text-gray-400">Sito</span><br /><span className="font-bold text-purple-600">{parseFloat(item.sitotoksik || 0).toFixed(2)}</span></div>
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  {isRoomOnly ? (
                    <button onClick={() => onEdit(item)} className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs" title="Lihat Detail"><i className="fas fa-eye" /></button>
                  ) : (
                    <>
                      <button onClick={() => onEdit(item)} className="w-7 h-7 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center text-xs"><i className="fas fa-edit" /></button>
                      <button onClick={() => onDelete(item)} className="w-7 h-7 rounded-lg bg-red-100 text-red-600 flex items-center justify-center text-xs"><i className="fas fa-trash" /></button>
                    </>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
