import { useCallback, useEffect, useRef, useState } from 'react';
import { getOfflineQueue, syncOfflineQueue } from '../lib/offlineStorage';

const AUTO_SYNC_INTERVAL_MS = 30_000;

export default function OfflineSyncIndicator() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [queue, setQueue] = useState([]);
  const [syncing, setSyncing] = useState(false);
  const syncingRef = useRef(false);
  const mountedRef = useRef(true);

  const runSync = useCallback(async (showNotification = false) => {
    if (!navigator.onLine || getOfflineQueue().length === 0 || syncingRef.current) return;

    syncingRef.current = true;
    setSyncing(true);

    try {
      await syncOfflineQueue(showNotification);
    } catch (error) {
      console.error('Sinkronisasi draft offline gagal:', error);
    } finally {
      syncingRef.current = false;
      if (mountedRef.current) setSyncing(false);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    setQueue(getOfflineQueue());

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    const handleQueueChange = (e) => setQueue(e.detail || getOfflineQueue());

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('offline-queue-changed', handleQueueChange);

    return () => {
      mountedRef.current = false;
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('offline-queue-changed', handleQueueChange);
    };
  }, []);

  useEffect(() => {
    if (!isOnline || queue.length === 0) return;

    runSync();

    const handleFocus = () => runSync();
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') runSync();
    };
    const intervalId = window.setInterval(handleFocus, AUTO_SYNC_INTERVAL_MS);

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isOnline, queue.length, runSync]);

  const handleManualSync = () => runSync(true);

  // Bersih: Sembunyikan total jika online & tidak ada antrean pending
  if (isOnline && queue.length === 0) {
    return null;
  }

  return (
    <div className="fixed top-3 left-1/2 -translate-x-1/2 z-50 pointer-events-auto transition-all duration-300">
      {!isOnline ? (
        <div
          className="flex items-center gap-2 bg-slate-900/90 text-white backdrop-blur-md px-3.5 py-1.5 rounded-full text-xs font-medium shadow-xl border border-slate-700/60"
          title="Koneksi terputus. Inputan baru disimpan sementara di HP."
        >
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
          </span>
          <i className="fas fa-wifi-slash text-rose-400 text-[11px]"></i>
          <span>Mode Offline{queue.length > 0 ? ` · ${queue.length} Draft` : ''}</span>
        </div>
      ) : (
        <button
          onClick={handleManualSync}
          disabled={syncing}
          className="flex items-center gap-2 bg-emerald-600/95 hover:bg-emerald-700 text-white backdrop-blur-md px-3.5 py-1.5 rounded-full text-xs font-medium shadow-xl border border-emerald-500/50 cursor-pointer active:scale-95 transition-all disabled:opacity-60"
          title="Klik untuk menyinkronkan data draft offline ke server"
        >
          <i className={`fas ${syncing ? 'fa-spinner fa-spin' : 'fa-cloud-upload-alt'} text-emerald-200 text-[11px]`}></i>
          <span>{syncing ? 'Menyinkronkan...' : `Kirim ${queue.length} Data Draft`}</span>
        </button>
      )}
    </div>
  );
}
