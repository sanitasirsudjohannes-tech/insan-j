import { supabase } from './supabase';
import Swal from 'sweetalert2';
import {
  deleteRecordWithVersion,
  isRecordConflictError,
  updateRecordWithVersion,
} from './recordVersion';

const QUEUE_KEY = 'insan_j_offline_queue';
const SYNCED_IDS_KEY = 'insan_j_offline_synced_ids';
const RECORD_CACHE_KEY = 'insan_j_offline_record_cache';
const SYNC_LOCK_KEY = 'insan_j_offline_sync_lock';
const MAX_SYNCED_IDS_PER_USER = 200;
const MAX_CACHED_ROWS_PER_TABLE = 500;
const SYNC_LOCK_TTL_MS = 45000;
const SYNC_RETRY_DELAYS_MS = [60_000, 5 * 60_000, 15 * 60_000];
const SYNC_TAB_ID = `sync_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

// Per-tab mutex complemented by Web Locks/localStorage across browser tabs.
// Prevents automatic/manual synchronization from processing the same queue twice.
let syncPromise = null;
let syncInProgress = false;
let syncChangedTables = new Set();

export const isOfflineSyncInProgress = () => syncInProgress;

const resetRetryState = (item) => ({
  ...item,
  syncAttempts: 0,
  lastSyncError: null,
  lastSyncAttemptAt: null,
  nextRetryAt: null,
  requiresManualRetry: false,
  syncConflict: false,
});

const getSyncErrorMessage = (error) => {
  if (typeof error?.message === 'string' && error.message.trim()) return error.message.trim();
  if (typeof error === 'string' && error.trim()) return error.trim();
  return 'Sinkronisasi gagal karena kesalahan yang tidak diketahui.';
};

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

  localStorage.setItem(QUEUE_KEY, JSON.stringify([...otherOwnersQueue, ...ownerQueue]));
  const queueEvent = new CustomEvent('offline-queue-changed', { detail: ownerQueue });
  queueEvent.changedTables = [...changedTables];
  queueEvent.syncInProgress = syncInProgress;
  if (syncInProgress) changedTables.forEach(table => syncChangedTables.add(table));
  window.dispatchEvent(queueEvent);
  return true;
};

export const getOfflineQueue = () => {
  const ownerId = getCurrentQueueOwnerId();
  if (!ownerId) return [];
  return migrateLegacyQueueOwners(readStoredQueue(), ownerId)
    .filter(item => item.ownerId === ownerId);
};

const queueItemsMatch = (currentItem, snapshotItem) => (
  currentItem?.table === snapshotItem?.table &&
  currentItem?.action === snapshotItem?.action &&
  currentItem?.batchId === snapshotItem?.batchId &&
  String(currentItem?.baseUpdatedAt || '') === String(snapshotItem?.baseUpdatedAt || '') &&
  String(currentItem?.serverId || '') === String(snapshotItem?.serverId || '') &&
  JSON.stringify(currentItem?.payload || {}) === JSON.stringify(snapshotItem?.payload || {})
);

const markQueueItemsFailed = (snapshotItems, error) => {
  const snapshots = new Map(
    snapshotItems.map(item => [String(item.localId || item.id), item])
  );
  const now = new Date();
  const errorMessage = getSyncErrorMessage(error);
  const hasConflict = isRecordConflictError(error);

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

const isQueueItemReady = (item, force, now = Date.now()) => {
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

const findQueueItemIndex = (queue, snapshotItem) => queue.findIndex(candidate =>
  candidate.id === snapshotItem.id ||
  (Boolean(snapshotItem.localId) && candidate.localId === snapshotItem.localId)
);

const removeQueueItemIfUnchanged = (snapshotItem) => {
  const queue = getOfflineQueue();
  const currentIndex = findQueueItemIndex(queue, snapshotItem);
  if (currentIndex === -1 || !queueItemsMatch(queue[currentIndex], snapshotItem)) return false;
  queue.splice(currentIndex, 1);
  writeCurrentOwnerQueue(queue);
  return true;
};

// INSERT dapat selesai saat pengguna sedang mengedit atau menghapus draft.
// Pertahankan perubahan terbaru sebagai UPDATE/DELETE memakai ID server,
// alih-alih membuang perubahan tersebut bersama operasi INSERT yang lama.
const finalizeSyncedInsert = (snapshotItem, serverRow) => {
  const localId = snapshotItem.localId || snapshotItem.id;
  const previouslySyncedServerId = getSyncedServerId(localId);
  rememberSyncedServerId(localId, serverRow.id);
  cacheServerRows(snapshotItem.table, [{ ...snapshotItem.payload, ...serverRow }]);

  const queue = getOfflineQueue();
  const currentIndex = findQueueItemIndex(queue, snapshotItem);

  if (currentIndex === -1) {
    // Antrean yang sama mungkin baru saja diselesaikan tab lain. Dalam kondisi
    // itu data server sah dan tidak boleh diterjemahkan sebagai permintaan hapus.
    if (String(previouslySyncedServerId || '') === String(serverRow.id)) return;
    queue.push(resetRetryState({
      ...snapshotItem,
      action: 'delete',
      serverId: serverRow.id,
      payload: { id: serverRow.id, serverId: serverRow.id },
      baseUpdatedAt: serverRow.waktu_input || snapshotItem.payload?.waktu_input || null,
      description: `Hapus data ${snapshotItem.table}`,
      createdAt: new Date().toISOString(),
    }));
    writeCurrentOwnerQueue(queue);
    return;
  }

  const currentItem = queue[currentIndex];
  if (queueItemsMatch(currentItem, snapshotItem)) {
    queue.splice(currentIndex, 1);
    writeCurrentOwnerQueue(queue);
    return;
  }

  const { id: _id, serverId: _serverId, ...latestPayload } = currentItem.payload || {};
  queue[currentIndex] = resetRetryState({
    ...currentItem,
    action: currentItem.action === 'delete' ? 'delete' : 'update',
    serverId: serverRow.id,
    baseUpdatedAt: serverRow.waktu_input || snapshotItem.payload?.waktu_input || null,
    payload: currentItem.action === 'delete'
      ? { id: serverRow.id, serverId: serverRow.id }
      : { ...latestPayload, id: serverRow.id },
    createdAt: new Date().toISOString(),
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

const getBatchInsertSignature = (row) => {
  const timestamp = Date.parse(row?.waktu_input || '');
  const normalizedTimestamp = Number.isNaN(timestamp)
    ? String(row?.waktu_input || '')
    : String(timestamp);

  return [
    normalizedTimestamp,
    row?.tanggal || '',
    row?.ruangan || '',
    row?.created_by || '',
  ].map(String).join('\u001f');
};

const syncOfflineInsertBatch = async (items) => {
  const table = items[0]?.table;
  if (table !== 'limbah_ruangan') {
    throw new Error(`Sinkronisasi batch belum tersedia untuk tabel ${table || 'tidak dikenal'}.`);
  }

  const timestamps = [...new Set(items.map(item => item.payload?.waktu_input).filter(Boolean))];
  if (timestamps.length === 0) throw new Error('Penanda waktu distribusi tidak tersedia.');

  let existingQuery = supabase
    .from(table)
    .select('id,waktu_input,tanggal,ruangan,created_by')
    .in('waktu_input', timestamps);

  const ownerIds = [...new Set(items.map(item => item.payload?.created_by).filter(Boolean))];
  if (ownerIds.length === 1) existingQuery = existingQuery.eq('created_by', ownerIds[0]);

  const rooms = [...new Set(items.map(item => item.payload?.ruangan).filter(Boolean))];
  if (rooms.length === 1) existingQuery = existingQuery.eq('ruangan', rooms[0]);

  const { data: existingRows, error: existingError } = await existingQuery;
  if (existingError) throw existingError;

  const rowsBySignature = new Map(
    (existingRows || []).map(row => [getBatchInsertSignature(row), row])
  );
  const missingItems = items.filter(item => !rowsBySignature.has(getBatchInsertSignature(item.payload)));

  if (missingItems.length > 0) {
    const { data: insertedRows, error: insertError } = await supabase
      .from(table)
      .insert(missingItems.map(item => item.payload))
      .select('id,waktu_input,tanggal,ruangan,created_by');

    if (insertError) throw insertError;
    (insertedRows || []).forEach(row => {
      rowsBySignature.set(getBatchInsertSignature(row), row);
    });
  }

  const syncedItems = items.map(item => {
    const row = rowsBySignature.get(getBatchInsertSignature(item.payload));
    if (!row?.id) throw new Error(`Data distribusi ${item.payload?.tanggal || ''} belum terkonfirmasi.`);
    return { item, row };
  });

  const syncedByLocalId = new Map(syncedItems.map(entry => [entry.item.localId || entry.item.id, entry]));
  const seenLocalIds = new Set();
  const queue = getOfflineQueue();
  const updatedQueue = [];

  syncedItems.forEach(({ item, row }) => {
    rememberSyncedServerId(item.localId || item.id, row.id);
  });
  cacheServerRows(table, syncedItems.map(({ item, row }) => ({ ...item.payload, ...row })));

  queue.forEach(queuedItem => {
    const match = syncedByLocalId.get(queuedItem.localId || queuedItem.id);
    if (!match) {
      updatedQueue.push(queuedItem);
      return;
    }

    seenLocalIds.add(match.item.localId || match.item.id);

    // Pengguna boleh mengedit draft ketika pengiriman batch sedang berjalan.
    // Simpan edit terbaru sebagai UPDATE agar hasil INSERT lama tidak menimpanya.
    if (JSON.stringify(queuedItem.payload) !== JSON.stringify(match.item.payload)) {
      const { batchId: _batchId, ...pendingItem } = queuedItem;
      updatedQueue.push(resetRetryState({
        ...pendingItem,
        action: 'update',
        serverId: match.row.id,
        payload: { ...queuedItem.payload, id: match.row.id },
        baseUpdatedAt: match.row.waktu_input || match.item.payload?.waktu_input || null,
      }));
    }
  });

  syncedItems.forEach(({ item, row }) => {
    const localId = item.localId || item.id;
    if (seenLocalIds.has(localId)) return;

    // Draft dapat dihapus ketika INSERT masih diproses server. Teruskan
    // penghapusan tersebut setelah ID server berhasil diketahui.
    updatedQueue.push(resetRetryState({
      ...item,
      action: 'delete',
      serverId: row.id,
      payload: { id: row.id, serverId: row.id },
      baseUpdatedAt: row.waktu_input || item.payload?.waktu_input || null,
      description: `Hapus Limbah Ruangan ${item.payload?.ruangan || ''}`,
    }));
  });

  writeCurrentOwnerQueue(updatedQueue);
  return syncedItems.length;
};

const performOfflineSync = async (showNotification = true, force = false) => {
  if (!navigator.onLine) return { success: 0, failed: 0, total: 0 };

  const allQueue = getOfflineQueue();
  const initialQueue = allQueue.filter(item => isQueueItemReady(item, force));
  if (allQueue.length === 0) return { success: 0, failed: 0, total: 0, skipped: 0 };
  if (initialQueue.length === 0) {
    return { success: 0, failed: 0, total: allQueue.length, skipped: allQueue.length };
  }

  let successCount = 0;
  let failedCount = 0;
  const total = allQueue.length;
  const processedBatchIds = new Set();

  // Setiap item dicoba satu kali per putaran. Item yang gagal tetap berada
  // dalam queue, tetapi tidak boleh menghalangi item valid berikutnya.
  for (const initialItem of initialQueue) {
    const item = getOfflineQueue().find(candidate =>
      candidate.id === initialItem.id ||
      (Boolean(initialItem.localId) && candidate.localId === initialItem.localId)
    );
    if (!item) continue;

    if (item.action === 'insert' && item.batchId) {
      if (processedBatchIds.has(item.batchId)) continue;
      processedBatchIds.add(item.batchId);

      const batchItems = getOfflineQueue().filter(candidate =>
        candidate.action === 'insert' &&
        candidate.table === item.table &&
        candidate.batchId === item.batchId
      );

      try {
        successCount += await syncOfflineInsertBatch(batchItems);
      } catch (batchError) {
        console.error(`Gagal sinkronisasi batch ${item.batchId}:`, batchError);
        markQueueItemsFailed(batchItems, batchError);
        failedCount += batchItems.length;
      }
      continue;
    }

    try {
      let error = null;
      let queueHandled = false;

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

        if (!error && !data?.id) {
          throw new Error(`Server tidak mengembalikan ID untuk insert item ${item.id}.`);
        }
        if (!error && data?.id) {
          finalizeSyncedInsert(item, data);
          queueHandled = true;
        }
      } else if (item.action === 'update') {
        const serverId = getServerId(item);
        if (!serverId) throw new Error(`Server ID tidak tersedia untuk update item ${item.id}`);

        const { id: _id, serverId: _serverId, ...updateData } = item.payload || {};
        await updateRecordWithVersion(item.table, serverId, updateData, item.baseUpdatedAt);
        cacheServerRows(item.table, [{ ...updateData, id: serverId }]);
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

        await deleteRecordWithVersion(
          item.table,
          serverId,
          item.baseUpdatedAt,
          { allowMissing: true }
        );
        removeCachedServerRow(item.table, serverId);
      } else {
        throw new Error(`Aksi offline tidak dikenal: ${item.action}`);
      }

      if (error) {
        console.error(`Gagal sync item ${item.id}:`, error);
        markQueueItemsFailed([item], error);
        failedCount++;
        continue;
      }

      if (!queueHandled) removeQueueItemIfUnchanged(item);
      successCount++;
    } catch (err) {
      console.error(`Exception sync item ${item.id}:`, err);
      markQueueItemsFailed([item], err);
      failedCount++;
      continue;
    }
  }

  if (showNotification && (successCount > 0 || failedCount > 0)) {
    const remainingQueue = getOfflineQueue();
    const manualRetryCount = remainingQueue.filter(item => item.requiresManualRetry).length;
    const conflictCount = remainingQueue.filter(item => item.syncConflict).length;
    Swal.fire({
      icon: failedCount > 0 ? (successCount > 0 ? 'warning' : 'error') : 'success',
      title: failedCount > 0
        ? (successCount > 0 ? 'Sinkronisasi Sebagian Berhasil' : 'Sinkronisasi Gagal')
        : 'Sinkronisasi Berhasil!',
      text: failedCount > 0
        ? conflictCount > 0
          ? `${successCount} berhasil, ${failedCount} gagal. ${conflictCount} draft bertentangan dengan perubahan dari perangkat lain.`
          : manualRetryCount > 0
          ? `${successCount} berhasil, ${failedCount} gagal. ${manualRetryCount} draft menunggu tombol Coba Lagi.`
          : `${successCount} berhasil, ${failedCount} gagal. Data gagal tetap aman dan akan dicoba ulang bertahap.`
        : `${successCount} data offline telah dikirim ke database.`,
      toast: true,
      position: 'top-end',
      showConfirmButton: false,
      timer: 3500
    });
  }

  return {
    success: successCount,
    failed: failedCount,
    total,
    skipped: Math.max(0, total - initialQueue.length),
  };
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

export const syncOfflineQueue = (showNotification = true, force = false) => {
  if (syncPromise) return syncPromise;

  const ownerId = getCurrentQueueOwnerId();
  const syncTask = async () => {
    syncInProgress = true;
    syncChangedTables = new Set();
    window.dispatchEvent(new CustomEvent('offline-sync-start'));

    try {
      return await performOfflineSync(showNotification, force);
    } finally {
      syncInProgress = false;
      const changedTables = [...syncChangedTables];
      syncChangedTables = new Set();

      if (changedTables.length > 0) {
        window.dispatchEvent(new CustomEvent('offline-sync-complete', {
          detail: { changedTables },
        }));
      }

      // Selalu dikirim, termasuk ketika antrean kosong/gagal, agar halaman
      // cukup memuat ulang satu kali setelah proses reconnect benar-benar
      // selesai. changedTables mempertahankan penyaringan per halaman.
      window.dispatchEvent(new CustomEvent('offline-sync-finished', {
        detail: { changedTables },
      }));
    }
  };
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
