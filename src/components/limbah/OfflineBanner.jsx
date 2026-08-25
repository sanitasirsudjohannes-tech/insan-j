import { syncOfflineQueue } from '../../lib/offlineStorage';

/**
 * OfflineBanner – ditampilkan ketika ada data offline yang belum tersinkronisasi.
 *
 * @param {Array}   data - Array data yang sedang ditampilkan di tabel.
 * @param {number}  totalOfflineCount - Seluruh antrean tabel, tanpa terpengaruh filter/halaman.
 */
export default function OfflineBanner({ data, totalOfflineCount }) {
  const offlineCount = typeof totalOfflineCount === 'number'
    ? totalOfflineCount
    : data.filter(i => i.isOffline).length;
  if (offlineCount === 0) return null;

  return (
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
          onClick={() => syncOfflineQueue(true, true)}
          className="bg-amber-600 hover:bg-amber-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-xs"
        >
          <i className="fas fa-cloud-upload-alt" /> Sinkronkan Sekarang
        </button>
      )}
    </div>
  );
}
