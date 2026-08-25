import { useCallback, useEffect, useRef, useState } from 'react';
import AppLayout from '../components/AppLayout';
import { supabase } from '../lib/supabase';
import Swal from 'sweetalert2';
import withReactContent from 'sweetalert2-react-content';
import { getCurrentUser } from '../lib/api';
import {
    cacheServerRows,
    getCachedServerRows,
    getOfflineDeletedIds,
    getOfflineQueue,
    getSyncedServerId,
    getUnsyncedItemsForTable,
    removeCachedServerRow,
    removeLocalRecordQueue,
    saveToOfflineQueue,
    syncOfflineQueue,
} from '../lib/offlineStorage';
import { loadExcelLibrary } from '../lib/excelLoader';
import { getLocalDateString, getLocalMonthString } from '../lib/localDate';
import { fetchAllSupabaseRows } from '../lib/supabasePagination';
import { isNetworkError } from '../lib/networkErrors';
import {
    deleteRecordWithVersion,
    getRecordBaseVersion,
    isRecordConflictError,
    resolveOfflineRecordConflict,
    updateRecordWithVersion,
} from '../lib/recordVersion';
import PengangkutanForm from '../components/limbah/pengangkutan/PengangkutanForm';
import PengangkutanImportExportToolbar from '../components/limbah/pengangkutan/PengangkutanImportExportToolbar';
import PengangkutanTable from '../components/limbah/pengangkutan/PengangkutanTable';

const MySwal = withReactContent(Swal);
const ITEMS_PER_PAGE = 10;
const FETCH_BATCH_SIZE = 500;

const createEmptyForm = () => ({
    id: null,
    tanggal: getLocalDateString(),
    jumlah_kg: '',
    keterangan: '',
});

const comparePengangkutanRows = (a, b) => {
    const dateComparison = String(b?.tanggal || '').localeCompare(String(a?.tanggal || ''));
    if (dateComparison) return dateComparison;
    return String(b?.waktu_input || '').localeCompare(String(a?.waktu_input || ''));
};

export default function PengangkutanLimbah() {
    const user = getCurrentUser();
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [page, setPage] = useState(1);
    const [totalData, setTotalData] = useState(0);
    const [offlineQueueCount, setOfflineQueueCount] = useState(0);
    const [filterMonth, setFilterMonth] = useState('');
    const importRef = useRef(null);
    const fetchIdRef = useRef(0);
    const emptyForm = createEmptyForm();
    const [form, setForm] = useState(createEmptyForm);

    const fetchData = useCallback(async () => {
        const currentFetchId = ++fetchIdRef.current;
        setLoading(true);
        try {
            let dbData = [];
            let count = 0;
            setOfflineQueueCount(
                getOfflineQueue().filter(item => item.table === 'pengangkutan_limbah').length
            );

            const allUnsynced = getUnsyncedItemsForTable('pengangkutan_limbah');
            let unsynced = allUnsynced;
            if (filterMonth) {
                unsynced = unsynced.filter(item => item.tanggal?.startsWith(filterMonth));
            }

            const deletedIds = new Set(getOfflineDeletedIds('pengangkutan_limbah'));
            const hiddenServerIds = new Set([
                ...allUnsynced
                    .filter(item => item.offlineAction === 'update')
                    .map(item => String(item.id)),
                ...deletedIds,
            ]);
            const excludedIds = hiddenServerIds.size > 0
                ? `(${Array.from(hiddenServerIds).join(',')})`
                : null;

            let dbFetchSucceeded = false;
            let dbStartIndex = 0;
            try {
                if (!navigator.onLine) throw new Error('Perangkat sedang offline.');

                let queryCount = supabase
                    .from('pengangkutan_limbah')
                    .select('id', { count: 'exact', head: true });

                if (filterMonth) {
                    const [year, month] = filterMonth.split('-');
                    const startOfMonth = `${year}-${month}-01`;
                    const lastDay = new Date(year, month, 0).getDate();
                    const endOfMonth = `${year}-${month}-${String(lastDay).padStart(2, '0')}`;
                    queryCount = queryCount.gte('tanggal', startOfMonth).lte('tanggal', endOfMonth);
                }
                if (excludedIds) queryCount = queryCount.not('id', 'in', excludedIds);

                const { count: c, error: countError } = await queryCount;
                if (countError) throw countError;
                count = c || 0;

                const pageStartIndex = (page - 1) * ITEMS_PER_PAGE;
                dbStartIndex = Math.max(0, pageStartIndex - unsynced.length);
                const dbEndIndex = pageStartIndex + ITEMS_PER_PAGE - 1;

                for (let from = dbStartIndex; from <= dbEndIndex; from += FETCH_BATCH_SIZE) {
                    const to = Math.min(from + FETCH_BATCH_SIZE - 1, dbEndIndex);
                    let queryData = supabase
                        .from('pengangkutan_limbah')
                        .select('id, tanggal, jumlah_kg, keterangan, petugas, waktu_input')
                        .order('tanggal', { ascending: false })
                        .order('waktu_input', { ascending: false })
                        .range(from, to);

                    if (filterMonth) {
                        const [year, month] = filterMonth.split('-');
                        const startOfMonth = `${year}-${month}-01`;
                        const lastDay = new Date(year, month, 0).getDate();
                        const endOfMonth = `${year}-${month}-${String(lastDay).padStart(2, '0')}`;
                        queryData = queryData.gte('tanggal', startOfMonth).lte('tanggal', endOfMonth);
                    }
                    if (excludedIds) queryData = queryData.not('id', 'in', excludedIds);

                    const { data: result, error } = await queryData;
                    if (error) throw error;
                    const batch = result || [];
                    dbData.push(...batch);
                    if (batch.length < to - from + 1) break;
                }

                cacheServerRows('pengangkutan_limbah', dbData);
                dbFetchSucceeded = true;
            } catch (e) {
                console.warn('Handling offline DB error in PengangkutanLimbah:', e);
                dbData = getCachedServerRows('pengangkutan_limbah').filter(item => {
                    if (hiddenServerIds.has(String(item.id))) return false;
                    return !filterMonth || item.tanggal?.startsWith(filterMonth);
                });
                count = dbData.length;
            }

            if (currentFetchId !== fetchIdRef.current) return;

            const mergedData = [
                ...unsynced,
                ...dbData.filter(item => !hiddenServerIds.has(String(item.id))),
            ].sort(comparePengangkutanRows);
            const adjustedTotal = Math.max(0, count + unsynced.length);
            setTotalData(adjustedTotal);

            const lastAvailablePage = Math.max(1, Math.ceil(adjustedTotal / ITEMS_PER_PAGE));
            if (page > lastAvailablePage) {
                setPage(lastAvailablePage);
                return;
            }

            const fromIndex = (page - 1) * ITEMS_PER_PAGE;
            const localStartIndex = dbFetchSucceeded ? fromIndex - dbStartIndex : fromIndex;
            setData(mergedData.slice(localStartIndex, localStartIndex + ITEMS_PER_PAGE));
        } catch (e) {
            console.error('Gagal mengambil data pengangkutan:', e);
        } finally {
            if (currentFetchId === fetchIdRef.current) setLoading(false);
        }
    }, [filterMonth, page]);

    useEffect(() => {
        fetchData();

        let queueRefreshTimer;
        const handleQueueChange = (event) => {
            if (event.type === 'offline-queue-changed' && event.changedTables?.length &&
                !event.changedTables.includes('pengangkutan_limbah')) return;
            window.clearTimeout(queueRefreshTimer);
            queueRefreshTimer = window.setTimeout(fetchData, 180);
        };
        const handleVisibility = () => {
            if (document.visibilityState === 'visible') fetchData();
        };
        window.addEventListener('offline-queue-changed', handleQueueChange);
        window.addEventListener('online', handleQueueChange);
        window.addEventListener('offline', handleQueueChange);
        document.addEventListener('visibilitychange', handleVisibility);

        return () => {
            window.clearTimeout(queueRefreshTimer);
            window.removeEventListener('offline-queue-changed', handleQueueChange);
            window.removeEventListener('online', handleQueueChange);
            window.removeEventListener('offline', handleQueueChange);
            document.removeEventListener('visibilitychange', handleVisibility);
        };
    }, [fetchData]);

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
                const { data: insertedRow, error } = await supabase
                    .from('pengangkutan_limbah')
                    .insert([payload])
                    .select()
                    .single();
                if (error) throw error;
                if (insertedRow?.id) cacheServerRows('pengangkutan_limbah', [insertedRow]);
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
    const handleExport = async () => {
        const { value: month } = await MySwal.fire({
            title: 'Pilih Bulan',
            html: `<input id="m" type="month" class="swal2-input" value="${getLocalMonthString()}">`,
            focusConfirm: false,
            showCancelButton: true,
            confirmButtonText: 'Export',
            preConfirm: () => document.getElementById('m').value
        });
        if (!month) return;

        const [y, mo] = month.split('-');
        MySwal.fire({ title: 'Mengambil data...', allowOutsideClick: false, didOpen: () => MySwal.showLoading() });

        const start = `${y}-${mo}-01`;
        const lastDay = new Date(y, mo, 0).getDate();
        const end = `${y}-${mo}-${String(lastDay).padStart(2, '0')}`;
        let rows;
        try {
            rows = await fetchAllSupabaseRows(() => supabase
                .from('pengangkutan_limbah')
                .select('tanggal, jumlah_kg, keterangan, petugas')
                .gte('tanggal', start)
                .lte('tanggal', end)
                .order('tanggal', { ascending: true })
                .order('id', { ascending: true }));
        } catch (error) {
            MySwal.fire('Gagal', error.message || 'Data pengangkutan tidak dapat dimuat.', 'error');
            return;
        }

        if (!rows.length) {
            MySwal.fire('Info', 'Tidak ada data bulan ini.', 'info'); return;
        }

        const monthNames = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
        const label = `${monthNames[parseInt(mo) - 1]} ${y}`;
        let total = 0;

        const wsData = [
            ['LAPORAN PENGANGKUTAN LIMBAH MEDIS PADAT'],
            [`Periode: ${label}`], [],
            ['No.', 'Tanggal', 'Jumlah Diangkut (Kg)', 'Keterangan', 'Petugas'],
            ...rows.map((r, i) => {
                total += parseFloat(r.jumlah_kg) || 0;
                return [i + 1, new Date(r.tanggal).toLocaleDateString('id-ID'), parseFloat(r.jumlah_kg) || 0, r.keterangan || '', r.petugas];
            }),
            ['', 'TOTAL', total, '', '']
        ];

        const XLSX = await loadExcelLibrary();
        const ws = XLSX.utils.aoa_to_sheet(wsData);
        ws['!cols'] = [{ wch: 5 }, { wch: 14 }, { wch: 22 }, { wch: 30 }, { wch: 18 }];
        ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 4 } }, { s: { r: 1, c: 0 }, e: { r: 1, c: 4 } }];

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, `Pengangkutan ${label}`);
        XLSX.writeFile(wb, `Pengangkutan_Limbah_${label.replace(' ', '_')}.xlsx`);
        MySwal.fire({ icon: 'success', title: 'Export Berhasil!', timer: 1800, showConfirmButton: false });
    };

    // ── Import Excel ──
    const handleImportFile = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        e.target.value = '';
        const reader = new FileReader();
        reader.onload = async (evt) => {
            try {
                const XLSX = await loadExcelLibrary();
                const wb = XLSX.read(evt.target.result, { type: 'binary', cellDates: false });
                const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: '' });

                let hIdx = rows.findIndex(r => r.join('').toLowerCase().includes('tanggal'));
                if (hIdx === -1) { MySwal.fire('Format Salah', 'Header Tanggal tidak ditemukan.', 'error'); return; }

                const dataRows = rows.slice(hIdx + 1).filter(r => r[1] && !String(r[1]).toLowerCase().includes('total'));
                if (!dataRows.length) { MySwal.fire('Kosong', 'Tidak ada data ditemukan.', 'warning'); return; }

                const { isConfirmed } = await MySwal.fire({
                    title: 'Konfirmasi Import',
                    html: `<p>Ditemukan <strong>${dataRows.length} baris</strong> data. Lanjutkan import?</p>`,
                    icon: 'question', showCancelButton: true, confirmButtonText: 'Ya, Import!'
                });
                if (!isConfirmed) return;

                const parseDate = (val) => {
                    if (!val) return '';
                    if (typeof val === 'number') {
                        const date = XLSX.SSF.parse_date_code(val);
                        if (date) {
                            return `${date.y}-${String(date.m).padStart(2, '0')}-${String(date.d).padStart(2, '0')}`;
                        }
                    }
                    const str = String(val).trim();
                    const matchId = str.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
                    if (matchId) {
                        const [, day, month, year] = matchId;
                        return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
                    }
                    const matchIso = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
                    if (matchIso) {
                        const [, year, month, day] = matchIso;
                        return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
                    }
                    return '';
                };

                const payloads = dataRows.map(r => ({
                    tanggal: parseDate(r[1]),
                    jumlah_kg: parseFloat(r[2]) || 0,
                    keterangan: r[3] || '',
                    petugas: user?.nama || 'Petugas',
                    waktu_input: new Date().toISOString()
                })).filter(p => p.tanggal);

                for (let i = 0; i < payloads.length; i += 50) {
                    const { error } = await supabase.from('pengangkutan_limbah').insert(payloads.slice(i, i + 50));
                    if (error) throw error;
                }

                fetchData();
                MySwal.fire({ icon: 'success', title: `${payloads.length} data berhasil diimport!`, timer: 2000, showConfirmButton: false });
            } catch (err) {
                MySwal.fire('Gagal Import', err.message, 'error');
            }
        };
        reader.readAsBinaryString(file);
    };

    const handleDownloadTemplate = async () => {
        const XLSX = await loadExcelLibrary();
        const ws = XLSX.utils.aoa_to_sheet([
            ['No.', 'Tanggal', 'Jumlah Diangkut (Kg)', 'Keterangan'],
            ['', 'Format: YYYY-MM-DD, contoh: 2025-01-15', '', ''],
            [1, '2025-01-10', 25.5, 'Pengangkutan rutin'],
            [2, '2025-01-20', 30.0, 'Pengangkutan tambahan'],
        ]);
        ws['!cols'] = [{ wch: 5 }, { wch: 20 }, { wch: 22 }, { wch: 30 }];
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Template');
        XLSX.writeFile(wb, 'Template_Pengangkutan_Limbah.xlsx');
    };

    const totalPages = Math.ceil(totalData / ITEMS_PER_PAGE);

    return (
        <AppLayout title="Pengangkutan Limbah Padat">
            <div className="container mx-auto px-4 py-8 max-w-5xl">
                <PengangkutanForm
                    form={form}
                    handleChange={handleChange}
                    handleSubmit={handleSubmit}
                    submitting={submitting}
                    emptyForm={emptyForm}
                    setForm={setForm}
                />

                <PengangkutanImportExportToolbar
                    handleDownloadTemplate={handleDownloadTemplate}
                    handleImportFile={handleImportFile}
                    handleExport={handleExport}
                    importRef={importRef}
                />

                <PengangkutanTable
                    data={data}
                    loading={loading}
                    totalData={totalData}
                    filterMonth={filterMonth}
                    setFilterMonth={setFilterMonth}
                    page={page}
                    setPage={setPage}
                    itemsPerPage={ITEMS_PER_PAGE}
                    totalPages={totalPages}
                    totalOfflineCount={offlineQueueCount}
                    handleEdit={handleEdit}
                    handleDelete={handleDelete}
                    syncOfflineQueue={syncOfflineQueue}
                />
            </div>
        </AppLayout>
    );
}
