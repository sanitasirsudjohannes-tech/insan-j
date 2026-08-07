import { supabase } from './supabase';
import Swal from 'sweetalert2';

const QUEUE_KEY = 'insan_j_offline_queue';

/**
 * Mendapatkan antrean data offline dari LocalStorage
 */
export const getOfflineQueue = () => {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    console.error('Error reading offline queue:', err);
    return [];
  }
};

/**
 * Menyimpan data ke antrean offline
 */
export const saveToOfflineQueue = (table, action, payload, description = '') => {
  const queue = getOfflineQueue();
  const newItem = {
    id: `off_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
    table,
    action, // 'insert' | 'update' | 'delete'
    payload,
    description: description || `${action.toUpperCase()} data ${table}`,
    createdAt: new Date().toISOString()
  };

  queue.push(newItem);
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));

  // Dispatch custom event untuk memperbarui UI indikator
  window.dispatchEvent(new CustomEvent('offline-queue-changed', { detail: queue }));

  return newItem;
};

/**
 * Menghapus 1 item dari antrean berdasarkan ID
 */
export const removeOfflineQueueItem = (id) => {
  const queue = getOfflineQueue().filter(item => item.id !== id);
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  window.dispatchEvent(new CustomEvent('offline-queue-changed', { detail: queue }));
};

/**
 * Melakukan sinkronisasi data offline ke Supabase
 */
export const syncOfflineQueue = async (showNotification = true) => {
  if (!navigator.onLine) return { success: 0, failed: 0, total: 0 };

  const queue = getOfflineQueue();
  if (queue.length === 0) return { success: 0, failed: 0, total: 0 };

  let successCount = 0;
  let failedCount = 0;

  for (const item of queue) {
    try {
      let error = null;

      if (item.action === 'insert') {
        const { error: err } = await supabase.from(item.table).insert([item.payload]);
        error = err;
      } else if (item.action === 'update') {
        const { id: payloadId, ...updateData } = item.payload;
        const { error: err } = await supabase.from(item.table).update(updateData).eq('id', payloadId);
        error = err;
      } else if (item.action === 'delete') {
        const { error: err } = await supabase.from(item.table).delete().eq('id', item.payload.id);
        error = err;
      }

      if (error) {
        console.error(`Gagal sync item ${item.id}:`, error);
        failedCount++;
      } else {
        removeOfflineQueueItem(item.id);
        successCount++;
      }
    } catch (err) {
      console.error(`Exception sync item ${item.id}:`, err);
      failedCount++;
    }
  }

  if (showNotification && successCount > 0) {
    Swal.fire({
      icon: 'success',
      title: 'Sinkronisasi Berhasil!',
      text: `${successCount} data offline telah dikirim ke database.`,
      toast: true,
      position: 'top-end',
      showConfirmButton: false,
      timer: 3500
    });
  }

  return { success: successCount, failed: failedCount, total: queue.length };
};

// Pasang event listener otomatis saat jaringan terhubung (online)
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    console.log('Koneksi internet kembali aktif. Menjalankan auto-sync...');
    syncOfflineQueue(true);
  });
}
