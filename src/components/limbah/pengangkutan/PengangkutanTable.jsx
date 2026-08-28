import { useEffect, useState } from 'react';

const MONTH_NAMES = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

const monthValueToLabel = (value) => {
  if (!value) return 'Semua Bulan';
  const [year, month] = value.split('-');
  return MONTH_NAMES[Number(month) - 1] + ' ' + year;
};

export default function PengangkutanTable({
  data,
  loading,
  totalData,
  filterMonth,
  setFilterMonth,
  page,
  setPage,
  itemsPerPage,
  totalPages,
  totalOfflineCount,
  handleEdit,
  handleDelete,
  syncOfflineQueue
}) {
  const [showFilter, setShowFilter] = useState(false);
  const offlineCount = typeof totalOfflineCount === 'number'
    ? totalOfflineCount
    : data.filter(item => item.isOffline).length;
  const activeFilterCount = filterMonth ? 1 : 0;

  const selectedMonthLabel = monthValueToLabel(filterMonth);

  useEffect(() => {
    if (!showFilter) return undefined;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [showFilter]);

  const formatDate = (value) => new Date(value).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });

  return (
    <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
      {offlineCount > 0 && (
        <div className="bg-amber-50 border-b border-amber-200 text-amber-900 px-6 py-3 text-xs sm:text-sm font-medium flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <i className="fas fa-exclamation-triangle text-amber-600 text-base animate-pulse" />
            <span>
              Terdapat <strong>{offlineCount} data offline</strong> yang tersimpan di HP dan{' '}
              <strong>belum tersinkronisasi</strong> ke server.
            </span>
          </div>
          {navigator.onLine && (
            <button
              type="button"
              onClick={() => syncOfflineQueue(true, true)}
              className="bg-amber-600 hover:bg-amber-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-xs"
            >
              <i className="fas fa-cloud-upload-alt" /> Sinkronkan Sekarang
            </button>
          )}
        </div>
      )}

      <div className="bg-slate-800 text-white px-4 py-3 flex items-center justify-between gap-3">
        <h2 className="text-base font-bold flex items-center gap-2 min-w-0">
          <i className="fas fa-table shrink-0" />
          <span className="truncate">Riwayat Pengangkutan</span>
          <span className="text-[11px] font-normal text-slate-300 shrink-0">({totalData})</span>
        </h2>

        <button
          type="button"
          onClick={() => setShowFilter(true)}
          className={'flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition shrink-0 ' + (
            activeFilterCount > 0
              ? 'bg-orange-500 hover:bg-orange-600 text-white'
              : 'bg-white/10 hover:bg-white/20 text-white border border-white/20'
          )}
        >
          <i className="fas fa-filter" />
          Filter
          {activeFilterCount > 0 && (
            <span className="bg-white text-orange-700 text-[10px] font-black w-4 h-4 rounded-full flex items-center justify-center">
              {activeFilterCount}
            </span>
          )}
        </button>
      </div>

      {filterMonth && (
        <div className="px-4 py-2.5 bg-orange-50 border-b border-orange-100 flex items-center justify-between gap-3">
          <span className="inline-flex items-center gap-1.5 text-xs bg-orange-100 text-orange-700 px-2.5 py-1 rounded-full font-semibold min-w-0">
            <i className="fas fa-calendar-alt shrink-0" />
            <span className="truncate">{selectedMonthLabel}</span>
          </span>
          <button
            type="button"
            onClick={() => { setFilterMonth(''); setPage(1); }}
            className="text-xs text-red-500 hover:text-red-700 font-semibold shrink-0"
          >
            <i className="fas fa-times mr-1" />Reset
          </button>
        </div>
      )}

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
                <i className="fas fa-filter mr-2 text-orange-500" />Filter Data
              </span>
              <div className="flex items-center gap-2">
                {activeFilterCount > 0 && (
                  <button
                    type="button"
                    onClick={() => { setFilterMonth(''); setPage(1); }}
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

            <div className="px-5 py-4">
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">
                <i className="fas fa-calendar mr-1.5 text-orange-500" />Bulan dan Tahun
              </label>
              <input
                type="month"
                value={filterMonth}
                onChange={(event) => {
                  setFilterMonth(event.target.value);
                  setPage(1);
                }}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-medium outline-none focus:ring-2 focus:ring-orange-500 bg-gray-50"
              />
            </div>

            <div className="px-5 pb-6 sm:pb-4">
              <button
                type="button"
                onClick={() => setShowFilter(false)}
                className="w-full bg-orange-600 hover:bg-orange-700 text-white py-3 rounded-xl font-bold text-sm transition shadow-sm"
              >
                Terapkan Filter
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-100 text-gray-700 text-xs uppercase tracking-wider border-b">
              <th className="px-3 py-2.5 font-bold">No.</th>
              <th className="px-3 py-2.5 font-bold">Tanggal</th>
              <th className="px-3 py-2.5 font-bold text-right">Jumlah Diangkut</th>
              <th className="px-3 py-2.5 font-bold">Keterangan</th>
              <th className="px-3 py-2.5 font-bold">Petugas</th>
              <th className="px-3 py-2.5 font-bold text-center">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 text-xs">
            {loading ? (
              <tr>
                <td colSpan="6" className="text-center py-10">
                  <i className="fas fa-spinner fa-spin text-orange-500 text-2xl mb-2 block" />
                  <span className="text-gray-500 text-xs font-semibold">Memuat data...</span>
                </td>
              </tr>
            ) : data.length === 0 ? (
              <tr>
                <td colSpan="6" className="text-center py-12 text-gray-400">
                  <i className="fas fa-inbox text-4xl mb-3 block opacity-40" />
                  Belum ada data pengangkutan.
                </td>
              </tr>
            ) : (
              data.map((item, idx) => {
                const rowNo = (page - 1) * itemsPerPage + idx + 1;
                const amount = parseFloat(item.jumlah_kg || 0);
                return (
                  <tr
                    key={item.id}
                    className={item.isOffline
                      ? 'bg-amber-50/70 hover:bg-amber-100/70 border-l-4 border-l-amber-500 transition-colors'
                      : 'hover:bg-orange-50/40 transition-colors'}
                  >
                    <td className="px-3 py-2 text-gray-400 font-medium">{rowNo}</td>
                    <td className="px-3 py-2 font-medium text-gray-800 whitespace-nowrap">
                      {formatDate(item.tanggal)}
                      {item.isOffline && (
                        <span className="ml-1.5 inline-flex items-center gap-1 text-[9px] font-extrabold bg-amber-200 text-amber-900 border border-amber-400 px-1.5 py-px rounded-full shadow-2xs animate-pulse">
                          <i className="fas fa-wifi-slash text-amber-700" />Draft
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <span className="inline-block bg-orange-100 text-orange-700 text-[10px] font-black px-2 py-1 rounded-lg whitespace-nowrap">
                        {amount.toFixed(2)} Kg
                      </span>
                    </td>
                    <td className="px-3 py-2 text-gray-600 max-w-xs">
                      <span className="block truncate" title={item.keterangan || '-'}>
                        {item.keterangan || '-'}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-gray-600">{item.petugas || '-'}</td>
                    <td className="px-3 py-2 text-center whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => handleEdit(item)}
                        className="bg-blue-100 text-blue-600 hover:bg-blue-200 px-2 py-1 rounded-lg mx-0.5 transition active:scale-95 text-xs"
                        aria-label="Edit data"
                      >
                        <i className="fas fa-edit" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(item)}
                        className="bg-red-100 text-red-600 hover:bg-red-200 px-2 py-1 rounded-lg mx-0.5 transition active:scale-95 text-xs"
                        aria-label="Hapus data"
                      >
                        <i className="fas fa-trash" />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="md:hidden divide-y divide-gray-100">
        {loading ? (
          <div className="text-center py-10">
            <i className="fas fa-spinner fa-spin text-orange-500 text-2xl" />
            <p className="text-gray-500 text-xs mt-2">Memuat data...</p>
          </div>
        ) : data.length === 0 ? (
          <div className="text-center py-10 text-gray-400">
            <i className="fas fa-inbox text-3xl mb-2 block opacity-50" />
            <p className="text-xs">Belum ada data pengangkutan.</p>
          </div>
        ) : (
          data.map((item, idx) => {
            const rowNo = (page - 1) * itemsPerPage + idx + 1;
            const amount = parseFloat(item.jumlah_kg || 0);
            return (
              <div
                key={item.id}
                className={'flex items-start gap-3 px-4 py-3 border-l-4 ' + (
                  item.isOffline ? 'border-l-amber-500 bg-amber-50/60' : 'border-l-orange-400'
                )}
              >
                <span className="text-[10px] text-gray-400 font-bold pt-0.5 w-5 shrink-0">{rowNo}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap mb-1">
                    <span className="text-xs font-bold text-gray-800">{formatDate(item.tanggal)}</span>
                    {item.isOffline && (
                      <span className="text-[9px] font-bold bg-amber-200 text-amber-900 px-1.5 py-px rounded-full animate-pulse">
                        Draft
                      </span>
                    )}
                  </div>
                  <div className="flex items-baseline gap-1 mb-1">
                    <span className="text-base font-black text-orange-600">{amount.toFixed(2)}</span>
                    <span className="text-[10px] font-bold text-gray-400">Kg</span>
                  </div>
                  <p className="text-[10px] text-gray-500 truncate">
                    <i className="fas fa-user mr-1 text-gray-400" />
                    {item.petugas || '-'}
                  </p>
                  {item.keterangan && (
                    <p className="text-[10px] text-gray-400 truncate mt-0.5" title={item.keterangan}>
                      {item.keterangan}
                    </p>
                  )}
                </div>
                <div className="flex gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleEdit(item)}
                    className="w-7 h-7 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center text-xs"
                    aria-label="Edit data"
                  >
                    <i className="fas fa-edit" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(item)}
                    className="w-7 h-7 rounded-lg bg-red-100 text-red-600 flex items-center justify-center text-xs"
                    aria-label="Hapus data"
                  >
                    <i className="fas fa-trash" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {totalPages > 0 && (
        <div className="flex flex-col sm:flex-row justify-between items-center px-6 py-4 bg-gray-50 border-t text-sm gap-3">
          <div className="flex items-center space-x-2 text-gray-600">
            <span>Halaman</span>
            <input
              type="number"
              min="1"
              max={totalPages}
              value={page}
              onChange={(event) => {
                let value = parseInt(event.target.value, 10);
                if (Number.isNaN(value) || value < 1) value = 1;
                if (value > totalPages) value = totalPages;
                setPage(value);
              }}
              className="w-16 px-2 py-1 border rounded-lg text-center outline-none focus:ring-2 focus:ring-orange-500 font-bold bg-white text-xs"
            />
            <span>dari {totalPages}</span>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page === 1}
              className="px-3.5 py-1.5 bg-white border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-100 disabled:opacity-50 transition text-xs font-semibold"
            >
              Sebelumnya
            </button>
            <button
              type="button"
              onClick={() => setPage(Math.min(totalPages, page + 1))}
              disabled={page === totalPages}
              className="px-3.5 py-1.5 bg-white border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-100 disabled:opacity-50 transition text-xs font-semibold"
            >
              Selanjutnya
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
