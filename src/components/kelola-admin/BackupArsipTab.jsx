import { useCallback, useEffect, useRef, useState } from 'react';
import Swal from 'sweetalert2';
import withReactContent from 'sweetalert2-react-content';
import {
  buildBackupPackage,
  downloadBackupPackage,
  invokeAdminArchiveFunction,
  parseBackupPackage,
  setMaintenanceCache,
} from '../../lib/adminArchive';
import {
  archiveStatusMeta,
  chunkRows,
  formatArchiveBytes,
  getDefaultArchivePeriod,
  getDeleteConfirmation,
  getRestoreConfirmation,
  OPERATIONAL_ARCHIVE_TABLES,
} from '../../lib/adminArchiveCore';
import {
  clearCachedServerRows,
  getOfflineQueue,
} from '../../lib/offlineStorage';
import { notifyDatabaseTablesChanged } from '../../lib/databaseAggregations';

const MySwal = withReactContent(Swal);
const ALL_TABLE_IDS = OPERATIONAL_ARCHIVE_TABLES.map(table => table.id);

const sumCounts = (counts = {}, tables = Object.keys(counts)) => (
  tables.reduce((total, table) => total + (Number(counts?.[table]) || 0), 0)
);

const formatDateTime = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? String(value)
    : date.toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });
};

const getAuditLabel = (action) => ({
  backup_created: 'Backup dibuat',
  backup_verified: 'Backup diverifikasi',
  maintenance_enabled: 'Pemeliharaan diaktifkan',
  maintenance_disabled: 'Pemeliharaan dinonaktifkan',
  data_purged: 'Data arsip dihapus',
  data_restored: 'Data dipulihkan',
}[action] || action);

function TableChecklist({ selected, counts, onToggle, disabled = false, available = ALL_TABLE_IDS }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
      {OPERATIONAL_ARCHIVE_TABLES.filter(table => available.includes(table.id)).map(table => {
        const checked = selected.includes(table.id);
        return (
          <label
            key={table.id}
            className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 transition ${
              checked ? 'border-indigo-300 bg-indigo-50' : 'border-gray-200 bg-white'
            } ${disabled ? 'opacity-60' : 'cursor-pointer'}`}
          >
            <input
              type="checkbox"
              checked={checked}
              disabled={disabled}
              onChange={() => onToggle(table.id)}
              className="w-4 h-4 accent-indigo-600"
            />
            <span className="min-w-0 flex-1">
              <span className="block text-xs font-bold text-gray-700 truncate">{table.label}</span>
              {counts && (
                <span className="block text-[11px] text-gray-500">
                  {(Number(counts[table.id]) || 0).toLocaleString('id-ID')} record
                </span>
              )}
            </span>
          </label>
        );
      })}
    </div>
  );
}

export default function BackupArsipTab() {
  const defaultPeriod = getDefaultArchivePeriod();
  const [periodStart, setPeriodStart] = useState(defaultPeriod.start);
  const [periodEnd, setPeriodEnd] = useState(defaultPeriod.end);
  const [selectedTables, setSelectedTables] = useState(ALL_TABLE_IDS);
  const [preview, setPreview] = useState(null);
  const [serverState, setServerState] = useState({
    maintenance_mode: false,
    archives: [],
    audit_logs: [],
  });
  const [stateError, setStateError] = useState('');
  const [loadingState, setLoadingState] = useState(true);
  const [previewing, setPreviewing] = useState(false);
  const [backingUp, setBackingUp] = useState(false);
  const [savingMaintenance, setSavingMaintenance] = useState(false);
  const [purgingId, setPurgingId] = useState(null);
  const [restoreBundle, setRestoreBundle] = useState(null);
  const [restoreTables, setRestoreTables] = useState([]);
  const [restoreFileName, setRestoreFileName] = useState('');
  const [restoring, setRestoring] = useState(false);
  const [restoreProgress, setRestoreProgress] = useState('');
  const [queueCount, setQueueCount] = useState(() => getOfflineQueue().length);
  const restoreInputRef = useRef(null);

  const loadState = useCallback(async () => {
    setLoadingState(true);
    try {
      const data = await invokeAdminArchiveFunction('admin-backup-data', { action: 'state' });
      setServerState({
        maintenance_mode: data.maintenance_mode === true,
        archives: data.archives || [],
        audit_logs: data.audit_logs || [],
      });
      setMaintenanceCache(data.maintenance_mode === true);
      setStateError('');
    } catch (error) {
      setStateError(error.message || 'Fitur Backup & Arsip belum siap di Supabase.');
    } finally {
      setLoadingState(false);
    }
  }, []);

  useEffect(() => {
    loadState();
    const updateQueueCount = () => setQueueCount(getOfflineQueue().length);
    window.addEventListener('offline-queue-changed', updateQueueCount);
    window.addEventListener('offline-sync-finished', updateQueueCount);
    return () => {
      window.removeEventListener('offline-queue-changed', updateQueueCount);
      window.removeEventListener('offline-sync-finished', updateQueueCount);
    };
  }, [loadState]);

  const invalidatePreview = () => setPreview(null);

  const toggleTable = (tableId) => {
    setSelectedTables(current => (
      current.includes(tableId)
        ? current.filter(item => item !== tableId)
        : [...current, tableId]
    ));
    invalidatePreview();
  };

  const handlePreview = async () => {
    if (selectedTables.length === 0) {
      MySwal.fire('Pilih Data', 'Pilih minimal satu jenis data.', 'warning');
      return;
    }
    setPreviewing(true);
    try {
      const data = await invokeAdminArchiveFunction('admin-backup-data', {
        action: 'preview',
        period_start: periodStart,
        period_end: periodEnd,
        tables: selectedTables,
      });
      setPreview(data);
    } catch (error) {
      MySwal.fire('Gagal Memeriksa Data', error.message, 'error');
    } finally {
      setPreviewing(false);
    }
  };

  const handleMaintenance = async (enabled) => {
    if (enabled && queueCount > 0) {
      MySwal.fire({
        icon: 'warning',
        title: 'Masih Ada Draft di Perangkat Ini',
        text: `Sinkronkan atau selesaikan ${queueCount} draft sebelum mengaktifkan pemeliharaan.`,
      });
      return;
    }

    const confirmation = await MySwal.fire({
      icon: enabled ? 'warning' : 'question',
      title: enabled ? 'Aktifkan Mode Pemeliharaan?' : 'Aktifkan Kembali Input?',
      text: enabled
        ? 'Input dan sinkronisasi seluruh petugas akan ditolak sementara oleh server.'
        : 'Petugas dapat kembali mengirim data dan menyinkronkan draft.',
      showCancelButton: true,
      confirmButtonText: enabled ? 'Ya, Hentikan Input' : 'Ya, Aktifkan Input',
      cancelButtonText: 'Batal',
      confirmButtonColor: enabled ? '#d97706' : '#16a34a',
    });
    if (!confirmation.isConfirmed) return;

    setSavingMaintenance(true);
    try {
      await invokeAdminArchiveFunction('admin-backup-data', {
        action: 'set-maintenance',
        enabled,
      });
      setMaintenanceCache(enabled);
      await loadState();
      MySwal.fire({
        icon: 'success',
        title: enabled ? 'Mode Pemeliharaan Aktif' : 'Input Aktif Kembali',
        timer: 1800,
        showConfirmButton: false,
      });
    } catch (error) {
      MySwal.fire('Pengaturan Gagal', error.message, 'error');
    } finally {
      setSavingMaintenance(false);
    }
  };

  const handleCreateBackup = async () => {
    if (!serverState.maintenance_mode) {
      MySwal.fire('Pemeliharaan Belum Aktif', 'Aktifkan mode pemeliharaan agar data tidak berubah selama backup.', 'warning');
      return;
    }
    if (selectedTables.length === 0) {
      MySwal.fire('Pilih Data', 'Pilih minimal satu jenis data.', 'warning');
      return;
    }

    const total = preview ? sumCounts(preview.table_counts, selectedTables) : null;
    const confirmation = await MySwal.fire({
      icon: 'question',
      title: 'Buat Backup Final?',
      text: total === null
        ? `${periodStart} s.d. ${periodEnd}`
        : `${total.toLocaleString('id-ID')} record akan dimasukkan ke paket backup.`,
      showCancelButton: true,
      confirmButtonText: 'Buat & Unduh Backup',
      cancelButtonText: 'Batal',
      confirmButtonColor: '#4f46e5',
    });
    if (!confirmation.isConfirmed) return;

    setBackingUp(true);
    MySwal.fire({
      title: 'Membuat Backup...',
      text: 'Jangan tutup halaman sampai file selesai diunduh dan diverifikasi.',
      allowOutsideClick: false,
      didOpen: () => MySwal.showLoading(),
    });
    try {
      const backup = await invokeAdminArchiveFunction('admin-backup-data', {
        action: 'create',
        period_start: periodStart,
        period_end: periodEnd,
        tables: selectedTables,
      });
      const blob = await buildBackupPackage(backup);
      downloadBackupPackage(blob, backup.manifest.file_name);
      await invokeAdminArchiveFunction('admin-backup-data', {
        action: 'verify',
        archive_id: backup.manifest.archive_id,
        checksum_sha256: backup.manifest.checksum_sha256,
        file_size_bytes: blob.size,
      });
      await loadState();
      setPreview({
        table_counts: backup.manifest.table_counts,
        total_rows: sumCounts(backup.manifest.table_counts),
        period_start: backup.manifest.period.start,
        period_end: backup.manifest.period.end,
      });
      MySwal.fire({
        icon: 'success',
        title: 'Backup Berhasil & Terverifikasi',
        text: `${backup.manifest.file_name} (${formatArchiveBytes(blob.size)}) telah diunduh. Simpan file di tempat aman.`,
        confirmButtonColor: '#16a34a',
      });
    } catch (error) {
      MySwal.fire({
        icon: 'error',
        title: 'Backup Belum Selesai',
        text: `${error.message} Data server tidak dihapus.`,
      });
    } finally {
      setBackingUp(false);
    }
  };

  const handleBackupFile = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setRestoreProgress('Memeriksa file dan checksum...');
    try {
      const bundle = await parseBackupPackage(file);
      setRestoreBundle(bundle);
      setRestoreTables(bundle.manifest.selected_tables);
      setRestoreFileName(file.name);
      setRestoreProgress('');
    } catch (error) {
      setRestoreBundle(null);
      setRestoreTables([]);
      setRestoreFileName('');
      setRestoreProgress('');
      if (restoreInputRef.current) restoreInputRef.current.value = '';
      MySwal.fire('File Backup Ditolak', error.message, 'error');
    }
  };

  const toggleRestoreTable = (tableId) => {
    if (!restoreBundle?.manifest.selected_tables.includes(tableId)) return;
    setRestoreTables(current => (
      current.includes(tableId)
        ? current.filter(item => item !== tableId)
        : [...current, tableId]
    ));
  };

  const handleRestore = async () => {
    if (!restoreBundle || restoreTables.length === 0) {
      MySwal.fire('Pilih Backup', 'Unggah backup dan pilih minimal satu jenis data.', 'warning');
      return;
    }
    if (!serverState.maintenance_mode) {
      MySwal.fire('Pemeliharaan Belum Aktif', 'Aktifkan mode pemeliharaan sebelum restore.', 'warning');
      return;
    }
    if (queueCount > 0) {
      MySwal.fire('Masih Ada Draft', 'Selesaikan antrean draft pada perangkat ini sebelum restore.', 'warning');
      return;
    }

    const phrase = getRestoreConfirmation(
      restoreBundle.manifest.period.start,
      restoreBundle.manifest.period.end,
    );
    const confirmation = await MySwal.fire({
      icon: 'warning',
      title: 'Pulihkan Data Backup?',
      text: `Ketik persis: ${phrase}`,
      input: 'text',
      inputPlaceholder: phrase,
      showCancelButton: true,
      confirmButtonText: 'Pulihkan Data',
      cancelButtonText: 'Batal',
      confirmButtonColor: '#2563eb',
      inputValidator: value => value === phrase ? undefined : 'Teks konfirmasi belum sesuai.',
    });
    if (!confirmation.isConfirmed) return;

    setRestoring(true);
    let sessionId = null;
    try {
      setRestoreProgress('Membuat sesi pemulihan aman...');
      const session = await invokeAdminArchiveFunction('admin-restore-data', {
        action: 'start',
        manifest: restoreBundle.manifest,
        selected_tables: restoreTables,
      });
      sessionId = session.session_id;

      const totalRows = sumCounts(restoreBundle.manifest.table_counts, restoreTables);
      let stagedRows = 0;
      for (const table of restoreTables) {
        const rows = restoreBundle.payload.tables[table] || [];
        for (const chunk of chunkRows(rows, 200)) {
          setRestoreProgress(
            `Menyiapkan ${stagedRows.toLocaleString('id-ID')} dari ${totalRows.toLocaleString('id-ID')} record...`
          );
          await invokeAdminArchiveFunction('admin-restore-data', {
            action: 'stage',
            session_id: sessionId,
            table,
            start_index: chunk.startIndex,
            rows: chunk.rows,
          });
          stagedRows += chunk.rows.length;
        }
      }

      setRestoreProgress('Memverifikasi checksum dan menjalankan transaksi restore...');
      const result = await invokeAdminArchiveFunction('admin-restore-data', {
        action: 'commit',
        session_id: sessionId,
      });
      sessionId = null;
      clearCachedServerRows(restoreTables);
      notifyDatabaseTablesChanged(restoreTables);
      await loadState();

      const inserted = Object.values(result.result || {}).reduce(
        (total, item) => total + (Number(item?.inserted) || 0),
        0,
      );
      const skipped = Object.values(result.result || {}).reduce(
        (total, item) => total + (Number(item?.skipped) || 0),
        0,
      );
      MySwal.fire({
        icon: 'success',
        title: 'Pemulihan Berhasil',
        text: `${inserted.toLocaleString('id-ID')} record dipulihkan dan ${skipped.toLocaleString('id-ID')} record identik dilewati.`,
        confirmButtonColor: '#2563eb',
      });
      setRestoreBundle(null);
      setRestoreTables([]);
      setRestoreFileName('');
      if (restoreInputRef.current) restoreInputRef.current.value = '';
    } catch (error) {
      if (sessionId) {
        await invokeAdminArchiveFunction('admin-restore-data', {
          action: 'abort',
          session_id: sessionId,
        }).catch(() => {});
      }
      MySwal.fire({
        icon: 'error',
        title: 'Pemulihan Dibatalkan',
        text: `${error.message} Transaksi tidak menerapkan perubahan sebagian.`,
      });
    } finally {
      setRestoring(false);
      setRestoreProgress('');
    }
  };

  const handlePurge = async (archive) => {
    if (!serverState.maintenance_mode) {
      MySwal.fire('Pemeliharaan Belum Aktif', 'Aktifkan mode pemeliharaan sebelum menghapus data.', 'warning');
      return;
    }
    if (queueCount > 0) {
      MySwal.fire('Masih Ada Draft', 'Selesaikan antrean draft pada perangkat ini sebelum penghapusan.', 'warning');
      return;
    }

    const phrase = getDeleteConfirmation(archive.period_start, archive.period_end);
    const total = sumCounts(archive.table_counts, archive.selected_tables);
    const confirmation = await MySwal.fire({
      icon: 'warning',
      title: `Hapus ${total.toLocaleString('id-ID')} Record?`,
      text: `Pastikan file ${archive.file_name} sudah disimpan. Ketik persis: ${phrase}`,
      input: 'text',
      inputPlaceholder: phrase,
      showCancelButton: true,
      confirmButtonText: 'Hapus Data yang Dicadangkan',
      cancelButtonText: 'Batal',
      confirmButtonColor: '#dc2626',
      inputValidator: value => value === phrase ? undefined : 'Teks konfirmasi belum sesuai.',
    });
    if (!confirmation.isConfirmed) return;

    setPurgingId(archive.id);
    MySwal.fire({
      title: 'Memverifikasi dan Menghapus...',
      text: 'Jika satu record berubah, seluruh penghapusan akan dibatalkan.',
      allowOutsideClick: false,
      didOpen: () => MySwal.showLoading(),
    });
    try {
      const result = await invokeAdminArchiveFunction('admin-purge-data', {
        archive_id: archive.id,
        confirmation: phrase,
      });
      clearCachedServerRows(archive.selected_tables);
      notifyDatabaseTablesChanged(archive.selected_tables);
      await loadState();
      MySwal.fire({
        icon: 'success',
        title: 'Data Arsip Berhasil Dihapus',
        text: `${Number(result.total_deleted || 0).toLocaleString('id-ID')} record dihapus. File backup tetap dapat digunakan untuk restore.`,
        confirmButtonColor: '#16a34a',
      });
    } catch (error) {
      MySwal.fire({
        icon: 'error',
        title: 'Penghapusan Dibatalkan',
        text: `${error.message} Tidak ada penghapusan sebagian yang dipertahankan.`,
      });
    } finally {
      setPurgingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {stateError && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <p className="font-bold"><i className="fas fa-exclamation-triangle mr-2" />Backend Backup & Arsip belum siap</p>
          <p className="mt-1 text-xs">{stateError}</p>
          <button
            type="button"
            onClick={loadState}
            className="mt-3 rounded-lg bg-red-600 px-3 py-2 text-xs font-bold text-white"
          >
            Coba Lagi
          </button>
        </div>
      )}

      <section className={`rounded-2xl border-2 p-5 ${
        serverState.maintenance_mode
          ? 'border-amber-300 bg-amber-50'
          : 'border-emerald-200 bg-emerald-50'
      }`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className={`w-11 h-11 rounded-xl flex items-center justify-center ${
              serverState.maintenance_mode ? 'bg-amber-200 text-amber-700' : 'bg-emerald-200 text-emerald-700'
            }`}>
              <i className={`fas ${serverState.maintenance_mode ? 'fa-tools' : 'fa-check-circle'}`} />
            </span>
            <div>
              <h2 className="font-black text-gray-800">Mode Pemeliharaan Data</h2>
              <p className="text-xs text-gray-600 mt-1 max-w-xl">
                {serverState.maintenance_mode
                  ? 'Input server dan sinkronisasi petugas sedang dihentikan sementara.'
                  : 'Input berjalan normal. Aktifkan sebelum membuat backup final, restore, atau menghapus data.'}
              </p>
              <p className={`text-xs mt-2 font-bold ${queueCount > 0 ? 'text-rose-600' : 'text-emerald-700'}`}>
                <i className="fas fa-mobile-alt mr-1.5" />
                Perangkat ini: {queueCount} draft belum tersinkronisasi
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled={savingMaintenance || loadingState || Boolean(stateError)}
            onClick={() => handleMaintenance(!serverState.maintenance_mode)}
            className={`rounded-xl px-4 py-2.5 text-xs font-black text-white disabled:opacity-50 ${
              serverState.maintenance_mode
                ? 'bg-emerald-600 hover:bg-emerald-700'
                : 'bg-amber-600 hover:bg-amber-700'
            }`}
          >
            <i className={`fas ${savingMaintenance ? 'fa-spinner fa-spin' : serverState.maintenance_mode ? 'fa-play' : 'fa-pause'} mr-2`} />
            {serverState.maintenance_mode ? 'Aktifkan Kembali Input' : 'Hentikan Input Sementara'}
          </button>
        </div>
      </section>

      <section className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
        <div className="px-5 py-4 bg-indigo-50 border-b border-indigo-100">
          <h2 className="font-black text-indigo-900"><i className="fas fa-file-archive mr-2" />Buat Backup Baru</h2>
          <p className="text-xs text-indigo-700 mt-1">Paket ZIP berisi JSON untuk restore dan Excel untuk dibaca.</p>
        </div>
        <div className="p-5 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="text-xs font-bold text-gray-700">
              Tanggal Mulai
              <input
                type="date"
                value={periodStart}
                onChange={event => { setPeriodStart(event.target.value); invalidatePreview(); }}
                className="mt-1.5 w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm"
              />
            </label>
            <label className="text-xs font-bold text-gray-700">
              Tanggal Akhir
              <input
                type="date"
                value={periodEnd}
                onChange={event => { setPeriodEnd(event.target.value); invalidatePreview(); }}
                className="mt-1.5 w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm"
              />
            </label>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-black text-gray-700">Jenis data</p>
              <div className="flex gap-2">
                <button type="button" onClick={() => { setSelectedTables(ALL_TABLE_IDS); invalidatePreview(); }} className="text-[11px] font-bold text-indigo-600">Pilih Semua</button>
                <button type="button" onClick={() => { setSelectedTables([]); invalidatePreview(); }} className="text-[11px] font-bold text-gray-500">Kosongkan</button>
              </div>
            </div>
            <TableChecklist selected={selectedTables} counts={preview?.table_counts} onToggle={toggleTable} />
          </div>

          {preview && (
            <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-bold text-blue-900">Data siap dicadangkan</p>
                <p className="text-[11px] text-blue-700">{preview.period_start} s.d. {preview.period_end}</p>
              </div>
              <strong className="text-xl text-blue-700">
                {sumCounts(preview.table_counts, selectedTables).toLocaleString('id-ID')}
                <span className="block text-[10px] font-semibold text-right">record</span>
              </strong>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              type="button"
              onClick={handlePreview}
              disabled={previewing || backingUp || Boolean(stateError)}
              className="flex-1 rounded-xl border-2 border-indigo-200 bg-white px-4 py-3 text-xs font-black text-indigo-700 hover:bg-indigo-50 disabled:opacity-50"
            >
              <i className={`fas ${previewing ? 'fa-spinner fa-spin' : 'fa-search'} mr-2`} />Periksa Data
            </button>
            <button
              type="button"
              onClick={handleCreateBackup}
              disabled={backingUp || previewing || !serverState.maintenance_mode || Boolean(stateError)}
              className="flex-1 rounded-xl bg-indigo-600 px-4 py-3 text-xs font-black text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              <i className={`fas ${backingUp ? 'fa-spinner fa-spin' : 'fa-download'} mr-2`} />Buat & Unduh Backup
            </button>
          </div>
        </div>
      </section>

      <section className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
        <div className="px-5 py-4 bg-blue-50 border-b border-blue-100">
          <h2 className="font-black text-blue-900"><i className="fas fa-undo-alt mr-2" />Pulihkan Data</h2>
          <p className="text-xs text-blue-700 mt-1">Data identik dilewati; konflik ID membatalkan seluruh transaksi.</p>
        </div>
        <div className="p-5 space-y-4">
          <label className="block rounded-xl border-2 border-dashed border-blue-200 bg-blue-50/50 p-5 text-center cursor-pointer hover:border-blue-400">
            <i className="fas fa-file-upload text-2xl text-blue-500" />
            <span className="block mt-2 text-xs font-black text-blue-800">
              {restoreFileName || 'Pilih paket backup ZIP/JSON'}
            </span>
            <input
              ref={restoreInputRef}
              type="file"
              accept=".zip,.json,application/zip,application/json"
              onChange={handleBackupFile}
              disabled={restoring}
              className="hidden"
            />
          </label>

          {restoreProgress && (
            <p className="rounded-lg bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700">
              <i className="fas fa-spinner fa-spin mr-2" />{restoreProgress}
            </p>
          )}

          {restoreBundle && (
            <>
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                <p className="text-xs font-black text-emerald-800"><i className="fas fa-shield-alt mr-2" />Checksum file valid</p>
                <p className="text-[11px] text-emerald-700 mt-1">
                  Periode {restoreBundle.manifest.period.start} s.d. {restoreBundle.manifest.period.end} · {restoreBundle.totalRows.toLocaleString('id-ID')} record
                </p>
              </div>
              <TableChecklist
                selected={restoreTables}
                counts={restoreBundle.manifest.table_counts}
                onToggle={toggleRestoreTable}
                disabled={restoring}
                available={restoreBundle.manifest.selected_tables}
              />
              <button
                type="button"
                onClick={handleRestore}
                disabled={restoring || !serverState.maintenance_mode || restoreTables.length === 0}
                className="w-full rounded-xl bg-blue-600 px-4 py-3 text-xs font-black text-white hover:bg-blue-700 disabled:opacity-50"
              >
                <i className={`fas ${restoring ? 'fa-spinner fa-spin' : 'fa-history'} mr-2`} />
                Pulihkan {sumCounts(restoreBundle.manifest.table_counts, restoreTables).toLocaleString('id-ID')} Record
              </button>
            </>
          )}
        </div>
      </section>

      <section className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
        <div className="px-5 py-4 bg-slate-50 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="font-black text-gray-800"><i className="fas fa-history mr-2" />Riwayat Backup</h2>
            <p className="text-xs text-gray-500 mt-1">Penghapusan hanya tersedia untuk backup terverifikasi.</p>
          </div>
          <button type="button" onClick={loadState} disabled={loadingState} className="text-xs font-bold text-indigo-600 disabled:opacity-50">
            <i className={`fas fa-sync-alt mr-1.5 ${loadingState ? 'fa-spin' : ''}`} />Muat Ulang
          </button>
        </div>
        <div className="p-5 space-y-3">
          {!loadingState && serverState.archives.length === 0 && (
            <p className="py-8 text-center text-sm text-gray-400">Belum ada riwayat backup.</p>
          )}
          {serverState.archives.map(archive => {
            const status = archiveStatusMeta(archive.status);
            const total = sumCounts(archive.table_counts, archive.selected_tables);
            return (
              <article key={archive.id} className="rounded-xl border border-gray-200 p-4">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-black text-sm text-gray-800 break-all">{archive.file_name}</p>
                      <span className={`rounded-full px-2 py-1 text-[10px] font-black ${status.className}`}>{status.label}</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      {archive.period_start} s.d. {archive.period_end} · {total.toLocaleString('id-ID')} record · {formatArchiveBytes(archive.file_size_bytes)}
                    </p>
                    <p className="text-[11px] text-gray-400 mt-1">Dibuat {formatDateTime(archive.created_at)}</p>
                    {archive.last_error && <p className="text-[11px] text-rose-600 mt-1">{archive.last_error}</p>}
                  </div>
                  {archive.status === 'verified' && (
                    <button
                      type="button"
                      onClick={() => handlePurge(archive)}
                      disabled={purgingId === archive.id || !serverState.maintenance_mode || queueCount > 0}
                      className="shrink-0 rounded-lg bg-rose-600 px-3 py-2 text-[11px] font-black text-white hover:bg-rose-700 disabled:opacity-40"
                    >
                      <i className={`fas ${purgingId === archive.id ? 'fa-spinner fa-spin' : 'fa-trash-alt'} mr-1.5`} />
                      Hapus Data Backup Ini
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <details className="bg-white rounded-2xl shadow border border-gray-100 overflow-hidden">
        <summary className="cursor-pointer px-5 py-4 text-sm font-black text-gray-700 bg-gray-50">
          <i className="fas fa-clipboard-list mr-2" />Audit Aktivitas Terbaru
        </summary>
        <div className="divide-y divide-gray-100">
          {serverState.audit_logs.length === 0 && <p className="p-5 text-xs text-gray-400">Belum ada audit aktivitas.</p>}
          {serverState.audit_logs.slice(0, 15).map(log => (
            <div key={log.id} className="px-5 py-3 flex items-center justify-between gap-3 text-xs">
              <span className="font-semibold text-gray-700">{getAuditLabel(log.action)}</span>
              <time className="text-gray-400 whitespace-nowrap">{formatDateTime(log.created_at)}</time>
            </div>
          ))}
        </div>
      </details>

      <p className="text-[11px] text-gray-500 px-1 leading-relaxed">
        <i className="fas fa-shield-alt mr-1.5 text-indigo-500" />
        Akun, profil, master ruangan, dan pengaturan aplikasi tidak termasuk penghapusan. Jangan nonaktifkan pemeliharaan sebelum proses yang sedang berjalan selesai.
      </p>
    </div>
  );
}
