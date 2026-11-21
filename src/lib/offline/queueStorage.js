import { QUEUE_KEY, SYNC_RETRY_DELAYS_MS } from './constants';
import { getCurrentQueueOwnerId } from './recordCache';
import { notifyStorageHealth } from './storageHealth';
import { classifySyncError, getSyncErrorMessage, resetRetryState } from './syncErrors';
import { isRecordConflictError } from '../recordVersion';

const syncState = {
  inProgress: false,
  changedTables: new Set(),
};

export const isOfflineSyncInProgress = () => syncState.inProgress;

export const beginOfflineSyncTracking = () => {
  syncState.inProgress = true;
  syncState.changedTables = new Set();
};

export const finishOfflineSyncTracking = () => {
  syncState.inProgress = false;
  const changedTables = [...syncState.changedTables];
  syncState.changedTables = new Set();
  return changedTables;
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

export const writeCurrentOwnerQueue = (ownerQueue) => {
  const ownerId = getCurrentQueueOwnerId();
  if (!ownerId) return false;

  const allQueue = migrateLegacyQueueOwners(readStoredQueue(), ownerId);
  const previousOwnerQueue = allQueue.filter(item => item.ownerId === ownerId);
  const otherOwnersQueue = allQueue.filter(item => item.ownerId !== ownerId);
  const previousItems = new Map(previousOwnerQueue.map(item => [item.id, item]));
  const nextItems = new Map(ownerQueue.map(item => [item.id, item]));
  const changedTables = new Set();

  previousOwnerQueue.forEach(item => {
    const nextItem = nextItems.get(item.id);
    if (!nextItem || JSON.stringify(nextItem) !== JSON.stringify(item)) {
      changedTables.add(item.table);
    }
  });
  ownerQueue.forEach(item => {
    if (!previousItems.has(item.id)) changedTables.add(item.table);
  });

  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify([...otherOwnersQueue, ...ownerQueue]));
  } catch (error) {
    window.dispatchEvent(new CustomEvent('offline-storage-health', {
      detail: { warning: true, writeFailed: true },
    }));
    throw Object.assign(
      new Error('Penyimpanan perangkat penuh. Hubungkan internet dan sinkronkan draft sebelum menambah data.'),
      { code: 'offline_storage_full', cause: error },
    );
  }
  notifyStorageHealth();
  const queueEvent = new CustomEvent('offline-queue-changed', { detail: ownerQueue });
  queueEvent.changedTables = [...changedTables];
  queueEvent.syncInProgress = syncState.inProgress;
  if (syncState.inProgress) changedTables.forEach(table => syncState.changedTables.add(table));
  window.dispatchEvent(queueEvent);
  return true;
};

export const getOfflineQueue = () => {
  const ownerId = getCurrentQueueOwnerId();
  if (!ownerId) return [];
  return migrateLegacyQueueOwners(readStoredQueue(), ownerId)
    .filter(item => item.ownerId === ownerId);
};

export const queueItemsMatch = (currentItem, snapshotItem) => (
  currentItem?.table === snapshotItem?.table &&
  currentItem?.action === snapshotItem?.action &&
  currentItem?.batchId === snapshotItem?.batchId &&
  String(currentItem?.baseUpdatedAt || '') === String(snapshotItem?.baseUpdatedAt || '') &&
  String(currentItem?.serverId || '') === String(snapshotItem?.serverId || '') &&
  JSON.stringify(currentItem?.payload || {}) === JSON.stringify(snapshotItem?.payload || {})
);

export const markQueueItemsFailed = (snapshotItems, error) => {
  const snapshots = new Map(
    snapshotItems.map(item => [String(item.localId || item.id), item])
  );
  const now = new Date();
  const errorMessage = getSyncErrorMessage(error);
  const hasConflict = isRecordConflictError(error);
  const errorType = classifySyncError(error);

  const queue = getOfflineQueue().map(item => {
    const snapshot = snapshots.get(String(item.localId || item.id));
    // Jika pengguna mengubah draft ketika request lama berjalan, jangan
    // menerapkan status gagal request lama ke perubahan yang lebih baru.
    if (!snapshot || !queueItemsMatch(item, snapshot)) return item;

    const syncAttempts = (Number(item.syncAttempts) || 0) + 1;
    const retryDelay = hasConflict ? null : (SYNC_RETRY_DELAYS_MS[syncAttempts - 1] ?? null);
    return {
      ...item,
      syncAttempts,
      lastSyncError: errorMessage,
      syncErrorType: errorType,
      lastSyncAttemptAt: now.toISOString(),
      nextRetryAt: retryDelay === null
        ? null
        : new Date(now.getTime() + retryDelay).toISOString(),
      requiresManualRetry: retryDelay === null,
      syncConflict: hasConflict,
    };
  });

  writeCurrentOwnerQueue(queue);
};

export const isQueueItemReady = (item, force, now = Date.now()) => {
  // Konflik harus diselesaikan pengguna; tombol retry tidak boleh menimpa
  // perubahan yang sudah disimpan perangkat lain.
  if (item.syncConflict) return false;
  if (force) return true;
  if (item.requiresManualRetry) return false;
  if (!item.nextRetryAt) return true;
  const nextRetryAt = Date.parse(item.nextRetryAt);
  return Number.isNaN(nextRetryAt) || nextRetryAt <= now;
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
        offlineSyncAttempts: Number(item.syncAttempts) || 0,
        offlineSyncError: item.lastSyncError || null,
        offlineNextRetryAt: item.nextRetryAt || null,
        offlineRequiresManualRetry: Boolean(item.requiresManualRetry),
        offlineHasConflict: Boolean(item.syncConflict),
        offlineBaseUpdatedAt: item.baseUpdatedAt || null,
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

export const saveToOfflineQueue = (table, action, payload, description = '', options = {}) => {
  const ownerId = getCurrentQueueOwnerId();
  if (!ownerId) throw new Error('Pengguna tidak teridentifikasi. Silakan masuk kembali.');
  const queue = getOfflineQueue();
  const payloadCopy = { ...(payload || {}) };
  const requestedBaseUpdatedAt = options?.baseUpdatedAt || null;

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
      // Setelah konflik ditinjau secara sadar, versi server terbaru menjadi
      // dasar baru. Edit biasa tetap mempertahankan dasar draft semula.
      const nextBaseUpdatedAt = existing.syncConflict && requestedBaseUpdatedAt
        ? requestedBaseUpdatedAt
        : (existing.baseUpdatedAt || requestedBaseUpdatedAt);
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
          queue[existingIndex] = resetRetryState({
            ...existing,
            action: 'delete',
            payload: { ...existing.payload, id: existing.serverId, serverId: existing.serverId },
            baseUpdatedAt: nextBaseUpdatedAt,
            description: description || existing.description,
            createdAt: new Date().toISOString(),
          });
        }
      } else {
        // Amandemen entri yang sudah ada, JANGAN buat entri baru.
        const { id: _omitId, serverId: _omitServerId, ...restPayload } = payloadCopy;
        queue[existingIndex] = resetRetryState({
          ...existing,
          action: isLocalDraft ? 'insert' : 'update',
          payload: isLocalDraft
            ? { ...existing.payload, ...restPayload } // insert payload tetap tanpa field id
            : { ...existing.payload, ...restPayload, id: existing.serverId },
          baseUpdatedAt: isLocalDraft
            ? null
            : nextBaseUpdatedAt,
          description: description || existing.description,
          createdAt: new Date().toISOString(),
        });
      }

      writeCurrentOwnerQueue(queue);
      return queue[existingIndex] || null;
    }
  }

  // Belum ada entri untuk record ini -> ini kali pertama record ditulis
  // secara offline, buat entri baru.
  const localId = `off_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const newItem = resetRetryState({
    id: localId,
    localId,
    serverId: targetId && !String(targetId).startsWith('off_') ? targetId : null,
    table,
    action,
    payload: payloadCopy,
    baseUpdatedAt: action === 'insert' ? null : requestedBaseUpdatedAt,
    description: description || `${action.toUpperCase()} data ${table}`,
    createdAt: new Date().toISOString(),
    ownerId
  });

  queue.push(newItem);
  writeCurrentOwnerQueue(queue);
  return newItem;
};

export const saveInsertBatchToOfflineQueue = (table, payloads, description = '') => {
  const ownerId = getCurrentQueueOwnerId();
  if (!ownerId) throw new Error('Pengguna tidak teridentifikasi. Silakan masuk kembali.');
  if (!table || !Array.isArray(payloads) || payloads.length === 0) {
    throw new Error('Data distribusi tidak tersedia untuk disimpan.');
  }

  const queue = getOfflineQueue();
  const createdAt = new Date().toISOString();
  const batchId = `batch_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  const items = payloads.map((payload, index) => {
    const localId = `off_${Date.now()}_${index}_${Math.random().toString(36).slice(2, 8)}`;
    return resetRetryState({
      id: localId,
      localId,
      serverId: null,
      batchId,
      table,
      action: 'insert',
      payload: { ...payload },
      baseUpdatedAt: null,
      description: description || `INSERT data ${table}`,
      createdAt,
      ownerId,
    });
  });

  writeCurrentOwnerQueue([...queue, ...items]);
  return items;
};

export const removeOfflineQueueItem = (id) => {
  const queue = getOfflineQueue().filter(item => item.id !== id && item.localId !== id);
  writeCurrentOwnerQueue(queue);
};

export const findQueueItemIndex = (queue, snapshotItem) => queue.findIndex(candidate =>
  candidate.id === snapshotItem.id ||
  (Boolean(snapshotItem.localId) && candidate.localId === snapshotItem.localId)
);

export const removeQueueItemIfUnchanged = (snapshotItem) => {
  const queue = getOfflineQueue();
  const currentIndex = findQueueItemIndex(queue, snapshotItem);
  if (currentIndex === -1 || !queueItemsMatch(queue[currentIndex], snapshotItem)) return false;
  queue.splice(currentIndex, 1);
  writeCurrentOwnerQueue(queue);
  return true;
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
