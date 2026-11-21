import { QUEUE_KEY } from './constants';
import { notifyStorageHealth } from './storageHealth';
import { getOfflineQueue } from './queueStorage';
import { syncOfflineQueue } from './syncOperations';

let registered = false;

export const registerOfflineSyncEvents = () => {
  if (registered || typeof window === 'undefined') return;
  registered = true;
  
    window.addEventListener('storage', event => {
      if (event.key === QUEUE_KEY) {
        window.dispatchEvent(new CustomEvent('offline-queue-changed', { detail: getOfflineQueue() }));
      }
    });
  
    window.addEventListener('online', () => {
      console.log('Koneksi internet kembali aktif. Menjalankan auto-sync...');
      syncOfflineQueue(true).catch((err) => {
        console.error('Auto-sync offline queue gagal:', err);
      });
    });
  
    window.addEventListener('insan-j-session-ready', () => {
      if (navigator.onLine && getOfflineQueue().length > 0) {
        syncOfflineQueue(false).catch(err => console.error('Sinkronisasi setelah pemulihan sesi gagal:', err));
      }
    });
  
    window.addEventListener('offline-storage-health-request', notifyStorageHealth);
  
};
