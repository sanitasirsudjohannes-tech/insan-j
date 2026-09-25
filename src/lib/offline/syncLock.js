import { SYNC_LOCK_KEY, SYNC_LOCK_TTL_MS } from './constants';
import { getOfflineQueue } from './queueStorage';

const SYNC_TAB_ID = `sync_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

/** Coordinates synchronization across browser tabs. */
export const runWithFallbackSyncLock = async (ownerId, task) => {
  const now = Date.now();
  let currentLock = null;

  try {
    const rawLock = localStorage.getItem(SYNC_LOCK_KEY);
    currentLock = rawLock ? JSON.parse(rawLock) : null;
    if (currentLock?.ownerId === ownerId && currentLock.tabId !== SYNC_TAB_ID && currentLock.expiresAt > now) {
      return { success: 0, failed: 0, total: getOfflineQueue().length, locked: true };
    }

    const lock = { ownerId, tabId: SYNC_TAB_ID, expiresAt: now + SYNC_LOCK_TTL_MS };
    localStorage.setItem(SYNC_LOCK_KEY, JSON.stringify(lock));
    const confirmedLock = JSON.parse(localStorage.getItem(SYNC_LOCK_KEY) || '{}');
    if (confirmedLock.tabId !== SYNC_TAB_ID) {
      return { success: 0, failed: 0, total: getOfflineQueue().length, locked: true };
    }
  } catch (error) {
    console.warn('Kunci sinkronisasi lintas tab tidak tersedia:', error);
    return task();
  }

  const heartbeat = window.setInterval(() => {
    try {
      const existingLock = JSON.parse(localStorage.getItem(SYNC_LOCK_KEY) || '{}');
      if (existingLock.tabId === SYNC_TAB_ID) {
        localStorage.setItem(SYNC_LOCK_KEY, JSON.stringify({
          ...existingLock,
          expiresAt: Date.now() + SYNC_LOCK_TTL_MS,
        }));
      }
    } catch (error) {
      console.warn('Gagal memperpanjang kunci sinkronisasi offline:', error);
    }
  }, Math.floor(SYNC_LOCK_TTL_MS / 3));

  try {
    return await task();
  } finally {
    window.clearInterval(heartbeat);
    try {
      const existingLock = JSON.parse(localStorage.getItem(SYNC_LOCK_KEY) || '{}');
      if (existingLock.tabId === SYNC_TAB_ID) localStorage.removeItem(SYNC_LOCK_KEY);
    } catch (error) {
      console.warn('Gagal membersihkan kunci sinkronisasi offline:', error);
    }
  }
};
