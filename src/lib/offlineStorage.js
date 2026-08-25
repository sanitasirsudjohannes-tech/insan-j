import { supabase } from './supabase';
import Swal from 'sweetalert2';

const QUEUE_KEY = 'insan_j_offline_queue';
const SYNCED_IDS_KEY = 'insan_j_offline_synced_ids';
const RECORD_CACHE_KEY = 'insan_j_offline_record_cache';
const SYNC_LOCK_KEY = 'insan_j_offline_sync_lock';
const MAX_SYNCED_IDS_PER_USER = 200;
const MAX_CACHED_ROWS_PER_TABLE = 500;
const SYNC_LOCK_TTL_MS = 45000;
const SYNC_TAB_ID = `sync_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

// Per-tab mutex complemented by Web Locks/localStorage across browser tabs.
// Prevents automatic/manual synchronization from processing the same queue twice.
let syncPromise = null;

const getCurrentQueueOwnerId = () => {
  try {
    const raw = localStorage.getItem('currentUser') || sessionStorage.getItem('currentUser');
    return raw ? JSON.parse(raw)?.id || null : null;
  } catch {
    return null;
  }
};

const readRecordCache = () => {
  try {
    const raw = localStorage.getItem(RECORD_CACHE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (error) {
    console.warn('Gagal membaca cadangan data offline:', error);
    return {};
  }
};

export const getCachedServerRows = (tableName) => {
  const ownerId = getCurrentQueueOwnerId();
  if (!ownerId || !tableName) return [];

  const rows = readRecordCache()[ownerId]?.[tableName];
  return Array.isArray(rows) ? rows : [];
};

export const cacheServerRows = (tableName, rows) => {
  const ownerId = getCurrentQueueOwnerId();
  if (!ownerId || !tableName || !Array.isArray(rows) || rows.length === 0) return;

  try {
    const cache = readRecordCache();
    const ownerCache = cache[ownerId] || {};
    const existingRows = Array.isArray(ownerCache[tableName]) ? ownerCache[tableName] : [];
    const mergedRows = new Map(existingRows.map(row => [String(row.id), row]));

    rows.forEach(row => {
      if (!row?.id || String(row.id).startsWith('off_')) return;
      const { isOffline: _isOffline, offlineId: _offlineId, offlineAction: _offlineAction, ...serverRow } = row;
      mergedRows.set(String(row.id), { ...mergedRows.get(String(row.id)), ...serverRow });
    });

    const sortedRows = Array.from(mergedRows.values()).sort((a, b) => {
      const dateComparison = String(b.tanggal || b.tanggal_pemeriksaan || '')
        .localeCompare(String(a.tanggal || a.tanggal_pemeriksaan || ''));
      return dateComparison || String(b.waktu_input || '').localeCompare(String(a.waktu_input || ''));
    });

    cache[ownerId] = {
      ...ownerCache,
      [tableName]: sortedRows.slice(0, MAX_CACHED_ROWS_PER_TABLE),
    };
    localStorage.setItem(RECORD_CACHE_KEY, JSON.stringify(cache));
  } catch (error) {
    console.warn('Gagal menyimpan cadangan data offline:', error);
  }
};

export const removeCachedServerRow = (tableName, id) => {
  const ownerId = getCurrentQueueOwnerId();
  if (!ownerId || !tableName || id == null) return;

  try {
    const cache = readRecordCache();
    const ownerCache = cache[ownerId];
    if (!ownerCache || !Array.isArray(ownerCache[tableName])) return;

    cache[ownerId] = {
      ...ownerCache,
      [tableName]: ownerCache[tableName].filter(row => String(row.id) !== String(id)),
    };
    localStorage.setItem(RECORD_CACHE_KEY, JSON.stringify(cache));
  } catch (error) {
    console.warn('Gagal memperbarui cadangan data offline:', error);
  }
};

export const getSyncedServerId = (localId) => {
  const ownerId = getCurrentQueueOwnerId();
  if (!ownerId || !localId || !String(localId).startsWith('off_')) return null;

  try {
    const raw = localStorage.getItem(SYNCED_IDS_KEY);
    const savedIds = raw ? JSON.parse(raw) : {};
    return savedIds[ownerId]?.[String(localId)] || null;
  } catch (error) {
    console.warn('Gagal membaca pemetaan ID draft tersinkron:', error);
    return null;
  }
};

const rememberSyncedServerId = (localId, serverId) => {
  const ownerId = getCurrentQueueOwnerId();
  if (!ownerId || !localId || !serverId) return;

  try {
    const raw = localStorage.getItem(SYNCED_IDS_KEY);
    const savedIds = raw ? JSON.parse(raw) : {};
    const ownerEntries = Object.entries(savedIds[ownerId] || {})
      .filter(([existingLocalId]) => existingLocalId !== String(localId))
      .slice(-(MAX_SYNCED_IDS_PER_USER - 1));

    savedIds[ownerId] = Object.fromEntries([
      ...ownerEntries,
      [String(localId), serverId],
    ]);
    localStorage.setItem(SYNCED_IDS_KEY, JSON.stringify(savedIds));
  } catch (error) {
    console.warn('Gagal menyimpan pemetaan ID draft tersinkron:', error);
  }
};

const readStoredQueue = () => {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    console.error('Error reading offline queue:', err);
    return [];
  }
};

// Queue versi lama belum memiliki ownerId. created_by diprioritaskan agar
// draft insert lama tetap kembali ke pembuatnya; sisanya diklaim sekali oleh
// akun yang sedang aktif saat migrasi.
const migrateLegacyQueueOwners = (queue, currentOwnerId) => {
  let changed = false;
  const migrated = queue.map(item => {
    if (item.ownerId) return item;
    const ownerId = item.payload?.created_by || currentOwnerId;
    if (!ownerId) return item;
    changed = true;
    return { ...item, ownerId };
  });

  if (changed) localStorage.setItem(QUEUE_KEY, JSON.stringify(migrated));
  return migrated;
};

const writeCurrentOwnerQueue = (ownerQueue) => {
  const ownerId = getCurrentQueueOwnerId();
  if (!ownerId) return false;

  const allQueue = migrateLegacyQueueOwners(readStoredQueue(), ownerId);
  const otherOwnersQueue = allQueue.filter(item => item.ownerId !== ownerId);
  localStorage.setItem(QUEUE_KEY, JSON.stringify([...otherOwnersQueue, ...ownerQueue]));
  window.dispatchEvent(new CustomEvent('offline-queue-changed', { detail: ownerQueue }));
  return true;
};

export const getOfflineQueue = () => {
  const ownerId = getCurrentQueueOwnerId();
  if (!ownerId) return [];
  return migrateLegacyQueueOwners(readStoredQueue(), ownerId)
    .filter(item => item.ownerId === ownerId);
};

export const getUnsyncedItemsForTable = (tableName) => {
  const items = getOfflineQueue()
    .filter(item => item.table === tableName && item.action !== 'delete')
    .map(item => {
      const payloadData = item.payload && typeof item.payload === 'object' ? item.payload : {};
      const originalId = item.serverId || payloadData.id || item.localId || item.id;
      return {
        ...payloadData,
        id: item.action === 'update' ? originalId : (item.localId || item.id),
        isOffline: true,
        offlineId: item.localId || item.id,
        offlineAction: item.action,
        waktu_input: payloadData.waktu_input || item.createdAt || new Date().toISOString()
      };
    });

  const map = new Map();
  items.forEach(item => {
    map.set(String(item.id), item);
  });
  return Array.from(map.values());
};

export const getOfflineDeletedIds = (tableName) => {
  return getOfflineQueue()
    .filter(item => item.table === tableName && item.action === 'delete')
    .map(item => String(item.serverId || item.payload?.id || item.localId || item.id));
};

export const getOfflineDeletedItems = (tableName) => {
  return getOfflineQueue()
    .filter(item => item.table === tableName && item.action === 'delete')
    .map(item => ({
      ...item.payload,
      id: String(item.serverId || item.payload?.id || item.localId || item.id)
    }));
};

/**
 * saveToOfflineQueue (UPSERT)
 */

export const saveToOfflineQueue = (table, action, payload, description = '') => {
  const ownerId = getCurrentQueueOwnerId();
  if (!ownerId) throw new Error('Pengguna tidak teridentifikasi. Silakan masuk kembali.');
  const queue = getOfflineQueue();
  const payloadCopy = { ...(payload || {}) };

  // id yang sedang "disasar" oleh operasi ini: bisa berupa id draft lokal
  // (off_...) atau id asli dari database (record yang sudah pernah tersinkron
  // lalu diedit lagi secara offline).
  const targetId = payloadCopy.serverId || payloadCopy.id || null;

  if (targetId) {
    const existingIndex = queue.findIndex(item => {
      const refs = [item.id, item.localId, item.serverId, item.payload?.id, item.payload?.serverId]
        .filter(v => v !== null && v !== undefined && v !== '')
        .map(String);
      return item.table === table && refs.includes(String(targetId));
    });

    if (existingIndex !== -1) {
      const existing = queue[existingIndex];
      // Entri lama masih berupa "insert" berarti record ini belum pernah
      // sampai ke server sama sekali (masih draft murni).
      const isLocalDraft = existing.action === 'insert';

      if (action === 'delete') {
        if (isLocalDraft) {
          // Draft belum pernah ada di server -> cukup buang dari antrean,
          // tidak ada yang perlu disinkronkan.
          queue.splice(existingIndex, 1);
        } else {
          // Record sudah ada di server -> ganti operasi update yang tertunda
          // menjadi operasi delete.
          queue[existingIndex] = {
            ...existing,
            action: 'delete',
            payload: { ...existing.payload, id: existing.serverId, serverId: existing.serverId },
            description: description || existing.description,
            createdAt: new Date().toISOString(),
          };
        }
      } else {
        // Amandemen entri yang sudah ada, JANGAN buat entri baru.
        const { id: _omitId, serverId: _omitServerId, ...restPayload } = payloadCopy;
        queue[existingIndex] = {
          ...existing,
          action: isLocalDraft ? 'insert' : 'update',
          payload: isLocalDraft
            ? { ...existing.payload, ...restPayload } // insert payload tetap tanpa field id
            : { ...existing.payload, ...restPayload, id: existing.serverId },
          description: description || existing.description,
          createdAt: new Date().toISOString(),
        };
      }

      writeCurrentOwnerQueue(queue);
      return queue[existingIndex] || null;
    }
  }

  // Belum ada entri untuk record ini -> ini kali pertama record ditulis
  // secara offline, buat entri baru.
  const localId = `off_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const newItem = {
    id: localId,
    localId,
    serverId: targetId && !String(targetId).startsWith('off_') ? targetId : null,
    table,
    action,
    payload: payloadCopy,
    description: description || `${action.toUpperCase()} data ${table}`,
    createdAt: new Date().toISOString(),
    ownerId
  };

  queue.push(newItem);
  writeCurrentOwnerQueue(queue);
  return newItem;
};

export const removeOfflineQueueItem = (id) => {
  const queue = getOfflineQueue().filter(item => item.id !== id && item.localId !== id);
  writeCurrentOwnerQueue(queue);
};

const replaceReferencedLocalId = (localId, serverId) => {
  const queue = getOfflineQueue().map(item => {
    const payloadId = item.payload?.serverId || item.payload?.id;
    const referencesInsertedRecord = payloadId === localId || item.localId === localId;

    if (!referencesInsertedRecord) return item;

    return {
      ...item,
      serverId,
      payload: {
        ...item.payload,
        id: serverId,
        serverId
      }
    };
  });

  writeCurrentOwnerQueue(queue);
};

// Tetap kompatibel dengan format queue lama: update/delete boleh memakai
// item.serverId, payload.serverId, atau payload.id.
const getServerId = (item) => {
  const candidates = [item?.serverId, item?.payload?.serverId, item?.payload?.id];
  return candidates.find(candidate => {
    if (candidate === null || candidate === undefined || candidate === '') return false;
    return !String(candidate).startsWith('off_');
  }) || null;
};

// Jika record belum pernah masuk Supabase (masih memakai ID off_...),
// operasi DELETE cukup menghapus seluruh operasi lokal yang terkait.
// Jangan mencoba DELETE ke Supabase dengan ID lokal.
export const removeLocalRecordQueue = (item) => {
  const localIds = new Set([
    item?.id,
    item?.localId,
    item?.offlineId,
    item?.payload?.id,
    item?.payload?.serverId
  ].filter(Boolean).map(String));

  const queue = getOfflineQueue().filter(candidate => {
    const references = [
      candidate.id,
      candidate.localId,
      candidate.payload?.id,
      candidate.payload?.serverId
    ].filter(Boolean).map(String);

    return !references.some(reference => localIds.has(reference));
  });

  writeCurrentOwnerQueue(queue);
};

const findAlreadyInsertedRow = async (item) => {
  const payload = item.payload || {};
  if (!payload.waktu_input) return null;

  let query = supabase.from(item.table)
    .select('id')
    .eq('waktu_input', payload.waktu_input)
    .limit(1);

  if (payload.tanggal) query = query.eq('tanggal', payload.tanggal);
  if (payload.tanggal_pemeriksaan) query = query.eq('tanggal_pemeriksaan', payload.tanggal_pemeriksaan);
  if (payload.ruangan) query = query.eq('ruangan', payload.ruangan);
  if (payload.created_by) query = query.eq('created_by', payload.created_by);

  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  return data || null;
};

const performOfflineSync = async (showNotification = true) => {
  if (!navigator.onLine) return { success: 0, failed: 0, total: 0 };

  const initialQueue = getOfflineQueue();
  if (initialQueue.length === 0) return { success: 0, failed: 0, total: 0 };

  let successCount = 0;
  let failedCount = 0;
  const total = initialQueue.length;

  // Setiap item dicoba satu kali per putaran. Item yang gagal tetap berada
  // dalam queue, tetapi tidak boleh menghalangi item valid berikutnya.
  for (const initialItem of initialQueue) {
    const item = getOfflineQueue().find(candidate =>
      candidate.id === initialItem.id ||
      (Boolean(initialItem.localId) && candidate.localId === initialItem.localId)
    );
    if (!item) continue;

    try {
      let error = null;

      if (item.action === 'insert') {
        const existingRow = await findAlreadyInsertedRow(item);
        let data = existingRow;

        if (!existingRow) {
          const insertResult = await supabase
            .from(item.table)
            .insert([item.payload])
            .select()
            .single();
          data = insertResult.data;
          error = insertResult.error;
        }

        if (!error && data?.id) {
          rememberSyncedServerId(item.localId || item.id, data.id);
          replaceReferencedLocalId(item.localId || item.id, data.id);
          cacheServerRows(item.table, [{ ...item.payload, ...data }]);
        }
      } else if (item.action === 'update') {
        const serverId = getServerId(item);
        if (!serverId) throw new Error(`Server ID tidak tersedia untuk update item ${item.id}`);

        const { id: _id, serverId: _serverId, ...updateData } = item.payload || {};
        const { data: updatedRow, error: err } = await supabase
          .from(item.table)
          .update(updateData)
          .eq('id', serverId)
          .select('id')
          .maybeSingle();
        error = err;

        if (!error && !updatedRow?.id) {
          throw new Error(`Data untuk update tidak ditemukan atau akses ditolak (ID: ${serverId}). Antrean tetap disimpan.`);
        }
        if (!error) cacheServerRows(item.table, [{ ...updateData, id: serverId }]);
      } else if (item.action === 'delete') {
        const serverId = getServerId(item);

        if (!serverId) {
          const localId = item.payload?.id || item.localId || item.id;
          if (String(localId).startsWith('off_')) {
            removeLocalRecordQueue(item);
            successCount++;
            continue;
          }
          throw new Error(`Server ID tidak tersedia untuk delete item ${item.id}`);
        }

        const { data: deletedRow, error: err } = await supabase
          .from(item.table)
          .delete()
          .eq('id', serverId)
          .select('id')
          .maybeSingle();
        error = err;

        if (!error && !deletedRow?.id) {
          throw new Error(`Data untuk dihapus tidak ditemukan atau akses ditolak (ID: ${serverId}). Antrean tetap disimpan.`);
        }
        if (!error) removeCachedServerRow(item.table, serverId);
      } else {
        throw new Error(`Aksi offline tidak dikenal: ${item.action}`);
      }

      if (error) {
        console.error(`Gagal sync item ${item.id}:`, error);
        failedCount++;
        continue;
      }

      removeOfflineQueueItem(item.id);
      successCount++;
    } catch (err) {
      console.error(`Exception sync item ${item.id}:`, err);
      failedCount++;
      continue;
    }
  }

  if (showNotification && (successCount > 0 || failedCount > 0)) {
    Swal.fire({
      icon: failedCount > 0 ? (successCount > 0 ? 'warning' : 'error') : 'success',
      title: failedCount > 0
        ? (successCount > 0 ? 'Sinkronisasi Sebagian Berhasil' : 'Sinkronisasi Gagal')
        : 'Sinkronisasi Berhasil!',
      text: failedCount > 0
        ? `${successCount} berhasil, ${failedCount} gagal. Data gagal tetap berada di antrean.`
        : `${successCount} data offline telah dikirim ke database.`,
      toast: true,
      position: 'top-end',
      showConfirmButton: false,
      timer: 3500
    });
  }

  return { success: successCount, failed: failedCount, total };
};

/**
 * Runs at most one sync operation per browser tab.
 * If auto-sync and manual sync are triggered at the same time, both callers
 * receive the same Promise and only one queue-processing loop runs.
 */
const runWithFallbackSyncLock = async (ownerId, task) => {
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

export const syncOfflineQueue = (showNotification = true) => {
  if (syncPromise) return syncPromise;

  const ownerId = getCurrentQueueOwnerId();
  const syncTask = () => performOfflineSync(showNotification);
  const runTask = ownerId && navigator.locks?.request
    ? navigator.locks.request(`insan-j-offline-sync-${ownerId}`, syncTask)
    : ownerId ? runWithFallbackSyncLock(ownerId, syncTask) : syncTask();

  syncPromise = Promise.resolve(runTask).finally(() => {
    syncPromise = null;
  });

  return syncPromise;
};

if (typeof window !== 'undefined') {
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
}
