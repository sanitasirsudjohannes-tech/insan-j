import { supabase } from './supabase';
import Swal from 'sweetalert2';

const QUEUE_KEY = 'insan_j_offline_queue';

export const getOfflineQueue = () => {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    console.error('Error reading offline queue:', err);
    return [];
  }
};

export const getUnsyncedItemsForTable = (tableName) => {
  return getOfflineQueue()
    .filter(item => item.table === tableName && item.action !== 'delete')
    .map(item => {
      const payloadData = item.payload && typeof item.payload === 'object' ? item.payload : {};
      return {
        ...payloadData,
        id: item.localId || item.id,
        isOffline: true,
        offlineId: item.localId || item.id,
        offlineAction: item.action,
        waktu_input: payloadData.waktu_input || item.createdAt || new Date().toISOString()
      };
    });
};

export const saveToOfflineQueue = (table, action, payload, description = '') => {
  const queue = getOfflineQueue();
  const localId = `off_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const payloadCopy = { ...(payload || {}) };
  const referencedId = payloadCopy.serverId || payloadCopy.id || null;

  const newItem = {
    id: localId,
    localId,
    serverId: referencedId && !String(referencedId).startsWith('off_') ? referencedId : null,
    table,
    action,
    payload: payloadCopy,
    description: description || `${action.toUpperCase()} data ${table}`,
    createdAt: new Date().toISOString()
  };

  queue.push(newItem);
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  window.dispatchEvent(new CustomEvent('offline-queue-changed', { detail: queue }));
  return newItem;
};

export const removeOfflineQueueItem = (id) => {
  const queue = getOfflineQueue().filter(item => item.id !== id && item.localId !== id);
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  window.dispatchEvent(new CustomEvent('offline-queue-changed', { detail: queue }));
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

  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  window.dispatchEvent(new CustomEvent('offline-queue-changed', { detail: queue }));
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
const removeLocalRecordQueue = (item) => {
  const localIds = new Set([
    item?.id,
    item?.localId,
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

  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  window.dispatchEvent(new CustomEvent('offline-queue-changed', { detail: queue }));
};

export const syncOfflineQueue = async (showNotification = true) => {
  if (!navigator.onLine) return { success: 0, failed: 0, total: 0 };

  const initialQueue = getOfflineQueue();
  if (initialQueue.length === 0) return { success: 0, failed: 0, total: 0 };

  let successCount = 0;
  let failedCount = 0;
  const total = initialQueue.length;

  // Selalu membaca queue terbaru agar serverId hasil INSERT langsung
  // tersedia untuk UPDATE/DELETE berikutnya.
  while (true) {
    const queue = getOfflineQueue();
    if (queue.length === 0) break;

    const item = queue[0];

    try {
      let error = null;

      if (item.action === 'insert') {
        const { data, error: err } = await supabase
          .from(item.table)
          .insert([item.payload])
          .select()
          .single();
        error = err;

        if (!error && data?.id) {
          replaceReferencedLocalId(item.localId || item.id, data.id);
        }
      } else if (item.action === 'update') {
        const serverId = getServerId(item);
        if (!serverId) throw new Error(`Server ID tidak tersedia untuk update item ${item.id}`);

        const { id: _id, serverId: _serverId, ...updateData } = item.payload || {};
        const { error: err } = await supabase
          .from(item.table)
          .update(updateData)
          .eq('id', serverId);
        error = err;
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

        const { error: err } = await supabase
          .from(item.table)
          .delete()
          .eq('id', serverId);
        error = err;
      } else {
        throw new Error(`Aksi offline tidak dikenal: ${item.action}`);
      }

      if (error) {
        console.error(`Gagal sync item ${item.id}:`, error);
        failedCount++;
        break;
      }

      removeOfflineQueueItem(item.id);
      successCount++;
    } catch (err) {
      console.error(`Exception sync item ${item.id}:`, err);
      failedCount++;
      break;
    }
  }

  if (showNotification && successCount > 0) {
    Swal.fire({
      icon: failedCount > 0 ? 'warning' : 'success',
      title: failedCount > 0 ? 'Sinkronisasi Sebagian Berhasil' : 'Sinkronisasi Berhasil!',
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

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    console.log('Koneksi internet kembali aktif. Menjalankan auto-sync...');
    syncOfflineQueue(true);
  });
}
