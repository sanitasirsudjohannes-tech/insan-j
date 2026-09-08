import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Swal from 'sweetalert2';
import {
  getOfflineQueue,
  removeOfflineQueueItem,
  syncOfflineQueue,
} from '../lib/offlineStorage';
import StatusBadge from './ui/StatusBadge';

const LAST_SYNC_KEY = 'insan_j_last_sync_at';

const formatLastSync = (value) => {
  if (!value) return 'Belum ada sinkronisasi pada perangkat ini';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Waktu sinkronisasi belum tersedia';
  return `Terakhir sinkron ${date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}, ${date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WITA`;
};

export default function OfflineSyncIndicator() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [queue, setQueue] = useState(() => getOfflineQueue());
  const [syncing, setSyncing] = useState(false);
  const [open, setOpen] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState(() => localStorage.getItem(LAST_SYNC_KEY));
  const syncingRef = useRef(false);
  const mountedRef = useRef(true);

  const refreshQueue = useCallback(() => setQueue(getOfflineQueue()), []);

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
      if (mountedRef.current) {
        setSyncing(false);
        refreshQueue();
      }
    }
  }, [refreshQueue]);

  useEffect(() => {
    mountedRef.current = true;
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    const handleQueueChange = () => refreshQueue();
    const handleSyncFinished = () => {
      refreshQueue();
      if (getOfflineQueue().length === 0) {
        const timestamp = new Date().toISOString();
        localStorage.setItem(LAST_SYNC_KEY, timestamp);
        setLastSyncAt(timestamp);
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('offline-queue-changed', handleQueueChange);
    window.addEventListener('offline-sync-finished', handleSyncFinished);
    return () => {
      mountedRef.current = false;
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('offline-queue-changed', handleQueueChange);
      window.removeEventListener('offline-sync-finished', handleSyncFinished);
    };
  }, [refreshQueue]);

  useEffect(() => {
    if (!open) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previousOverflow; };
  }, [open]);

  useEffect(() => {
    if (!isOnline || queue.length === 0) return undefined;
    const now = Date.now();
    const automaticItems = queue.filter(item => !item.requiresManualRetry);
    const hasReadyItem = automaticItems.some(item => {
      const retryAt = Date.parse(item.nextRetryAt || '');
      return !item.nextRetryAt || Number.isNaN(retryAt) || retryAt <= now;
    });
    const futureRetryTimes = automaticItems
      .map(item => Date.parse(item.nextRetryAt || ''))
      .filter(retryAt => !Number.isNaN(retryAt) && retryAt > now);

    if (hasReadyItem) runSync();
    const nextRetryAt = futureRetryTimes.length ? Math.min(...futureRetryTimes) : null;
    const retryTimer = nextRetryAt
      ? window.setTimeout(() => runSync(), Math.max(1000, nextRetryAt - now))
      : null;
    const handleFocus = () => runSync();
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') runSync();
    };
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      if (retryTimer) window.clearTimeout(retryTimer);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [isOnline, queue, runSync]);

  const conflictedItems = queue.filter(item => item.syncConflict);
  const failedItems = queue.filter(item => item.requiresManualRetry);
  const latestError = [...queue].reverse().find(item => item.lastSyncError)?.lastSyncError;

  const handleManualSync = async () => {
    if (conflictedItems.length === 0) {
      await runSync(true, true);
      return;
    }
    const choice = await Swal.fire({
      icon: 'warning',
      title: `${conflictedItems.length} Draft Bertentangan`,
      text: 'Pertahankan draft lokal atau batalkan agar versi server tetap digunakan.',
      showDenyButton: true,
      showCancelButton: true,
      confirmButtonText: 'Pertahankan Draft',
      denyButtonText: 'Batalkan Draft',
      cancelButtonText: 'Tutup',
      confirmButtonColor: '#2563eb',
      denyButtonColor: '#dc2626',
    });
    if (choice.isDenied) {
      const confirmation = await Swal.fire({
        icon: 'warning',
        title: 'Batalkan Perubahan Lokal?',
        text: `${conflictedItems.length} draft konflik akan dibuang.`,
        showCancelButton: true,
        confirmButtonText: 'Ya, Batalkan',
        cancelButtonText: 'Kembali',
        confirmButtonColor: '#dc2626',
      });
      if (!confirmation.isConfirmed) return;
      conflictedItems.forEach(item => removeOfflineQueueItem(item.id));
    }
    if (choice.isConfirmed || choice.isDenied) await runSync(true, true);
  };

  const tone = !isOnline ? 'danger' : failedItems.length || conflictedItems.length ? 'warning' : queue.length ? 'info' : 'success';
  const icon = syncing ? 'fas fa-spinner fa-spin' : !isOnline ? 'fas fa-wifi-slash' : failedItems.length || conflictedItems.length ? 'fas fa-exclamation-circle' : queue.length ? 'fas fa-cloud-upload-alt' : 'fas fa-cloud';
  const label = !isOnline ? 'Offline' : syncing ? 'Sinkronisasi' : queue.length ? `${queue.length} draft` : 'Tersinkron';
  const bannerLabel = !isOnline
    ? `Mode Offline${queue.length ? ` · ${queue.length} Draft` : ''}`
    : syncing
      ? `Mengirim ${queue.length} Draft...`
      : conflictedItems.length
        ? `${conflictedItems.length} Konflik Perlu Diperiksa`
        : failedItems.length
          ? `${failedItems.length} Draft Belum Terkirim`
          : `${queue.length} Draft Menunggu`;
  const showBanner = !isOnline || syncing || queue.length > 0;

  return (
    <>
      {showBanner && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={`fixed top-3 left-1/2 -translate-x-1/2 z-50 inline-flex items-center gap-2.5 max-w-[calc(100vw-2rem)] px-4 py-2 rounded-full text-xs font-bold text-white border backdrop-blur-xl transition-all duration-300 active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-white ${!isOnline ? 'bg-linear-to-r from-slate-950/95 to-slate-800/95 border-white/15 shadow-[0_10px_30px_rgba(15,23,42,0.35),inset_0_1px_0_rgba(255,255,255,0.12)]' : failedItems.length || conflictedItems.length ? 'bg-linear-to-r from-amber-600/95 to-orange-600/95 border-white/20 shadow-[0_10px_30px_rgba(217,119,6,0.28),inset_0_1px_0_rgba(255,255,255,0.18)]' : 'bg-linear-to-r from-blue-600/95 to-cyan-600/95 border-white/20 shadow-[0_10px_30px_rgba(37,99,235,0.28),inset_0_1px_0_rgba(255,255,255,0.18)]'}`}
          aria-label={`Buka rincian sinkronisasi: ${bannerLabel}`}
          title="Tekan untuk melihat rincian sinkronisasi"
        >
          {!isOnline ? (
            <span className="relative flex h-2.5 w-2.5 shrink-0" aria-hidden="true">
              <span className="sync-status-pulse absolute inline-flex h-full w-full rounded-full bg-rose-400" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-rose-500 ring-2 ring-rose-300/30" />
            </span>
          ) : (
            <i className={icon} aria-hidden="true" />
          )}
          <span className="truncate">{bannerLabel}</span>
          <i className="fas fa-chevron-down text-[9px] opacity-75" aria-hidden="true" />
        </button>
      )}

      {open && createPortal((
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center" onClick={() => setOpen(false)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <section className="relative z-10 w-full sm:max-w-md sm:mx-4 bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden" onClick={event => event.stopPropagation()} aria-label="Status sinkronisasi">
            <div className="flex justify-center pt-3 sm:hidden"><span className="w-10 h-1.5 bg-slate-300 rounded-full" /></div>
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h2 className="font-black text-slate-800">Status Data</h2>
                <p className="text-xs text-slate-500 mt-0.5">{formatLastSync(lastSyncAt)}</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="w-10 h-10 rounded-full bg-slate-100 text-slate-500" aria-label="Tutup"><i className="fas fa-times" /></button>
            </div>

            <div className="p-5 space-y-4">
              <div className="flex items-center justify-between rounded-2xl border border-slate-200 p-4">
                <div className="flex items-center gap-3">
                  <span className={`w-10 h-10 rounded-xl flex items-center justify-center ${isOnline ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}><i className={isOnline ? 'fas fa-wifi' : 'fas fa-wifi-slash'} /></span>
                  <div><p className="text-sm font-bold text-slate-800">{isOnline ? 'Terhubung ke internet' : 'Perangkat sedang offline'}</p><p className="text-xs text-slate-500">{isOnline ? 'Data dapat dikirim ke server.' : 'Input baru tetap disimpan sebagai draft.'}</p></div>
                </div>
                <StatusBadge tone={tone} icon={icon}>{label}</StatusBadge>
              </div>

              {queue.length > 0 ? (
                <div>
                  <div className="flex justify-between items-center mb-2"><h3 className="text-xs font-black uppercase tracking-wide text-slate-500">Antrean di perangkat</h3><span className="text-xs font-bold text-slate-700">{queue.length} item</span></div>
                  <div className="max-h-48 overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-xl">
                    {queue.slice(0, 8).map(item => (
                      <div key={item.id} className="px-3 py-2.5 flex items-start justify-between gap-3">
                        <div className="min-w-0"><p className="text-xs font-bold text-slate-700 truncate">{item.description || item.table}</p><p className="text-[10px] text-slate-400 capitalize">{item.action} · {item.table}</p></div>
                        <StatusBadge tone={item.syncConflict ? 'danger' : item.requiresManualRetry ? 'warning' : 'info'}>{item.syncConflict ? 'Konflik' : item.requiresManualRetry ? 'Gagal' : 'Menunggu'}</StatusBadge>
                      </div>
                    ))}
                  </div>
                  {queue.length > 8 && <p className="text-[11px] text-slate-400 mt-2">Dan {queue.length - 8} item lainnya.</p>}
                </div>
              ) : (
                <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-4 text-center"><i className="fas fa-check-circle text-emerald-600 text-2xl mb-2" /><p className="text-sm font-bold text-emerald-800">Semua data sudah tersinkron</p><p className="text-xs text-emerald-700 mt-1">Tidak ada draft yang menunggu di perangkat ini.</p></div>
              )}

              {latestError && <div className="rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs text-rose-700" role="alert"><strong>Kesalahan terakhir:</strong> {latestError}</div>}

              {queue.length > 0 && (
                <button type="button" onClick={handleManualSync} disabled={!isOnline || syncing} className="w-full min-h-11 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold transition disabled:opacity-50">
                  <i className={`${syncing ? 'fas fa-spinner fa-spin' : 'fas fa-cloud-upload-alt'} mr-2`} />{syncing ? 'Menyinkronkan...' : 'Sinkronkan Sekarang'}
                </button>
              )}
            </div>
          </section>
        </div>
      ), document.body)}
    </>
  );
}
