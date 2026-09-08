import { useEffect, useState } from 'react';
import PengangkutanDesktopTable from './PengangkutanDesktopTable';
import PengangkutanMobileList from './PengangkutanMobileList';
import PengangkutanPagination from './PengangkutanPagination';

const MONTH_NAMES = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

const monthValueToLabel = (value) => {
  if (!value) return 'Semua Bulan';
  const [year, month] = value.split('-');
  return MONTH_NAMES[Number(month) - 1] + ' ' + year;
};

const formatDate = (value) => new Date(value).toLocaleDateString('id-ID', {
  day: 'numeric', month: 'short', year: 'numeric'
});

export default function PengangkutanTable({
  data, loading, totalData, filterMonth, setFilterMonth, page, setPage,
  itemsPerPage, totalPages, totalOfflineCount, handleEdit, handleDelete,
  syncOfflineQueue
}) {
  const [showFilter, setShowFilter] = useState(false);
  const offlineCount = typeof totalOfflineCount === 'number'
    ? totalOfflineCount
    : data.filter(item => item.isOffline).length;

  useEffect(() => {
    if (!showFilter) return undefined;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = originalOverflow; };
  }, [showFilter]);

  const resetFilter = () => {
    setFilterMonth('');
    setPage(1);
  };

  const listProps = {
    data, loading, page, itemsPerPage, formatDate,
    onEdit: handleEdit, onDelete: handleDelete
  };

  return (
    <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
      {offlineCount > 0 && (
        <div className="bg-amber-50 border-b border-amber-200 text-amber-900 px-6 py-3 text-xs sm:text-sm font-medium flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <i className="fas fa-exclamation-triangle text-amber-600 text-base animate-pulse" />
            <span>Terdapat <strong>{offlineCount} data offline</strong> yang tersimpan di HP dan <strong>belum tersinkronisasi</strong> ke server.</span>
          </div>
          {navigator.onLine && (
            <button type="button" onClick={() => syncOfflineQueue(true, true)} className="bg-amber-600 hover:bg-amber-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-xs">
              <i className="fas fa-cloud-upload-alt" /> Sinkronkan Sekarang
            </button>
          )}
        </div>
      )}

      <div className="bg-slate-800 text-white px-4 py-3 flex items-center justify-between gap-3">
        <h2 className="text-base font-bold flex items-center gap-2 min-w-0">
          <i className="fas fa-table shrink-0" /><span className="truncate">Riwayat Pengangkutan</span>
          <span className="text-[11px] font-normal text-slate-300 shrink-0">({totalData})</span>
        </h2>
        <button type="button" onClick={() => setShowFilter(true)} className={'flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition shrink-0 ' + (filterMonth ? 'bg-orange-500 hover:bg-orange-600 text-white' : 'bg-white/10 hover:bg-white/20 text-white border border-white/20')}>
          <i className="fas fa-filter" />Filter
          {filterMonth && <span className="bg-white text-orange-700 text-[10px] font-black w-4 h-4 rounded-full flex items-center justify-center">1</span>}
        </button>
      </div>

      {filterMonth && (
        <div className="px-4 py-2.5 bg-orange-50 border-b border-orange-100 flex items-center justify-between gap-3">
          <span className="inline-flex items-center gap-1.5 text-xs bg-orange-100 text-orange-700 px-2.5 py-1 rounded-full font-semibold min-w-0"><i className="fas fa-calendar-alt shrink-0" /><span className="truncate">{monthValueToLabel(filterMonth)}</span></span>
          <button type="button" onClick={resetFilter} className="text-xs text-red-500 hover:text-red-700 font-semibold shrink-0"><i className="fas fa-times mr-1" />Reset</button>
        </div>
      )}

      {showFilter && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" onClick={() => setShowFilter(false)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div className="relative bg-white w-full sm:max-w-sm sm:mx-4 rounded-t-3xl sm:rounded-2xl shadow-2xl z-10" onClick={(event) => event.stopPropagation()}>
            <div className="flex justify-center pt-3 pb-1 sm:hidden"><div className="w-10 h-1.5 bg-gray-300 rounded-full" /></div>
            <div className="flex justify-between items-center px-5 pt-4 pb-3 border-b border-gray-100">
              <span className="text-base font-bold text-gray-800"><i className="fas fa-filter mr-2 text-orange-500" />Filter Data</span>
              <div className="flex items-center gap-2">
                {filterMonth && <button type="button" onClick={resetFilter} className="text-xs text-red-500 hover:text-red-700 font-semibold px-2.5 py-1.5 rounded-lg hover:bg-red-50 transition flex items-center gap-1"><i className="fas fa-times" /> Reset</button>}
                <button type="button" onClick={() => setShowFilter(false)} className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 flex items-center justify-center transition" aria-label="Tutup filter"><i className="fas fa-times text-xs" /></button>
              </div>
            </div>
            <div className="px-5 py-4">
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5"><i className="fas fa-calendar mr-1.5 text-orange-500" />Bulan dan Tahun</label>
              <input type="month" value={filterMonth} onChange={(event) => { setFilterMonth(event.target.value); setPage(1); }} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-medium outline-none focus:ring-2 focus:ring-orange-500 bg-gray-50" />
            </div>
            <div className="px-5 pb-6 sm:pb-4"><button type="button" onClick={() => setShowFilter(false)} className="w-full bg-orange-600 hover:bg-orange-700 text-white py-3 rounded-xl font-bold text-sm transition shadow-sm">Terapkan Filter</button></div>
          </div>
        </div>
      )}

      <PengangkutanDesktopTable {...listProps} />
      <PengangkutanMobileList {...listProps} />
      <PengangkutanPagination page={page} setPage={setPage} totalPages={totalPages} />
    </div>
  );
}
