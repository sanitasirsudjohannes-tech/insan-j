import { useState, useEffect, useRef } from 'react';
import AppLayout from '../components/AppLayout';
import { supabase } from '../lib/supabase';
import Swal from 'sweetalert2';
import withReactContent from 'sweetalert2-react-content';
import { getCurrentUser } from '../lib/api';
import * as XLSX from 'xlsx';

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

            const { count } = await queryCount;
            setTotalData(count || 0);

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

            const { data: rows, error } = await queryData;

            if (error) throw error;
            setData(rows || []);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchData(); }, [page, filterMonth]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setForm(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            const payload = {
                tanggal: form.tanggal,
                jumlah_kg: parseFloat(form.jumlah_kg) || 0,
                keterangan: form.keterangan || '',
                petugas: user?.nama || 'Petugas',
                waktu_input: new Date().toISOString()
            };
            if (form.id) {
                const { error } = await supabase.from('pengangkutan_limbah').update(payload).eq('id', form.id);
                if (error) throw error;
                MySwal.fire('Berhasil', 'Data diperbarui', 'success');
            } else {
                const { error } = await supabase.from('pengangkutan_limbah').insert([payload]);
                if (error) throw error;
                MySwal.fire('Berhasil', 'Data pengangkutan ditambahkan', 'success');
            }
            setForm(emptyForm);
            fetchData();
        } catch (e) {
            MySwal.fire('Gagal', e.message, 'error');
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

                {/* ── Form ── */}
                <div className="bg-white rounded-xl shadow-lg mb-6 overflow-hidden">
                    <div className="bg-orange-600 text-white px-6 py-4 flex items-center gap-3">
                        <i className="fas fa-truck text-xl"></i>
                        <h2 className="text-lg font-bold">Form Input Pengangkutan Limbah</h2>
                    </div>
                    <form onSubmit={handleSubmit} className="p-6">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                            <div>
                                <label className="block text-gray-700 font-medium mb-1">Tanggal Pengangkutan</label>
                                <input type="date" name="tanggal" value={form.tanggal} onChange={handleChange} required
                                    className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-orange-400 outline-none" />
                            </div>
                            <div>
                                <label className="block text-gray-700 font-medium mb-1">Jumlah Diangkut (Kg)</label>
                                <input type="number" step="0.01" min="0" name="jumlah_kg" value={form.jumlah_kg} onChange={handleChange} required
                                    placeholder="0.00"
                                    className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-orange-400 outline-none" />
                            </div>
                            <div>
                                <label className="block text-gray-700 font-medium mb-1">Keterangan</label>
                                <input type="text" name="keterangan" value={form.keterangan} onChange={handleChange}
                                    placeholder="Pengangkutan rutin, dll."
                                    className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-orange-400 outline-none" />
                            </div>
                        </div>
                        <div className="flex justify-end gap-3">
                            {form.id && (
                                <button type="button" onClick={() => setForm(emptyForm)}
                                    className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-lg transition">
                                    Batal Edit
                                </button>
                            )}
                            <button type="submit" disabled={submitting}
                                className="bg-orange-600 hover:bg-orange-700 text-white px-6 py-2 rounded-lg font-medium transition disabled:opacity-50 flex items-center gap-2">
                                {submitting ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-save"></i>}
                                {form.id ? 'Update Data' : 'Simpan Data'}
                            </button>
                        </div>
                    </form>
                </div>

                {/* ── Import/Export Toolbar ── */}
                <div className="bg-white rounded-xl shadow-lg mb-6 overflow-hidden">
                    <div className="bg-teal-700 text-white px-6 py-4">
                        <h2 className="text-lg font-bold"><i className="fas fa-file-excel mr-2"></i>Import / Export Excel</h2>
                    </div>
                    <div className="p-5 flex flex-wrap gap-3 items-center">
                        <button onClick={handleDownloadTemplate}
                            className="flex items-center gap-2 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 px-4 py-2.5 rounded-lg font-semibold text-sm transition">
                            <i className="fas fa-download"></i> Download Template
                        </button>
                        <div>
                            <input ref={importRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleImportFile} />
                            <button onClick={() => importRef.current?.click()}
                                className="flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white px-4 py-2.5 rounded-lg font-semibold text-sm transition">
                                <i className="fas fa-upload"></i> Import Excel
                            </button>
                        </div>
                        <button onClick={handleExport}
                            className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2.5 rounded-lg font-semibold text-sm transition">
                            <i className="fas fa-file-excel"></i> Export Excel
                        </button>
                        <p className="text-xs text-gray-500 flex-1 min-w-[200px]">
                            <i className="fas fa-info-circle text-teal-400 mr-1"></i>
                            Format kolom: Tanggal, Jumlah Diangkut (Kg), Keterangan
                        </p>
                    </div>
                </div>

                {/* ── Tabel ── */}
                <div className="bg-white rounded-xl shadow-lg overflow-hidden">
                    <div className="bg-gray-800 text-white px-6 py-4 flex flex-col md:flex-row justify-between items-center gap-4">
                        <h2 className="text-lg font-bold">
                            <i className="fas fa-table mr-2"></i> Riwayat Pengangkutan
                            <span className="ml-2 text-sm font-normal text-gray-400">({totalData} data)</span>
                        </h2>
                        <div className="flex items-center">
                            <input
                                type="month"
                                value={filterMonth}
                                onChange={(e) => {
                                    setFilterMonth(e.target.value);
                                    setPage(1);
                                }}
                                className="bg-white text-gray-800 px-3 py-1.5 rounded-lg text-sm border focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                        </div>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-gray-50 text-gray-600 text-sm border-b">
                                    <th className="px-4 py-3">No.</th>
                                    <th className="px-4 py-3">Tanggal</th>
                                    <th className="px-4 py-3 text-right">Jumlah Diangkut (Kg)</th>
                                    <th className="px-4 py-3">Keterangan</th>
                                    <th className="px-4 py-3">Petugas</th>
                                    <th className="px-4 py-3 text-center">Aksi</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr><td colSpan="6" className="text-center py-10">
                                        <i className="fas fa-spinner fa-spin text-orange-500 text-2xl"></i>
                                    </td></tr>
                                ) : data.length === 0 ? (
                                    <tr><td colSpan="6" className="text-center py-10 text-gray-400">
                                        <i className="fas fa-truck text-4xl block mb-2 opacity-30"></i>
                                        Belum ada data pengangkutan.
                                    </td></tr>
                                ) : data.map((item, idx) => (
                                    <tr key={item.id} className="border-b hover:bg-orange-50 transition-colors">
                                        <td className="px-4 py-3 text-gray-500 text-sm">{(page - 1) * itemsPerPage + idx + 1}</td>
                                        <td className="px-4 py-3 font-medium text-gray-800">
                                            {new Date(item.tanggal).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <span className="font-bold text-orange-600">{parseFloat(item.jumlah_kg || 0).toFixed(2)} Kg</span>
                                        </td>
                                        <td className="px-4 py-3 text-gray-600 text-sm">{item.keterangan || '-'}</td>
                                        <td className="px-4 py-3 text-gray-600 text-sm">{item.petugas}</td>
                                        <td className="px-4 py-3 text-center">
                                            <button onClick={() => handleEdit(item)}
                                                className="bg-blue-100 text-blue-600 hover:bg-blue-200 px-2 py-1 rounded mx-1 transition">
                                                <i className="fas fa-edit"></i>
                                            </button>
                                            <button onClick={() => handleDelete(item.id)}
                                                className="bg-red-100 text-red-600 hover:bg-red-200 px-2 py-1 rounded mx-1 transition">
                                                <i className="fas fa-trash"></i>
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    {totalPages > 0 && (
                        <div className="flex justify-between items-center px-6 py-4 bg-gray-50 border-t text-sm">
                            <div className="flex items-center space-x-2 text-gray-600">
                                <span>Hal.</span>
                                <input
                                    type="number"
                                    min="1"
                                    max={totalPages}
                                    value={page}
                                    onChange={(e) => {
                                        let val = parseInt(e.target.value);
                                        if (isNaN(val) || val < 1) val = 1;
                                        if (val > totalPages) val = totalPages;
                                        setPage(val);
                                    }}
                                    className="w-16 px-2 py-1 border rounded text-center outline-none focus:ring-2 focus:ring-blue-500"
                                />
                                <span>/ {totalPages}</span>
                            </div>
                            <div className="flex gap-2">
                                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                                    className="px-3 py-1 bg-white border rounded hover:bg-gray-100 disabled:opacity-50">Sebelumnya</button>
                                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                                    className="px-3 py-1 bg-white border rounded hover:bg-gray-100 disabled:opacity-50">Selanjutnya</button>
                            </div>
                        </div>
                    )}
                </div>

            </div>
        </AppLayout>
    );
}