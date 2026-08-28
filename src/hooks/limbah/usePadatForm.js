import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import Swal from 'sweetalert2';
import withReactContent from 'sweetalert2-react-content';
import { getSetting, getSettingCached } from '../../lib/api';
import { saveToOfflineQueue, getOfflineQueue, removeLocalRecordQueue, getSyncedServerId, syncOfflineQueue, cacheServerRows, removeCachedServerRow } from '../../lib/offlineStorage';
import { notifyDatabaseTablesChanged } from '../../lib/databaseAggregations';
import { isNetworkError } from '../../lib/networkErrors';
import { deleteRecordWithVersion, getRecordBaseVersion, isRecordConflictError, resolveOfflineRecordConflict, updateRecordWithVersion } from '../../lib/recordVersion';

const MySwal = withReactContent(Swal);

export default function usePadatForm({
  user,
  fetchData,
  emptyForm: EMPTY_FORM
}) {
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [formEnabled, setFormEnabled] = useState(() => getSettingCached('form_limbah_padat_enabled', true));
  useEffect(() => {
    getSetting('form_limbah_padat_enabled', true).then(setFormEnabled);
    const onSetting = e => {
      if (e.detail?.key === 'form_limbah_padat_enabled') setFormEnabled(e.detail.value);
    };
    window.addEventListener('app-setting-changed', onSetting);
    return () => window.removeEventListener('app-setting-changed', onSetting);
  }, []);
  const handleInputChange = e => setFormData(prev => ({
    ...prev,
    [e.target.name]: e.target.value
  }));
  const handleSubmit = async e => {
    e.preventDefault();
    setSubmitting(true);
    const payload = {
      tanggal: formData.tanggal,
      petugas: user?.nama || 'Petugas',
      infeksius: parseFloat(formData.infeksius) || 0,
      jarum_suntik: parseFloat(formData.jarum_suntik) || 0,
      botol_obat: parseFloat(formData.botol_obat) || 0,
      sitotoksik: parseFloat(formData.sitotoksik) || 0,
      waktu_input: new Date().toISOString()
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
        saveToOfflineQueue('limbah_padat', formData.id ? 'update' : 'insert', formData.id ? {
          ...payload,
          id: recordId
        } : payload, 'Input Limbah Padat', {
          baseUpdatedAt
        });
        MySwal.fire({
          icon: 'info',
          title: 'Tersimpan Offline',
          text: isLocalDraft && navigator.onLine ? 'Perubahan draft tersimpan dan menunggu sinkronisasi.' : 'Data tersimpan di HP dan akan dikirim otomatis saat online.',
          confirmButtonColor: '#059669'
        });
      } else if (formData.id) {
        const pendingRecordUpdate = getOfflineQueue().find(item => {
          if (item.table !== 'limbah_padat') return false;
          return [item.serverId, item.payload?.id, item.payload?.serverId].some(reference => reference != null && String(reference) === String(recordId));
        });
        if (pendingRecordUpdate) {
          await syncOfflineQueue(false, true);
          const stillPending = getOfflineQueue().some(item => item.id === pendingRecordUpdate.id);
          if (!stillPending && pendingRecordUpdate.action === 'update') {
            baseUpdatedAt = pendingRecordUpdate.payload?.waktu_input || baseUpdatedAt;
          }
        }
        await updateRecordWithVersion('limbah_padat', recordId, payload, baseUpdatedAt);
        cacheServerRows('limbah_padat', [{
          ...payload,
          id: recordId
        }]);
        if (pendingRecordUpdate) removeLocalRecordQueue({
          id: recordId
        });
        MySwal.fire('Berhasil', 'Data berhasil diubah', 'success');
      } else {
        const {
          error
        } = await supabase.from('limbah_padat').insert([payload]);
        if (error) throw error;
        notifyDatabaseTablesChanged('limbah_padat');
        MySwal.fire('Berhasil', 'Data berhasil ditambahkan', 'success');
      }
      setFormData(EMPTY_FORM);
      fetchData();
    } catch (error) {
      if (isNetworkError(error)) {
        saveToOfflineQueue('limbah_padat', formData.id ? 'update' : 'insert', formData.id ? {
          ...payload,
          id: recordId
        } : payload, 'Input Limbah Padat', {
          baseUpdatedAt
        });
        MySwal.fire({
          icon: 'info',
          title: 'Tersimpan Offline',
          text: 'Jaringan terputus. Data tersimpan di HP.',
          confirmButtonColor: '#059669'
        });
        setFormData(EMPTY_FORM);
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
    if (item.isRoomAccumulation && !item.isManual) {
      const rooms = Array.from(item.ruanganNames || []);
      MySwal.fire({
        icon: 'info',
        title: 'Akumulasi Data Ruangan',
        html: `Data ini merupakan akumulasi otomatis dari <strong>${item.ruanganCount} ruangan</strong>:<br><br><div class="text-left bg-gray-100 p-3 rounded-lg text-xs max-h-40 overflow-y-auto font-mono">${rooms.map(r => `• ${r}`).join('<br>')}</div><br><span class="text-xs text-gray-500">Untuk mengedit, gunakan menu <strong>Limbah Per Ruangan</strong>.</span>`,
        confirmButtonColor: '#059669'
      });
      return;
    }
    const manualRecords = item.manualRecords || [];
    let selectedRecord = manualRecords[0] || item;
    if (manualRecords.length > 1) {
      const inputOptions = Object.fromEntries(manualRecords.map((record, index) => {
        const total = ['infeksius', 'jarum_suntik', 'botol_obat', 'sitotoksik'].reduce((sum, field) => sum + (parseFloat(record[field]) || 0), 0);
        return [String(record.id), `Input ${index + 1} — ${total.toFixed(2)} Kg${record.petugas ? ` (${record.petugas})` : ''}`];
      }));
      const {
        isConfirmed,
        value
      } = await MySwal.fire({
        title: 'Pilih Data Manual',
        input: 'select',
        inputOptions,
        inputPlaceholder: 'Pilih data yang ingin diubah',
        showCancelButton: true,
        confirmButtonText: 'Edit Data',
        cancelButtonText: 'Batal',
        inputValidator: selectedId => selectedId ? undefined : 'Pilih salah satu data manual.'
      });
      if (!isConfirmed || !value) return;
      selectedRecord = manualRecords.find(record => String(record.id) === String(value));
      if (!selectedRecord) return;
    }
    try {
      const resolution = await resolveOfflineRecordConflict('limbah_padat', selectedRecord, MySwal);
      if (!resolution) return;
      if (resolution.discardDraft) removeLocalRecordQueue({
        id: selectedRecord.id
      });
      if (!resolution.record) {
        fetchData();
        return;
      }
      selectedRecord = resolution.record;
      if (resolution.discardDraft) cacheServerRows('limbah_padat', [selectedRecord]);
      setFormData({
        id: selectedRecord.id,
        tanggal: selectedRecord.tanggal,
        infeksius: selectedRecord.infeksius,
        jarum_suntik: selectedRecord.jarum_suntik,
        botol_obat: selectedRecord.botol_obat,
        sitotoksik: selectedRecord.sitotoksik,
        baseUpdatedAt: getRecordBaseVersion(selectedRecord)
      });
    } catch (error) {
      MySwal.fire('Gagal', error.message, 'error');
      return;
    }
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  };
  const handleDelete = async item => {
    if (item.isRoomAccumulation && !item.isManual) {
      MySwal.fire({
        icon: 'info',
        title: 'Tidak Bisa Dihapus Langsung',
        text: 'Data ini akumulasi otomatis dari Limbah Per Ruangan. Hapus melalui menu "Limbah Per Ruangan".',
        confirmButtonColor: '#059669'
      });
      return;
    }
    const isMixed = item.isRoomAccumulation && item.isManual;
    const idsToDelete = item.padatIds?.length ? item.padatIds : [item.id];
    if (isMixed && idsToDelete.length === 0) {
      MySwal.fire({
        icon: 'warning',
        title: 'Tidak ada data manual',
        text: 'Data ruangan harus dihapus dari menu Limbah Per Ruangan.',
        confirmButtonColor: '#059669'
      });
      return;
    }
    const tglLabel = new Date(item.tanggal).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
    const {
      isConfirmed
    } = await MySwal.fire({
      title: 'Hapus Data?',
      text: isMixed ? `Hanya data manual pada ${tglLabel} yang dihapus.` : `Data ${tglLabel} akan dihapus permanen!`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Ya, Hapus!'
    });
    if (!isConfirmed) return;
    try {
      let queuedDelete = false;
      for (const initialId of idsToDelete) {
        let id = getSyncedServerId(initialId) || initialId;
        const originalRecord = (item.manualRecords || []).find(record => String(record.id) === String(initialId)) || item;
        const baseUpdatedAt = getRecordBaseVersion(originalRecord);
        if (String(id).startsWith('off_') && navigator.onLine) {
          await syncOfflineQueue(false, true);
          id = getSyncedServerId(initialId) || initialId;
        }
        if (String(id).startsWith('off_')) {
          removeLocalRecordQueue({
            id: String(initialId)
          });
          continue;
        }
        if (!navigator.onLine) {
          saveToOfflineQueue('limbah_padat', 'delete', {
            id
          }, `Hapus Limbah Padat ${item.tanggal}`, {
            baseUpdatedAt
          });
          queuedDelete = true;
          continue;
        }
        try {
          await deleteRecordWithVersion('limbah_padat', id, baseUpdatedAt);
          removeLocalRecordQueue({
            id: String(id)
          });
          removeCachedServerRow('limbah_padat', id);
        } catch (error) {
          if (isNetworkError(error)) {
            saveToOfflineQueue('limbah_padat', 'delete', {
              id
            }, `Hapus Limbah Padat ${item.tanggal}`, {
              baseUpdatedAt
            });
            queuedDelete = true;
            continue;
          }
          throw error;
        }
      }
      MySwal.fire(queuedDelete ? 'Tersimpan Offline' : 'Terhapus', queuedDelete ? 'Perintah hapus disimpan dan akan diproses otomatis.' : isMixed ? 'Data manual berhasil dihapus.' : 'Data berhasil dihapus.', queuedDelete ? 'info' : 'success');
      fetchData();
    } catch (error) {
      if (isRecordConflictError(error)) {
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
    formEnabled
  };
}
