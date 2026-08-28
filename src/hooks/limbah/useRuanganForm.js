import { ITEMS_PER_PAGE } from '../../lib/limbah/constants';
import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import Swal from 'sweetalert2';
import withReactContent from 'sweetalert2-react-content';
import { saveToOfflineQueue, saveInsertBatchToOfflineQueue, getOfflineQueue, removeLocalRecordQueue, getSyncedServerId, syncOfflineQueue, cacheServerRows, removeCachedServerRow } from '../../lib/offlineStorage';
import { getLocalDateString } from '../../lib/localDate';
import { isNetworkError } from '../../lib/networkErrors';
import { notifyDatabaseTablesChanged } from '../../lib/databaseAggregations';
import { deleteRecordWithVersion, getRecordBaseVersion, isRecordConflictError, resolveOfflineRecordConflict, updateRecordWithVersion } from '../../lib/recordVersion';
import { distributeValue } from '../../lib/limbah/ruanganDistribution';
import { compareWasteRows } from '../../lib/limbah/rowOrder';

const MySwal = withReactContent(Swal);

export const EMPTY_FORM = {
  id: null,
  tanggal: getLocalDateString(),
  ruangan: '',
  infeksius: '',
  jarum_suntik: '',
  botol_obat: '',
  sitotoksik: '',
  keterangan: '',
  isDistribusi: false,
  distribusiDates: []
};

export default function useRuanganForm({
  user,
  fetchData,
  page,
  filterDate,
  filterMonth,
  filterRuangan,
  setData,
  setTotalData,
  setOfflineQueueCount
}) {
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [showRuanganSheet, setShowRuanganSheet] = useState(false);
  const handleInputChange = e => setFormData(prev => ({
    ...prev,
    [e.target.name]: e.target.value
  }));
  const handleSubmit = async e => {
    e.preventDefault();
    if (!formData.ruangan) {
      MySwal.fire('Peringatan', 'Silakan pilih ruangan terlebih dahulu!', 'warning');
      return;
    }
    if (formData.isDistribusi && (!formData.distribusiDates || formData.distribusiDates.length === 0)) {
      MySwal.fire('Peringatan', 'Silakan tambah minimal 1 tanggal distribusi!', 'warning');
      return;
    }
    if (formData.isDistribusi && !formData.id) {
      const extraDates = (formData.distribusiDates || []).filter(Boolean);
      if (extraDates.some(date => date === formData.tanggal)) {
        MySwal.fire('Peringatan', 'Tanggal distribusi tidak boleh sama dengan tanggal utama.', 'warning');
        return;
      }
      if (new Set(extraDates).size !== extraDates.length) {
        MySwal.fire('Peringatan', 'Tanggal distribusi tidak boleh dipilih lebih dari satu kali.', 'warning');
        return;
      }
    }
    setSubmitting(true);

    // Hitung tanggal dan pembagian jika distribusi aktif
    let datesToSave = [formData.tanggal];
    if (formData.isDistribusi && !formData.id) {
      const extra = (formData.distribusiDates || []).filter(d => d && d !== formData.tanggal);
      datesToSave = [formData.tanggal, ...new Set(extra)];
    }
    const totalHari = datesToSave.length;
    const arrInf = distributeValue(formData.infeksius, totalHari);
    const arrJar = distributeValue(formData.jarum_suntik, totalHari);
    const arrBot = distributeValue(formData.botol_obat, totalHari);
    const arrSit = distributeValue(formData.sitotoksik, totalHari);
    const payloads = datesToSave.map((tgl, idx) => ({
      tanggal: tgl,
      ruangan: formData.ruangan,
      petugas: user?.nama || 'Petugas',
      infeksius: arrInf[idx],
      jarum_suntik: arrJar[idx],
      botol_obat: arrBot[idx],
      sitotoksik: arrSit[idx],
      keterangan: formData.keterangan || '',
      waktu_input: new Date().toISOString()
    }));
    const insertPayloads = payloads.map(payload => ({
      ...payload,
      created_by: user?.id
    }));
    let recordId = formData.id;
    let baseUpdatedAt = formData.baseUpdatedAt || null;
    let isLocalDraft = Boolean(recordId) && String(recordId).startsWith('off_');
    try {
      if (!formData.id && formData.isDistribusi) {
        const queuedItems = saveInsertBatchToOfflineQueue('limbah_ruangan', insertPayloads, `Distribusi Limbah Ruangan ${formData.ruangan}`);
        const visibleRows = queuedItems.map(item => ({
          ...item.payload,
          id: item.localId,
          isOffline: true,
          offlineId: item.localId,
          offlineAction: 'insert'
        })).filter(item => {
          if (filterDate && item.tanggal !== filterDate) return false;
          if (!filterDate && filterMonth && !item.tanggal?.startsWith(filterMonth)) return false;
          return !filterRuangan || item.ruangan === filterRuangan;
        });
        if (page === 1 && visibleRows.length > 0) {
          setData(current => [...visibleRows, ...current].sort(compareWasteRows).slice(0, ITEMS_PER_PAGE));
        }
        setTotalData(current => current + visibleRows.length);
        setOfflineQueueCount(current => current + queuedItems.length);
        setFormData({
          ...EMPTY_FORM,
          tanggal: formData.tanggal,
          isDistribusi: formData.isDistribusi,
          distribusiDates: formData.distribusiDates
        });
        MySwal.fire({
          icon: 'success',
          title: 'Distribusi Tersimpan',
          text: navigator.onLine ? `${totalHari} tanggal sedang dikirim ke database.` : `${totalHari} tanggal tersimpan di HP dan menunggu koneksi.`,
          toast: true,
          position: 'top-end',
          showConfirmButton: false,
          timer: 2200
        });
        if (navigator.onLine) {
          const batchId = queuedItems[0]?.batchId;
          window.setTimeout(() => {
            syncOfflineQueue(false).then(result => {
              const ownBatchStillPending = getOfflineQueue().some(item => item.batchId === batchId);
              if (ownBatchStillPending && result.failed === 0) return syncOfflineQueue(false);
              return result;
            }).catch(error => console.error('Gagal mengirim distribusi limbah:', error));
          }, 0);
        }
        return;
      }
      if (isLocalDraft) {
        recordId = getSyncedServerId(formData.id) || formData.id;

        // Tunggu auto-sync yang sedang berjalan agar edit tidak memakai ID
        // lokal yang baru saja diganti dengan ID asli dari Supabase.
        if (navigator.onLine && String(recordId).startsWith('off_')) {
          await syncOfflineQueue(false, true);
          recordId = getSyncedServerId(formData.id) || formData.id;
        }
        isLocalDraft = String(recordId).startsWith('off_');
      }
      if (!navigator.onLine || isLocalDraft) {
        if (formData.id) {
          saveToOfflineQueue('limbah_ruangan', 'update', {
            ...payloads[0],
            id: recordId
          }, `Update Limbah Ruangan ${formData.ruangan}`, {
            baseUpdatedAt
          });
        } else {
          insertPayloads.forEach(p => saveToOfflineQueue('limbah_ruangan', 'insert', p, `Input Limbah Ruangan ${formData.ruangan}`));
        }
        MySwal.fire({
          icon: 'info',
          title: 'Tersimpan Offline',
          text: isLocalDraft && navigator.onLine ? 'Perubahan draft tersimpan dan menunggu sinkronisasi.' : 'Data tersimpan di HP dan akan dikirim otomatis saat online.',
          confirmButtonColor: '#059669'
        });
      } else if (formData.id) {
        const pendingRecordUpdate = getOfflineQueue().find(item => {
          if (item.table !== 'limbah_ruangan') return false;
          const references = [item.serverId, item.payload?.id, item.payload?.serverId];
          return references.some(reference => reference != null && String(reference) === String(recordId));
        });

        // Selesaikan perubahan lama terlebih dahulu agar auto-sync tidak
        // datang belakangan dan menimpa nilai terbaru yang sedang disimpan.
        if (pendingRecordUpdate) {
          await syncOfflineQueue(false, true);
          const stillPending = getOfflineQueue().some(item => item.id === pendingRecordUpdate.id);
          if (!stillPending && pendingRecordUpdate.action === 'update') {
            baseUpdatedAt = pendingRecordUpdate.payload?.waktu_input || baseUpdatedAt;
          }
        }
        await updateRecordWithVersion('limbah_ruangan', recordId, payloads[0], baseUpdatedAt);
        cacheServerRows('limbah_ruangan', [{
          ...payloads[0],
          id: recordId
        }]);

        // Jika percobaan sync lama gagal tetapi update terbaru berhasil,
        // antrean lama tidak boleh menimpa nilai yang baru saja tersimpan.
        if (pendingRecordUpdate) removeLocalRecordQueue({
          id: recordId
        });
        MySwal.fire('Berhasil', 'Data limbah ruangan berhasil diubah', 'success');
      } else {
        const {
          error
        } = await supabase.from('limbah_ruangan').insert(insertPayloads);
        if (error) throw error;
        notifyDatabaseTablesChanged('limbah_ruangan');
        MySwal.fire('Berhasil', `Data berhasil disimpan untuk ${totalHari} hari (dibagi rata)`, `success`);
      }

      // Retain date and distribution settings for next input
      setFormData({
        ...EMPTY_FORM,
        tanggal: formData.tanggal,
        isDistribusi: formData.isDistribusi,
        distribusiDates: formData.distribusiDates
      });
      fetchData();
    } catch (error) {
      if (isNetworkError(error)) {
        if (formData.id) {
          saveToOfflineQueue('limbah_ruangan', 'update', {
            ...payloads[0],
            id: recordId
          }, `Update Limbah Ruangan ${formData.ruangan}`, {
            baseUpdatedAt
          });
        } else {
          insertPayloads.forEach(p => saveToOfflineQueue('limbah_ruangan', 'insert', p, `Input Limbah Ruangan ${formData.ruangan}`));
        }
        MySwal.fire({
          icon: 'info',
          title: 'Tersimpan Offline',
          text: 'Jaringan terputus. Data tersimpan di HP.',
          confirmButtonColor: '#059669'
        });
        setFormData({
          ...EMPTY_FORM,
          tanggal: formData.tanggal,
          isDistribusi: formData.isDistribusi,
          distribusiDates: formData.distribusiDates
        });
      } else if (isRecordConflictError(error)) {
        MySwal.fire('Data Sudah Berubah', error.message, 'warning');
        fetchData();
      } else {
        MySwal.fire('Gagal', error.message, 'error');
      }
    } finally {
      setSubmitting(false);
    }
  };
  const handleEdit = async item => {
    try {
      const resolution = await resolveOfflineRecordConflict('limbah_ruangan', item, MySwal);
      if (!resolution) return;
      if (resolution.discardDraft) removeLocalRecordQueue({
        id: item.id
      });
      if (!resolution.record) {
        fetchData();
        return;
      }
      item = resolution.record;
      if (resolution.discardDraft) cacheServerRows('limbah_ruangan', [item]);
    } catch (error) {
      MySwal.fire('Gagal', error.message, 'error');
      return;
    }
    setFormData({
      id: item.id,
      tanggal: item.tanggal,
      ruangan: item.ruangan,
      infeksius: item.infeksius,
      jarum_suntik: item.jarum_suntik,
      botol_obat: item.botol_obat,
      sitotoksik: item.sitotoksik,
      keterangan: item.keterangan || '',
      // Reset state distribusi peninggalan dari input sebelumnya agar
      // tidak ikut terbawa ke sesi edit ini.
      isDistribusi: false,
      distribusiDates: [],
      baseUpdatedAt: getRecordBaseVersion(item)
    });
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  };
  const handleDelete = async item => {
    const {
      isConfirmed
    } = await MySwal.fire({
      title: 'Hapus Data Limbah Ruangan?',
      text: 'Data yang dihapus tidak dapat dikembalikan!',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Ya, Hapus!'
    });
    if (!isConfirmed) return;
    try {
      if (item.isOffline && item.offlineAction === 'insert') {
        let syncedServerId = getSyncedServerId(item.id);
        if (!syncedServerId && navigator.onLine) {
          await syncOfflineQueue(false, true);
          syncedServerId = getSyncedServerId(item.id);
        }
        if (syncedServerId) {
          item = {
            ...item,
            id: syncedServerId
          };
        } else {
          removeLocalRecordQueue(item);
          MySwal.fire('Terhapus', 'Draft offline berhasil dihapus', 'success');
          fetchData();
          return;
        }
      }
      if (!navigator.onLine) {
        saveToOfflineQueue('limbah_ruangan', 'delete', item, `Hapus Limbah Ruangan ${item.ruangan || ''}`, {
          baseUpdatedAt: getRecordBaseVersion(item)
        });
        MySwal.fire({
          icon: 'info',
          title: 'Tersimpan Offline',
          text: 'Perintah hapus akan diproses otomatis saat online.',
          confirmButtonColor: '#059669'
        });
        fetchData();
        return;
      }
      await deleteRecordWithVersion('limbah_ruangan', item.id, getRecordBaseVersion(item));
      // Antrean edit hanya boleh dibuang setelah penghapusan benar-benar
      // dikonfirmasi berhasil oleh server.
      removeLocalRecordQueue(item);
      removeCachedServerRow('limbah_ruangan', item.id);
      MySwal.fire('Terhapus', 'Data berhasil dihapus', 'success');
      fetchData();
    } catch (error) {
      if (isNetworkError(error)) {
        saveToOfflineQueue('limbah_ruangan', 'delete', item, `Hapus Limbah Ruangan ${item.ruangan || ''}`, {
          baseUpdatedAt: getRecordBaseVersion(item)
        });
        MySwal.fire({
          icon: 'info',
          title: 'Tersimpan Offline',
          text: 'Perintah hapus disimpan dan akan diproses otomatis.',
          confirmButtonColor: '#059669'
        });
        fetchData();
      } else if (isRecordConflictError(error)) {
        MySwal.fire('Data Sudah Berubah', error.message, 'warning');
        fetchData();
      } else {
        MySwal.fire('Gagal', error.message, 'error');
      }
    }
  };
  return {
    formData,
    setFormData,
    submitting,
    handleInputChange,
    handleSubmit,
    handleEdit,
    handleDelete,
    showRuanganSheet,
    setShowRuanganSheet
  };
}
