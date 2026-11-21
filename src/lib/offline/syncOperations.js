import Swal from 'sweetalert2';
import { supabase } from '../supabase';
import { deleteRecordWithVersion, updateRecordWithVersion } from '../recordVersion';
import { classifySyncError, resetRetryState } from './syncErrors';
import {
  cacheServerRows,
  getCurrentQueueOwnerId,
  getSyncedServerId,
  rememberSyncedServerId,
  removeCachedServerRow,
} from './recordCache';
import {
  beginOfflineSyncTracking,
  findQueueItemIndex,
  finishOfflineSyncTracking,
  getOfflineQueue,
  isQueueItemReady,
  markQueueItemsFailed,
  queueItemsMatch,
  removeLocalRecordQueue,
  removeQueueItemIfUnchanged,
  writeCurrentOwnerQueue,
} from './queueStorage';
import { runWithFallbackSyncLock } from './syncLock';

let syncPromise = null;

const getVerifiedSyncSession = async (ownerId) => {
  try {
    let { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    if (!data?.session?.user && navigator.onLine) {
      ({ data, error } = await supabase.auth.refreshSession());
      if (error) throw error;
    }
    const sessionUserId = data?.session?.user?.id || null;
    if (!sessionUserId || sessionUserId !== ownerId) {
      return { ready: false, reason: 'session' };
    }
    return { ready: true, userId: sessionUserId };
  } catch (error) {
    return { ready: false, reason: classifySyncError(error), error };
  }
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

export const performOfflineSync = async (showNotification = true, force = false) => {
  if (!navigator.onLine) return { success: 0, failed: 0, total: 0 };

  const allQueue = getOfflineQueue();
  const ownerId = getCurrentQueueOwnerId();
  const sessionState = await getVerifiedSyncSession(ownerId);
  if (!sessionState.ready) {
    return {
      success: 0, failed: 0, total: allQueue.length, skipped: allQueue.length,
      deferred: true, reason: sessionState.reason || 'session',
    };
  }
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
        const errorType = classifySyncError(batchError);
        if (errorType === 'network' || errorType === 'session') {
          return {
            success: successCount, failed: failedCount, total,
            skipped: Math.max(0, total - successCount - failedCount),
            deferred: true, reason: errorType,
          };
        }
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
        const errorType = classifySyncError(error);
        if (errorType === 'network' || errorType === 'session') {
          return {
            success: successCount, failed: failedCount, total,
            skipped: Math.max(0, total - successCount - failedCount),
            deferred: true, reason: errorType,
          };
        }
        markQueueItemsFailed([item], error);
        failedCount++;
        continue;
      }

      if (!queueHandled) removeQueueItemIfUnchanged(item);
      successCount++;
    } catch (err) {
      console.error(`Exception sync item ${item.id}:`, err);
      const errorType = classifySyncError(err);
      if (errorType === 'network' || errorType === 'session') {
        return {
          success: successCount, failed: failedCount, total,
          skipped: Math.max(0, total - successCount - failedCount),
          deferred: true, reason: errorType,
        };
      }
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

export const syncOfflineQueue = (showNotification = true, force = false) => {
  if (syncPromise) return syncPromise;

  const ownerId = getCurrentQueueOwnerId();
  const syncTask = async () => {
    beginOfflineSyncTracking();
    window.dispatchEvent(new CustomEvent('offline-sync-start'));

    let result = null;
    try {
      result = await performOfflineSync(showNotification, force);
      return result;
    } finally {
      const changedTables = finishOfflineSyncTracking();

      if (changedTables.length > 0) {
        window.dispatchEvent(new CustomEvent('offline-sync-complete', {
          detail: { changedTables },
        }));
      }

      // Selalu dikirim, termasuk ketika antrean kosong/gagal, agar halaman
      // cukup memuat ulang satu kali setelah proses reconnect benar-benar
      // selesai. changedTables mempertahankan penyaringan per halaman.
      window.dispatchEvent(new CustomEvent('offline-sync-finished', {
        detail: {
          changedTables,
          result,
          verified: Boolean(result && !result.deferred && result.failed === 0),
          remaining: getOfflineQueue().length,
        },
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
