import { useState } from 'react';
import {
  cacheServerRows, getOfflineQueue, getSyncedServerId, removeCachedServerRow,
  removeLocalRecordQueue, saveToOfflineQueue, syncOfflineQueue
} from '../../../lib/offlineStorage';
import { getLocalDateString } from '../../../lib/localDate';
import { notifyDatabaseTablesChanged } from '../../../lib/databaseAggregations';
import { isNetworkError } from '../../../lib/networkErrors';
import {
  deleteRecordWithVersion, getRecordBaseVersion, isRecordConflictError,
  resolveOfflineRecordConflict, updateRecordWithVersion
} from '../../../lib/recordVersion';
import { createPengangkutan } from '../services/pengangkutanService';

const createEmptyForm = () => ({
  id: null,
  tanggal: getLocalDateString(),
  jumlah_kg: '',
  keterangan: '',
});

export default function usePengangkutanMutations({ user, fetchData, alert }) {
  const MySwal = alert;
  const [submitting, setSubmitting] = useState(false);
  const emptyForm = createEmptyForm();
  const [form, setForm] = useState(createEmptyForm);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setForm(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);

        const payload = {
            tanggal: form.tanggal,
            jumlah_kg: parseFloat(form.jumlah_kg) || 0,
            keterangan: form.keterangan || '',
            petugas: user?.nama || 'Petugas',
            waktu_input: new Date().toISOString()
        };
        let recordId = form.id;
        let baseUpdatedAt = form.baseUpdatedAt || null;
        let isLocalDraft = Boolean(recordId) && String(recordId).startsWith('off_');

        try {
            if (isLocalDraft) {
                recordId = getSyncedServerId(form.id) || form.id;
                if (navigator.onLine && String(recordId).startsWith('off_')) {
                    await syncOfflineQueue(false, true);
                    recordId = getSyncedServerId(form.id) || form.id;
                }
                isLocalDraft = String(recordId).startsWith('off_');
            }

            if (!navigator.onLine || isLocalDraft) {
                saveToOfflineQueue(
                    'pengangkutan_limbah',
                    form.id ? 'update' : 'insert',
                    form.id ? { ...payload, id: recordId } : payload,
                    'Pengangkutan Limbah',
                    { baseUpdatedAt }
                );
                MySwal.fire({
                    icon: 'info',
                    title: 'Tersimpan Offline',
                    text: isLocalDraft && navigator.onLine
                        ? 'Perubahan draft tersimpan dan menunggu sinkronisasi.'
                        : 'Data telah disimpan di HP (Draft). Akan otomatis dikirim saat terhubung internet.',
                    confirmButtonColor: '#ea580c'
                });
            } else if (form.id) {
                const pendingRecordUpdate = getOfflineQueue().find(item => {
                    if (item.table !== 'pengangkutan_limbah') return false;
                    return [item.serverId, item.payload?.id, item.payload?.serverId]
                        .some(reference => reference != null && String(reference) === String(recordId));
                });

                // Kirim perubahan lama lebih dulu agar tidak datang belakangan
                // dan menimpa nilai terbaru yang sedang disimpan.
                if (pendingRecordUpdate) {
                    await syncOfflineQueue(false, true);
                    const stillPending = getOfflineQueue().some(item => item.id === pendingRecordUpdate.id);
                    if (!stillPending && pendingRecordUpdate.action === 'update') {
                        baseUpdatedAt = pendingRecordUpdate.payload?.waktu_input || baseUpdatedAt;
                    }
                }

                await updateRecordWithVersion('pengangkutan_limbah', recordId, payload, baseUpdatedAt);
                cacheServerRows('pengangkutan_limbah', [{ ...payload, id: recordId }]);
                if (pendingRecordUpdate) removeLocalRecordQueue({ id: recordId });
                MySwal.fire('Berhasil', 'Data diperbarui', 'success');
            } else {
                const insertedRow = await createPengangkutan(payload);
                if (insertedRow?.id) cacheServerRows('pengangkutan_limbah', [insertedRow]);
                notifyDatabaseTablesChanged('pengangkutan_limbah');
                MySwal.fire('Berhasil', 'Data pengangkutan ditambahkan', 'success');
            }
            setForm(createEmptyForm());
            fetchData();
        } catch (e) {
            if (isNetworkError(e)) {
                saveToOfflineQueue(
                    'pengangkutan_limbah',
                    form.id ? 'update' : 'insert',
                    form.id ? { ...payload, id: recordId } : payload,
                    'Pengangkutan Limbah',
                    { baseUpdatedAt }
                );
                MySwal.fire({
                    icon: 'info',
                    title: 'Tersimpan Offline',
                    text: 'Jaringan terputus. Data telah disimpan di HP (Draft) dan akan dikirim otomatis.',
                    confirmButtonColor: '#ea580c'
                });
                setForm(createEmptyForm());
            } else if (isRecordConflictError(e)) {
                MySwal.fire('Data Sudah Berubah', e.message, 'warning');
                fetchData();
            } else {
                MySwal.fire('Gagal', e.message, 'error');
            }
        } finally {
            setSubmitting(false);
        }
    };

    const handleEdit = async (item) => {
        try {
            const resolution = await resolveOfflineRecordConflict('pengangkutan_limbah', item, MySwal);
            if (!resolution) return;
            if (resolution.discardDraft) removeLocalRecordQueue({ id: item.id });
            if (!resolution.record) { fetchData(); return; }
            item = resolution.record;
            if (resolution.discardDraft) cacheServerRows('pengangkutan_limbah', [item]);
        } catch (error) {
            MySwal.fire('Gagal', error.message, 'error');
            return;
        }

        setForm({
            id: item.id,
            tanggal: item.tanggal,
            jumlah_kg: item.jumlah_kg,
            keterangan: item.keterangan || '',
            baseUpdatedAt: getRecordBaseVersion(item),
        });
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleDelete = async (item) => {
        const { isConfirmed } = await MySwal.fire({
            title: 'Hapus Data?', text: 'Data tidak dapat dikembalikan!', icon: 'warning',
            showCancelButton: true, confirmButtonColor: '#d33', confirmButtonText: 'Ya, Hapus!'
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
                    item = { ...item, id: syncedServerId };
                } else {
                    removeLocalRecordQueue(item);
                    MySwal.fire('Terhapus!', 'Draft offline berhasil dihapus', 'success');
                    fetchData();
                    return;
                }
            }

            if (!navigator.onLine) {
                saveToOfflineQueue(
                    'pengangkutan_limbah',
                    'delete',
                    item,
                    `Hapus Pengangkutan ${item.tanggal}`,
                    { baseUpdatedAt: getRecordBaseVersion(item) }
                );
                MySwal.fire({ icon: 'info', title: 'Tersimpan Offline', text: 'Perintah hapus disimpan di HP dan akan diproses otomatis.', confirmButtonColor: '#ea580c' });
                fetchData();
                return;
            }

            await deleteRecordWithVersion('pengangkutan_limbah', item.id, getRecordBaseVersion(item));
            removeLocalRecordQueue(item);
            removeCachedServerRow('pengangkutan_limbah', item.id);
            MySwal.fire('Terhapus!', 'Data berhasil dihapus', 'success');
            fetchData();
        } catch (e) {
            if (isNetworkError(e)) {
                saveToOfflineQueue(
                    'pengangkutan_limbah',
                    'delete',
                    item,
                    `Hapus Pengangkutan ${item.tanggal}`,
                    { baseUpdatedAt: getRecordBaseVersion(item) }
                );
                MySwal.fire({ icon: 'info', title: 'Tersimpan Offline', text: 'Jaringan terputus. Perintah hapus disimpan dan akan diproses otomatis.', confirmButtonColor: '#ea580c' });
                fetchData();
            } else if (isRecordConflictError(e)) {
                MySwal.fire('Data Sudah Berubah', e.message, 'warning');
                fetchData();
            } else {
                MySwal.fire('Gagal', e.message, 'error');
            }
        }
    };

    // ── Export Excel ──

  return {
    form, setForm, emptyForm, submitting,
    handleChange, handleSubmit, handleEdit, handleDelete
  };
}
