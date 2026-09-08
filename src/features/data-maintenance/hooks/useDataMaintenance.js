import { useMemo, useRef, useState } from 'react';
import {
  createArchiveBackup,
  deleteArchivedYear,
  downloadArchiveExcel,
  downloadArchiveJson,
  inspectArchiveYear,
  restoreArchiveBackup,
  validateArchiveBackup,
} from '../services/dataMaintenanceService';
import { clearCachedServerRows, getOfflineQueue } from '../../../lib/offlineStorage';
import { notifyDatabaseTablesChanged } from '../../../lib/databaseAggregations';
import { getLocalDateString } from '../../../lib/localDate';

const getCurrentYear = () => Number(getLocalDateString().slice(0, 4));
const TRANSACTION_TABLES = [
  'limbah_padat', 'limbah_ruangan', 'limbah_anorganik', 'pengangkutan_limbah'
];

export default function useDataMaintenance({ user, alert }) {
  const currentYear = getCurrentYear();
  const [year, setYear] = useState(currentYear - 1);
  const [inspection, setInspection] = useState(null);
  const [verifiedArchive, setVerifiedArchive] = useState(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');
  const restoreInputRef = useRef(null);

  const totalRows = useMemo(
    () => (inspection || []).reduce((total, item) => total + item.count, 0),
    [inspection]
  );
  const deletionAllowed = Number(year) <= currentYear - 2
    && verifiedArchive?.manifest?.year === Number(year)
    && verifiedArchive?.manifest?.totalRows === totalRows;

  const resetVerification = (nextYear) => {
    setYear(Number(nextYear));
    setInspection(null);
    setVerifiedArchive(null);
    setProgress('');
  };

  const inspect = async () => {
    setBusy(true);
    setProgress('Memeriksa jumlah data...');
    try {
      const result = await inspectArchiveYear(year);
      setInspection(result);
      setVerifiedArchive(null);
    } catch (error) {
      alert.fire('Pemeriksaan Gagal', error.message, 'error');
    } finally {
      setBusy(false);
      setProgress('');
    }
  };

  const backup = async () => {
    setBusy(true);
    try {
      const archive = await createArchiveBackup(
        year,
        user?.nama || user?.username,
        message => setProgress(message)
      );
      const freshInspection = await inspectArchiveYear(year);
      const actualCounts = Object.fromEntries(freshInspection.map(item => [item.name, item.count]));
      const unchanged = Object.entries(archive.manifest.counts)
        .every(([table, count]) => actualCounts[table] === count);
      if (!unchanged) throw new Error('Data berubah saat backup dibuat. Silakan ulangi backup.');

      downloadArchiveJson(archive);
      await downloadArchiveExcel(archive);
      setInspection(freshInspection);
      setVerifiedArchive(archive);
      await alert.fire({
        icon: 'success',
        title: 'Backup Terverifikasi',
        text: `${archive.manifest.totalRows} baris berhasil dibuat dalam format JSON dan Excel. Simpan file JSON karena diperlukan untuk pemulihan.`,
      });
    } catch (error) {
      setVerifiedArchive(null);
      alert.fire('Backup Gagal', error.message, 'error');
    } finally {
      setBusy(false);
      setProgress('');
    }
  };

  const remove = async () => {
    if (!deletionAllowed) return;
    const pending = getOfflineQueue();
    if (pending.length > 0) {
      alert.fire('Masih Ada Draft Offline', `Sinkronkan atau hapus ${pending.length} antrean offline sebelum membersihkan arsip.`, 'warning');
      return;
    }

    const confirmationText = `HAPUS ARSIP ${year}`;
    const result = await alert.fire({
      title: `Hapus data tahun ${year}?`,
      html: `<p class="mb-3">Sebanyak <strong>${totalRows} baris</strong> akan dihapus permanen.</p><p>Ketik <strong>${confirmationText}</strong> untuk melanjutkan.</p>`,
      input: 'text',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc2626',
      confirmButtonText: 'Hapus Data',
      preConfirm: value => value === confirmationText || alert.showValidationMessage('Teks konfirmasi belum sesuai.'),
    });
    if (!result.isConfirmed) return;

    setBusy(true);
    try {
      setProgress('Memverifikasi ulang isi database...');
      const currentArchive = await createArchiveBackup(year, user?.nama || user?.username);
      if (currentArchive.manifest.checksum !== verifiedArchive.manifest.checksum) {
        throw new Error('Data berubah setelah backup dibuat. Buat backup baru sebelum menghapus.');
      }
      await deleteArchivedYear(year, message => setProgress(message));
      const remaining = await inspectArchiveYear(year);
      if (remaining.some(item => item.count !== 0)) {
        throw new Error('Masih ada data tersisa. Proses dihentikan untuk diperiksa.');
      }
      clearCachedServerRows(TRANSACTION_TABLES);
      notifyDatabaseTablesChanged(TRANSACTION_TABLES);
      setInspection(remaining);
      setVerifiedArchive(null);
      alert.fire('Pembersihan Selesai', `Data tahun ${year} berhasil dihapus setelah backup terverifikasi.`, 'success');
    } catch (error) {
      alert.fire('Pembersihan Terhenti', error.message, 'error');
    } finally {
      setBusy(false);
      setProgress('');
    }
  };

  const restore = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setBusy(true);
    try {
      const archive = validateArchiveBackup(JSON.parse(await file.text()));
      if (archive.manifest.year >= currentYear) {
        throw new Error('Pemulihan arsip tahun berjalan tidak diizinkan.');
      }
      const answer = await alert.fire({
        title: `Pulihkan arsip ${archive.manifest.year}?`,
        text: `${archive.manifest.totalRows} baris akan dimasukkan kembali. ID yang sama akan diperbarui.`,
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Pulihkan',
      });
      if (!answer.isConfirmed) return;

      await restoreArchiveBackup(archive, message => setProgress(message));
      clearCachedServerRows(TRANSACTION_TABLES);
      notifyDatabaseTablesChanged(TRANSACTION_TABLES);
      if (archive.manifest.year === Number(year)) {
        setInspection(await inspectArchiveYear(year));
        setVerifiedArchive(null);
      }
      alert.fire('Pemulihan Selesai', 'Arsip berhasil dimasukkan kembali ke database.', 'success');
    } catch (error) {
      alert.fire('Pemulihan Gagal', error.message, 'error');
    } finally {
      setBusy(false);
      setProgress('');
    }
  };

  return {
    year, currentYear, inspection, totalRows, verifiedArchive, deletionAllowed,
    busy, progress, restoreInputRef, setYear: resetVerification,
    inspect, backup, remove, restore,
  };
}
