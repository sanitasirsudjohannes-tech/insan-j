import { useState, useEffect, useRef } from 'react';
import AppLayout from '../components/AppLayout';
import { supabase } from '../lib/supabase';
import Swal from 'sweetalert2';
import withReactContent from 'sweetalert2-react-content';
import { getCurrentUser } from '../lib/api';
import { saveToOfflineQueue, getUnsyncedItemsForTable, syncOfflineQueue } from '../lib/offlineStorage';
import * as XLSX from 'xlsx';
import PengangkutanForm from '../components/limbah/pengangkutan/PengangkutanForm';
import PengangkutanImportExportToolbar from '../components/limbah/pengangkutan/PengangkutanImportExportToolbar';
import PengangkutanTable from '../components/limbah/pengangkutan/PengangkutanTable';

const MySwal = withReactContent(Swal);

export default function PengangkutanLimbah() {
    const user = getCurrentUser();
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [page, setPage] = useState(1);
    const [totalData, setTotalData] = useState(0);
    const [filterMonth, setFilterMonth] = useState('');
    const itemsPerPage = 10;
    const importRef = useRef(null);

    const emptyForm = {
        id: null,
        tanggal: new Date().toISOString().split('T')[0],
        jumlah_kg: '',
        keterangan: ''
    };
    const [form, setForm] = useState(emptyForm);

    const fetchData = async () => {
        setLoading(true);
        try {
            let rows = [];
            let count = 0;

            try {
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

                const { count: c } = await queryCount;
                count = c || 0;

                const from = (page - 1) * itemsPerPage;
                let queryData = supabase
                    .from('pengangkutan_limbah')
                    .select('id, tanggal, jumlah_kg, keterangan, petugas')
                    .order('tanggal', { ascending: false })
                    .range(from, from + itemsPerPage - 1);

                if (filterMonth) {
                    const [year, month] = filterMonth.split('-');
                    const startOfMonth = `${year}-${month}-01`;
                    const lastDay = new Date(year, month, 0).getDate();
                    const endOfMonth = `${year}-${month}-${String(lastDay).padStart(2, '0')}`;
                    queryData = queryData.gte('tanggal', startOfMonth).lte('tanggal', endOfMonth);
                }

                const { data: result, error } = await queryData;
                if (!error) rows = result || [];
            } catch (e) {
                console.warn('Handling offline DB error in PengangkutanLimbah:', e);
            }

            let unsynced = getUnsyncedItemsForTable('pengangkutan_limbah');

            if (filterMonth) {
                unsynced = unsynced.filter(item => item.tanggal && item.tanggal.startsWith(filterMonth));
            }

            const unsyncedIds = new Set(unsynced.map(u => u.id));
            const filteredDbData = rows.filter(d => !unsyncedIds.has(d.id));

            const combined = [...unsynced, ...filteredDbData];
            setData(combined);
            setTotalData((count || 0) + unsynced.length);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();

        const handleQueueChange = () => fetchData();
        window.addEventListener('offline-queue-changed', handleQueueChange);
        window.addEventListener('online', handleQueueChange);
        window.addEventListener('offline', handleQueueChange);

        return () => {
            window.removeEventListener('offline-queue-changed', handleQueueChange);
            window.removeEventListener('online', handleQueueChange);
            window.removeEventListener('offline', handleQueueChange);
        };
    }, [page, filterMonth]);

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

        try {
            if (!navigator.onLine) {
                saveToOfflineQueue('pengangkutan_limbah', form.id ? 'update' : 'insert', form.id ? { ...payload, id: form.id } : payload, 'Pengangkutan Limbah');
                MySwal.fire({
                    icon: 'info',
                    title: 'Tersimpan Offline',
                    text: 'Data telah disimpan di HP (Draft). Akan otomatis dikirim saat terhubung internet.',
                    confirmButtonColor: '#ea580c'
                });
            } else {
                if (form.id) {
                    const { error } = await supabase.from('pengangkutan_limbah').update(payload).eq('id', form.id);
                    if (error) throw error;
                    MySwal.fire('Berhasil', 'Data diperbarui', 'success');
                } else {
                    const { error } = await supabase.from('pengangkutan_limbah').insert([payload]);
                    if (error) throw error;
                    MySwal.fire('Berhasil', 'Data pengangkutan ditambahkan', 'success');
                }
            }
            setForm(emptyForm);
            fetchData();
        } catch (e) {
            if (!navigator.onLine || e.message?.includes('Failed to fetch') || e.message?.includes('network')) {
                saveToOfflineQueue('pengangkutan_limbah', form.id ? 'update' : 'insert', form.id ? { ...payload, id: form.id } : payload, 'Pengangkutan Limbah');
                MySwal.fire({
                    icon: 'info',
                    title: 'Tersimpan Offline',
                    text: 'Jaringan terputus. Data telah disimpan di HP (Draft) dan akan dikirim otomatis.',
                    confirmButtonColor: '#ea580c'
                });
                setForm(emptyForm);
            } else {
                MySwal.fire('Gagal', e.message, 'error');
            }
        } finally {
            setSubmitting(false);
        }
    };

    const handleEdit = (item) => {
        setForm({ id: item.id, tanggal: item.tanggal, jumlah_kg: item.jumlah_kg, keterangan: item.keterangan || '' });
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleDelete = async (id) => {
        const { isConfirmed } = await MySwal.fire({
            title: 'Hapus Data?', text: 'Data tidak dapat dikembalikan!', icon: 'warning',
            showCancelButton: true, confirmButtonColor: '#d33', confirmButtonText: 'Ya, Hapus!'
        });
        if (!isConfirmed) return;
        try {
            const { error } = await supabase.from('pengangkutan_limbah').delete().eq('id', id);
            if (error) throw error;
            MySwal.fire('Terhapus!', 'Data berhasil dihapus', 'success');
            fetchData();
        } catch (e) {
            MySwal.fire('Gagal', e.message, 'error');
        }
    };

    // ── Export Excel ──
    const handleExport = async () => {
        const { value: month } = await MySwal.fire({
            title: 'Pilih Bulan',
            html: `<input id="m" type="month" class="swal2-input" value="${new Date().toISOString().slice(0, 7)}">`,
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
        const { data: rows, error } = await supabase
            .from('pengangkutan_limbah')
            .select('tanggal, jumlah_kg, keterangan, petugas').gte('tanggal', start).lte('tanggal', end).order('tanggal', { ascending: true });

        if (error || !rows?.length) {
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
                    const matchId = str.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})$/);
                    if (matchId) {
                        const [, day, month, year] = matchId;
                        return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
                    }
                    const matchIso = str.match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})$/);
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

    const handleDownloadTemplate = () => {
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

    const totalPages = Math.ceil(totalData / itemsPerPage);

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
                    itemsPerPage={itemsPerPage}
                    totalPages={totalPages}
                    handleEdit={handleEdit}
                    handleDelete={handleDelete}
                    syncOfflineQueue={syncOfflineQueue}
                />
            </div>
        </AppLayout>
    );
}