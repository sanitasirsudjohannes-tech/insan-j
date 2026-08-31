import { useRef, useState } from 'react';
import { supabase } from '../../lib/supabase';
import Swal from 'sweetalert2';
import withReactContent from 'sweetalert2-react-content';
import { saveToOfflineQueue, getOfflineQueue, removeLocalRecordQueue, getSyncedServerId, syncOfflineQueue, cacheServerRows, removeCachedServerRow } from '../../lib/offlineStorage';
import { getLocalDateString } from '../../lib/localDate';
import { isNetworkError } from '../../lib/networkErrors';
import { notifyDatabaseTablesChanged } from '../../lib/databaseAggregations';
import { deleteRecordWithVersion, getRecordBaseVersion, isRecordConflictError, resolveOfflineRecordConflict, updateRecordWithVersion } from '../../lib/recordVersion';

const MySwal = withReactContent(Swal);

export default function useAnorganikForm({
  user,
  fetchData
}) {
  const [submitting, setSubmitting] = useState(false);
  const emptyForm = {
    id: null,
    tanggal: getLocalDateString(),
    ruangan: '',
    infus: '',
    jerigen: '',
    kertas: '',
    kardus: '',
    botol_mineral: '',
    bayclin_dll: '',
    keterangan: ''
  };
  const [formData, setFormData] = useState(emptyForm);
  const [showRuanganSheet, setShowRuanganSheet] = useState(false);
  const dateBeforeEditRef = useRef(null);
  const resetFormWithDate = date => {
    dateBeforeEditRef.current = null;
    setFormData({
      ...emptyForm,
      tanggal: date || getLocalDateString()
    });
  };
  const handleInputChange = e => {
    const {
      name,
      value
    } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };
  const handleSubmit = async e => {
    e.preventDefault();
    if (!formData.ruangan) {
      MySwal.fire('Peringatan', 'Silakan pilih ruangan terlebih dahulu!', 'warning');
      return;
    }
    if (!Number.isInteger(Number(formData.jerigen)) || Number(formData.jerigen) < 0) {
      MySwal.fire('Peringatan', 'Jumlah jerigen harus berupa bilangan bulat karena dihitung per buah.', 'warning');
      return;
    }
    setSubmitting(true);
    const payload = {
      tanggal: formData.tanggal,
      ruangan: formData.ruangan,
      petugas: user?.nama || 'Petugas',
      infus: parseFloat(formData.infus) || 0,
      jerigen: parseFloat(formData.jerigen) || 0,
      kertas: parseFloat(formData.kertas) || 0,
      kardus: parseFloat(formData.kardus) || 0,
      botol_mineral: parseFloat(formData.botol_mineral) || 0,
      bayclin_dll: parseFloat(formData.bayclin_dll) || 0,
      keterangan: formData.keterangan || '',
      waktu_input: new Date().toISOString()
    };
    const insertPayload = {
      ...payload,
      created_by: user?.id
    };
    let recordId = formData.id;
    let baseUpdatedAt = formData.baseUpdatedAt || null;
    let isLocalDraft = Boolean(recordId) && String(recordId).startsWith('off_');
    try {
      if (isLocalDraft) {
        recordId = getSyncedServerId(formData.id) || formData.id;
        if (navigator.onLine && String(recordId).startsWith('off_')) {
          await syncOfflineQueue(false, true);
          recordId = getSyncedServerId(formData.id) || formData.id;
        }
        isLocalDraft = String(recordId).startsWith('off_');
      }
      if (!navigator.onLine || isLocalDraft) {
        saveToOfflineQueue('limbah_anorganik', formData.id ? 'update' : 'insert', formData.id ? {
          ...payload,
          id: recordId
        } : insertPayload, `Input Limbah Anorganik ${formData.ruangan}`, {
          baseUpdatedAt
        });
        MySwal.fire({
          icon: 'info',
          title: 'Tersimpan Offline',
          text: isLocalDraft && navigator.onLine ? 'Perubahan draft tersimpan dan menunggu sinkronisasi.' : 'Data telah disimpan di HP (Draft). Akan otomatis dikirim saat terhubung internet.',
          confirmButtonColor: '#0891b2'
        });
      } else {
        if (formData.id) {
          const pendingRecordUpdate = getOfflineQueue().find(item => {
            if (item.table !== 'limbah_anorganik') return false;
            const references = [item.serverId, item.payload?.id, item.payload?.serverId];
            return references.some(reference => reference != null && String(reference) === String(recordId));
          });
          if (pendingRecordUpdate) {
            await syncOfflineQueue(false, true);
            const stillPending = getOfflineQueue().some(item => item.id === pendingRecordUpdate.id);
            if (!stillPending && pendingRecordUpdate.action === 'update') {
              baseUpdatedAt = pendingRecordUpdate.payload?.waktu_input || baseUpdatedAt;
            }
          }
          await updateRecordWithVersion('limbah_anorganik', recordId, payload, baseUpdatedAt);
          cacheServerRows('limbah_anorganik', [{
            ...payload,
            id: recordId
          }]);
          if (pendingRecordUpdate) removeLocalRecordQueue({
            id: recordId
          });
          MySwal.fire('Berhasil', 'Data limbah anorganik berhasil diubah', 'success');
        } else {
          const {
            error
          } = await supabase.from('limbah_anorganik').insert([insertPayload]);
          if (error) throw error;
          notifyDatabaseTablesChanged('limbah_anorganik');
          MySwal.fire('Berhasil', 'Data limbah anorganik berhasil ditambahkan', 'success');
        }
      }
      resetFormWithDate(formData.tanggal);
      fetchData();
    } catch (error) {
      if (isNetworkError(error)) {
        saveToOfflineQueue('limbah_anorganik', formData.id ? 'update' : 'insert', formData.id ? {
          ...payload,
          id: recordId
        } : insertPayload, `Input Limbah Anorganik ${formData.ruangan}`, {
          baseUpdatedAt
        });
        MySwal.fire({
          icon: 'info',
          title: 'Tersimpan Offline',
          text: 'Jaringan terputus. Data telah disimpan di HP (Draft) dan akan dikirim otomatis.',
          confirmButtonColor: '#0891b2'
        });
        resetFormWithDate(formData.tanggal);
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
      const resolution = await resolveOfflineRecordConflict('limbah_anorganik', item, MySwal);
      if (!resolution) return;
      if (resolution.discardDraft) removeLocalRecordQueue({
        id: item.id
      });
      if (!resolution.record) {
        fetchData();
        return;
      }
      item = resolution.record;
      if (resolution.discardDraft) cacheServerRows('limbah_anorganik', [item]);
    } catch (error) {
      MySwal.fire('Gagal', error.message, 'error');
      return;
    }
    if (!formData.id) {
      dateBeforeEditRef.current = formData.tanggal || getLocalDateString();
    }
    setFormData({
      id: item.id,
      tanggal: item.tanggal,
      ruangan: item.ruangan || '',
      infus: item.infus,
      jerigen: item.jerigen,
      kertas: item.kertas,
      kardus: item.kardus,
      botol_mineral: item.botol_mineral,
      bayclin_dll: item.bayclin_dll,
      keterangan: item.keterangan || '',
      baseUpdatedAt: getRecordBaseVersion(item)
    });
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  };
  const handleCancelEdit = () => {
    resetFormWithDate(dateBeforeEditRef.current);
  };
  const handleDelete = async item => {
    const confirm = await MySwal.fire({
      title: 'Hapus Data Limbah Anorganik?',
      text: 'Data yang dihapus tidak dapat dikembalikan!',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Ya, Hapus!'
    });
    if (!confirm.isConfirmed) return;
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
        saveToOfflineQueue('limbah_anorganik', 'delete', item, `Hapus Limbah Anorganik ${item.ruangan || ''}`, {
          baseUpdatedAt: getRecordBaseVersion(item)
        });
        MySwal.fire({
          icon: 'info',
          title: 'Tersimpan Offline',
          text: 'Perintah hapus disimpan di HP. Akan diproses otomatis saat terhubung internet.',
          confirmButtonColor: '#0891b2'
        });
        fetchData();
        return;
      }
      await deleteRecordWithVersion('limbah_anorganik', item.id, getRecordBaseVersion(item));
      removeLocalRecordQueue(item);
      removeCachedServerRow('limbah_anorganik', item.id);
      MySwal.fire('Terhapus', 'Data berhasil dihapus', 'success');
      fetchData();
    } catch (error) {
      if (isNetworkError(error)) {
        saveToOfflineQueue('limbah_anorganik', 'delete', item, `Hapus Limbah Anorganik ${item.ruangan || ''}`, {
          baseUpdatedAt: getRecordBaseVersion(item)
        });
        MySwal.fire({
          icon: 'info',
          title: 'Tersimpan Offline',
          text: 'Jaringan terputus. Perintah hapus disimpan dan akan diproses otomatis.',
          confirmButtonColor: '#0891b2'
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
    handleCancelEdit,
    handleDelete,
    showRuanganSheet,
    setShowRuanganSheet
  };
}
