import { useCallback, useEffect, useRef, useState } from 'react';
import { getOfflineQueue, syncOfflineQueue } from '../lib/offlineStorage';

export default function OfflineSyncIndicator() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [queue, setQueue] = useState([]);
  const [syncing, setSyncing] = useState(false);
  const syncingRef = useRef(false);
  const mountedRef = useRef(true);

  const runSync = useCallback(async (showNotification = false, force = false) => {
    if (!navigator.onLine || getOfflineQueue().length === 0 || syncingRef.current) return;

    syncingRef.current = true;
    setSyncing(true);

    try {
      await syncOfflineQueue(showNotification, force);
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

    const now = Date.now();
    const automaticItems = queue.filter(item => !item.requiresManualRetry);
    const hasReadyItem = automaticItems.some(item => {
      if (!item.nextRetryAt) return true;
      const retryAt = Date.parse(item.nextRetryAt);
      return Number.isNaN(retryAt) || retryAt <= now;
    });
    const futureRetryTimes = automaticItems
      .map(item => Date.parse(item.nextRetryAt || ''))
      .filter(retryAt => !Number.isNaN(retryAt) && retryAt > now);

    if (hasReadyItem) runSync();

    const handleFocus = () => runSync();
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') runSync();
    };
    const nextRetryAt = futureRetryTimes.length > 0 ? Math.min(...futureRetryTimes) : null;
    const retryTimer = nextRetryAt
      ? window.setTimeout(() => runSync(), Math.max(1000, nextRetryAt - now))
      : null;

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      if (retryTimer) window.clearTimeout(retryTimer);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isOnline, queue, runSync]);

  const handleManualSync = () => runSync(true, true);
  const manualRetryCount = queue.filter(item => item.requiresManualRetry).length;
  const latestError = [...queue].reverse().find(item => item.lastSyncError)?.lastSyncError;

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
          className={`flex items-center gap-2 ${manualRetryCount > 0 ? 'bg-amber-600/95 hover:bg-amber-700 border-amber-500/50' : 'bg-emerald-600/95 hover:bg-emerald-700 border-emerald-500/50'} text-white backdrop-blur-md px-3.5 py-1.5 rounded-full text-xs font-medium shadow-xl border cursor-pointer active:scale-95 transition-all disabled:opacity-60`}
          title={latestError || 'Klik untuk menyinkronkan data draft offline ke server'}
        >
          <i className={`fas ${syncing ? 'fa-spinner fa-spin' : manualRetryCount > 0 ? 'fa-exclamation-circle' : 'fa-cloud-upload-alt'} text-white/80 text-[11px]`}></i>
          <span>{syncing ? 'Menyinkronkan...' : manualRetryCount > 0 ? `Coba Lagi ${queue.length} Draft` : `Kirim ${queue.length} Data Draft`}</span>
        </button>
      )}
    </div>
  );
}
