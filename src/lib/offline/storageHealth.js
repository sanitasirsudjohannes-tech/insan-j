import { LOCAL_STORAGE_WARNING_BYTES, QUEUE_KEY, RECORD_CACHE_KEY, SYNCED_IDS_KEY } from './constants';

const getTrackedLocalStorageBytes = () => {
  const keys = [QUEUE_KEY, SYNCED_IDS_KEY, RECORD_CACHE_KEY, 'insan_j_dashboard_cache_v1'];
  return keys.reduce((total, key) => {
    const value = localStorage.getItem(key) || '';
    return total + new Blob([key, value]).size;
  }, 0);
};

export const getOfflineStorageHealth = async () => {
  const trackedBytes = getTrackedLocalStorageBytes();
  let usage = null;
  let quota = null;
  try {
    const estimate = await navigator.storage?.estimate?.();
    usage = Number.isFinite(estimate?.usage) ? estimate.usage : null;
    quota = Number.isFinite(estimate?.quota) ? estimate.quota : null;
  } catch {
    // Estimasi storage tidak tersedia pada semua browser.
  }
  const nearLocalLimit = trackedBytes >= LOCAL_STORAGE_WARNING_BYTES;
  const nearOriginQuota = usage !== null && quota > 0 && usage / quota >= 0.8;
  return { trackedBytes, usage, quota, warning: nearLocalLimit || nearOriginQuota };
};

export const notifyStorageHealth = () => {
  getOfflineStorageHealth().then(health => {
    window.dispatchEvent(new CustomEvent('offline-storage-health', { detail: health }));
  }).catch(() => {});
};
