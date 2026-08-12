import { useState, useEffect } from 'react';
import AppLayout from '../components/AppLayout';
import { supabase } from '../lib/supabase';
import Swal from 'sweetalert2';
import withReactContent from 'sweetalert2-react-content';
import { getCurrentUser, fetchDaftarRuangan } from '../lib/api';
import { saveToOfflineQueue, getUnsyncedItemsForTable, syncOfflineQueue, removeOfflineQueueItem } from '../lib/offlineStorage';
import SearchableBottomSheet from '../components/SearchableBottomSheet';

const MySwal = withReactContent(Swal);

function EmbeddedWrapper({ children }) {
    return <div className="bg-gray-100 min-h-screen">{children}</div>;
}
function FullWrapper({ children }) {
    return <AppLayout title="Limbah Anorganik">{children}</AppLayout>;
}

const JENIS_FIELDS = [
    { name: 'infus', label: 'Infus', color: 'text-blue-600', ring: 'focus:ring-blue-400' },
    { name: 'jerigen', label: 'Jerigen', color: 'text-amber-600', ring: 'focus:ring-amber-400' },
    { name: 'kertas', label: 'Kertas', color: 'text-slate-600', ring: 'focus:ring-slate-400' },
    { name: 'kardus', label: 'Kardus', color: 'text-orange-700', ring: 'focus:ring-orange-400' },
    { name: 'botol_mineral', label: 'Botol Mineral', color: 'text-cyan-600', ring: 'focus:ring-cyan-400' },
    { name: 'bayclin_dll', label: 'Bayclin dll', color: 'text-purple-600', ring: 'focus:ring-purple-400' },
];

export default function LimbahAnorganik({ embedded = false }) {
    const user = getCurrentUser();
    const [data, setData] = useState([]);
    const [ruanganList, setRuanganList] = useState([]);
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [page, setPage] = useState(1);
    const [totalData, setTotalData] = useState(0);
    const [filterMonth, setFilterMonth] = useState('');
    const [filterRuangan, setFilterRuangan] = useState('');
    const itemsPerPage = 10;
    const [showRuanganSheet, setShowRuanganSheet] = useState(false);

    const emptyForm = {
        id: null,
        tanggal: new Date().toISOString().split('T')[0],
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

    // Ambil daftar ruangan dinamis dari tabel database 'ruangan'
    const fetchRuanganList = async () => {
        const list = await fetchDaftarRuangan();
        setRuanganList(list);
    };

    const fetchData = async () => {
        setLoading(true);
        try {
            let dbData = [];
            let count = 0;

            try {
                let queryCount = supabase
                    .from('limbah_anorganik')
                    .select('id', { count: 'exact', head: true });

                if (filterMonth) {
                    const [year, month] = filterMonth.split('-');
                    const startOfMonth = `${year}-${month}-01`;
                    const lastDay = new Date(year, month, 0).getDate();
                    const endOfMonth = `${year}-${month}-${String(lastDay).padStart(2, '0')}`;
                    queryCount = queryCount.gte('tanggal', startOfMonth).lte('tanggal', endOfMonth);
                }
                if (filterRuangan) {
                    queryCount = queryCount.eq('ruangan', filterRuangan);
                }

                const { count: c } = await queryCount;
                count = c || 0;

                const from = (page - 1) * itemsPerPage;
                let queryData = supabase
                    .from('limbah_anorganik')
                    .select('id, tanggal, ruangan, infus, jerigen, kertas, kardus, botol_mineral, bayclin_dll, keterangan, petugas, waktu_input')
                    .order('tanggal', { ascending: false })
                    .order('waktu_input', { ascending: false })
                    .range(from, from + itemsPerPage - 1);

                if (filterMonth) {
                    const [year, month] = filterMonth.split('-');
                    const startOfMonth = `${year}-${month}-01`;
                    const lastDay = new Date(year, month, 0).getDate();
                    const endOfMonth = `${year}-${month}-${String(lastDay).padStart(2, '0')}`;
                    queryData = queryData.gte('tanggal', startOfMonth).lte('tanggal', endOfMonth);
                }
                if (filterRuangan) {
                    queryData = queryData.eq('ruangan', filterRuangan);
                }

                const { data: result, error } = await queryData;
                if (!error) dbData = result || [];
            } catch (e) {
                console.warn('Handling offline/network error fetching limbah anorganik:', e);
            }

            let unsynced = getUnsyncedItemsForTable('limbah_anorganik');
            if (filterMonth) {
                unsynced = unsynced.filter(item => item.tanggal && item.tanggal.startsWith(filterMonth));
            }
            if (filterRuangan) {
                unsynced = unsynced.filter(item => item.ruangan === filterRuangan);
            }

            const unsyncedIds = new Set(unsynced.map(u => u.id));
            const filteredDbData = dbData.filter(d => !unsyncedIds.has(d.id));

            setData([...unsynced, ...filteredDbData]);
            setTotalData((count || 0) + unsynced.length);
        } catch (error) {
            console.error('Error fetching limbah anorganik:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchRuanganList();
    }, []);

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
    }, [page, filterMonth, filterRuangan]);

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.ruangan) {
            MySwal.fire('Peringatan', 'Silakan pilih ruangan terlebih dahulu!', 'warning');
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

        try {
            if (!navigator.onLine) {
                saveToOfflineQueue('limbah_anorganik', formData.id ? 'update' : 'insert', formData.id ? { ...payload, id: formData.id } : payload, `Input Limbah Anorganik ${formData.ruangan}`);
                MySwal.fire({
                    icon: 'info',
                    title: 'Tersimpan Offline',
                    text: 'Data telah disimpan di HP (Draft). Akan otomatis dikirim saat terhubung internet.',
                    confirmButtonColor: '#0891b2'
                });
            } else {
                if (formData.id) {
                    const { error } = await supabase.from('limbah_anorganik').update(payload).eq('id', formData.id);
                    if (error) throw error;
                    MySwal.fire('Berhasil', 'Data limbah anorganik berhasil diubah', 'success');
                } else {
                    const { error } = await supabase.from('limbah_anorganik').insert([payload]);
                    if (error) throw error;
                    MySwal.fire('Berhasil', 'Data limbah anorganik berhasil ditambahkan', 'success');
                }
            }
            setFormData(emptyForm);
            fetchData();
        } catch (error) {
            if (!navigator.onLine || error.message?.includes('Failed to fetch') || error.message?.includes('network')) {
                saveToOfflineQueue('limbah_anorganik', formData.id ? 'update' : 'insert', formData.id ? { ...payload, id: formData.id } : payload, `Input Limbah Anorganik ${formData.ruangan}`);
                MySwal.fire({
                    icon: 'info',
                    title: 'Tersimpan Offline',
                    text: 'Jaringan terputus. Data telah disimpan di HP (Draft) dan akan dikirim otomatis.',
                    confirmButtonColor: '#0891b2'
                });
                setFormData(emptyForm);
            } else {
                MySwal.fire('Gagal', error.message, 'error');
            }
        } finally {
            setSubmitting(false);
        }
    };

    const handleEdit = (item) => {
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
            keterangan: item.keterangan || ''
        });
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleDelete = async (item) => {
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
            if (item.isOffline) {
                removeOfflineQueueItem(item.offlineId || item.id);
                MySwal.fire('Terhapus', 'Draft offline berhasil dihapus', 'success');
                fetchData();
                return;
            }

            if (!navigator.onLine) {
                saveToOfflineQueue('limbah_anorganik', 'delete', { id: item.id }, `Hapus Limbah Anorganik ${item.ruangan || ''}`);
                MySwal.fire({
                    icon: 'info',
                    title: 'Tersimpan Offline',
                    text: 'Perintah hapus disimpan di HP. Akan diproses otomatis saat terhubung internet.',
                    confirmButtonColor: '#0891b2'
                });
                fetchData();
                return;
            }

            const { error } = await supabase.from('limbah_anorganik').delete().eq('id', item.id);
            if (error) throw error;
            MySwal.fire('Terhapus', 'Data berhasil dihapus', 'success');
            fetchData();
        } catch (error) {
            if (!navigator.onLine || error.message?.includes('Failed to fetch') || error.message?.includes('network')) {
                saveToOfflineQueue('limbah_anorganik', 'delete', { id: item.id }, `Hapus Limbah Anorganik ${item.ruangan || ''}`);
                MySwal.fire({
                    icon: 'info',
                    title: 'Tersimpan Offline',
                    text: 'Jaringan terputus. Perintah hapus disimpan dan akan diproses otomatis.',
                    confirmButtonColor: '#0891b2'
                });
                fetchData();
            } else {
                MySwal.fire('Gagal', error.message, 'error');
            }
        }
    };

    const totalPages = Math.ceil(totalData / itemsPerPage);
    const Wrapper = embedded ? EmbeddedWrapper : FullWrapper;

    return (
        <Wrapper>
            <div className="container mx-auto px-4 py-8">

                {/* Header */}
                <div className="bg-linear-to-r from-cyan-600 via-sky-600 to-blue-700 text-white rounded-2xl shadow-xl p-6 mb-6">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                            <h1 className="text-2xl font-black tracking-tight flex items-center gap-3">
                                <span className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                                    <i className="fas fa-recycle text-xl"></i>
                                </span>
                                Input Data Limbah Anorganik
                            </h1>
                            <p className="text-cyan-100 text-sm mt-1">
                                Catat timbulan limbah anorganik per ruangan/unit (infus, jerigen, kertas, kardus, botol mineral, bayclin dll).
                            </p>
                        </div>
                        <div className="flex items-center gap-2 bg-white/10 backdrop-blur-md px-4 py-2 rounded-xl border border-white/20 self-start md:self-auto">
                            <i className="fas fa-hospital text-cyan-200"></i>
                            <span className="text-xs font-bold uppercase tracking-wider">{ruanganList.length} Ruangan Terdaftar</span>
                        </div>
                    </div>
                </div>

                {/* Form */}
                <div className="bg-white rounded-2xl shadow-xl border border-gray-100 mb-6 overflow-hidden">
                    <div className="bg-cyan-600 text-white px-6 py-4 flex items-center justify-between">
                        <h2 className="text-lg font-bold flex items-center gap-2">
                            <i className="fas fa-edit"></i>
                            {formData.id ? 'Edit Data Limbah Anorganik' : 'Form Input Limbah Anorganik'}
                        </h2>
                        {formData.id && (
                            <span className="text-xs bg-amber-400 text-slate-900 font-bold px-2.5 py-1 rounded-full uppercase">
                                Mode Edit
                            </span>
                        )}
                    </div>

                    <div className="p-6">
                        <form onSubmit={handleSubmit}>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                                <div>
                                    <label className="block text-gray-700 font-bold text-sm mb-1">Tanggal</label>
                                    <input
                                        type="date"
                                        name="tanggal"
                                        value={formData.tanggal}
                                        onChange={handleInputChange}
                                        required
                                        className="w-full border border-gray-300 rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none text-sm"
                                    />
                                </div>

                                <div>
                                    <label className="block text-gray-700 font-bold text-sm mb-1">Ruangan / Unit</label>
                                    <button
                                        type="button"
                                        onClick={() => setShowRuanganSheet(true)}
                                        className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-left flex items-center justify-between text-sm focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none bg-white"
                                    >
                                        <span className={formData.ruangan ? 'text-gray-800 font-medium' : 'text-gray-400'}>
                                            {formData.ruangan || '-- Ketik atau pilih ruangan --'}
                                        </span>
                                        <i className="fas fa-chevron-down text-gray-400 text-xs" />
                                    </button>
                                </div>

                                <div>
                                    <label className="block text-gray-700 font-bold text-sm mb-1">Petugas Input</label>
                                    <input
                                        type="text"
                                        value={user?.nama || 'Petugas'}
                                        readOnly
                                        className="w-full border border-gray-200 bg-gray-100 text-gray-500 rounded-xl px-3 py-2.5 cursor-not-allowed text-sm font-medium"
                                    />
                                </div>
                            </div>

                            <div className="mb-4">
                                <label className="block text-gray-800 font-bold text-sm mb-2">
                                    Jumlah Timbulan Limbah Anorganik (Kg)
                                </label>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                                    {JENIS_FIELDS.map(f => (
                                        <div key={f.name}>
                                            <label className={`block text-sm font-semibold ${f.color} mb-1`}>{f.label} (Kg)</label>
                                            <input
                                                type="number"
                                                step="0.01"
                                                min="0"
                                                name={f.name}
                                                value={formData[f.name]}
                                                onChange={handleInputChange}
                                                required
                                                placeholder="0.0"
                                                className={`w-full border border-gray-300 rounded-xl px-3 py-2 focus:ring-2 ${f.ring} outline-none text-sm`}
                                            />
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="mb-6">
                                <label className="block text-gray-700 font-bold text-sm mb-1">Keterangan (Opsional)</label>
                                <input
                                    type="text"
                                    name="keterangan"
                                    value={formData.keterangan}
                                    onChange={handleInputChange}
                                    placeholder="Catatan tambahan, dll."
                                    className="w-full border border-gray-300 rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-cyan-500 outline-none text-sm"
                                />
                            </div>

                            <div className="flex justify-end gap-3">
                                {formData.id && (
                                    <button
                                        type="button"
                                        onClick={() => setFormData(emptyForm)}
                                        className="bg-gray-500 hover:bg-gray-600 text-white px-5 py-2.5 rounded-xl transition text-sm font-semibold"
                                    >
                                        Batal Edit
                                    </button>
                                )}
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="bg-cyan-600 hover:bg-cyan-700 text-white px-7 py-2.5 rounded-xl font-bold transition shadow-md disabled:opacity-50 flex items-center gap-2 text-sm"
                                >
                                    {submitting ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-save"></i>}
                                    {formData.id ? 'Update Data' : 'Simpan Data'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>

                {/* Tabel Data */}
                <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
                    {data.some(i => i.isOffline) && (
                        <div className="bg-amber-50 border-b border-amber-200 text-amber-900 px-6 py-3 text-xs sm:text-sm font-medium flex flex-col sm:flex-row items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                                <i className="fas fa-exclamation-triangle text-amber-600 text-base animate-pulse"></i>
                                <span>Terdapat <strong>{data.filter(i => i.isOffline).length} data offline</strong> yang belum tersinkronisasi.</span>
                            </div>
                            {navigator.onLine && (
                                <button
                                    onClick={() => syncOfflineQueue(true)}
                                    className="bg-amber-600 hover:bg-amber-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-xs"
                                >
                                    <i className="fas fa-cloud-upload-alt"></i> Sinkronkan Sekarang
                                </button>
                            )}
                        </div>
                    )}

                    <div className="bg-slate-800 text-white px-6 py-4 flex flex-col md:flex-row justify-between items-center gap-4">
                        <h2 className="text-lg font-bold flex items-center gap-2">
                            <i className="fas fa-table"></i> Data Limbah Anorganik
                            <span className="ml-2 text-xs font-normal text-slate-300">({totalData} total data)</span>
                        </h2>

                        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                            <select
                                value={filterRuangan}
                                onChange={(e) => { setFilterRuangan(e.target.value); setPage(1); }}
                                className="bg-white text-gray-800 px-3 py-2 rounded-xl text-xs sm:text-sm border outline-none font-medium max-w-[180px] truncate"
                            >
                                <option value="">Semua Ruangan</option>
                                {ruanganList.map(r => <option key={r} value={r}>{r}</option>)}
                            </select>

                            <input
                                type="month"
                                value={filterMonth}
                                onChange={(e) => { setFilterMonth(e.target.value); setPage(1); }}
                                className="bg-white text-gray-800 px-3 py-2 rounded-xl text-xs sm:text-sm border outline-none font-medium"
                            />
                        </div>
                    </div>

                    <div className="hidden md:block overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-gray-100 text-gray-700 text-xs uppercase tracking-wider border-b">
                                    <th className="px-3 py-2.5 font-bold">No.</th>
                                    <th className="px-3 py-2.5 font-bold">Tanggal</th>
                                    <th className="px-3 py-2.5 font-bold">Ruangan</th>
                                    {JENIS_FIELDS.map(f => (
                                        <th key={f.name} className="px-3 py-2.5 font-bold text-right">{f.label}</th>
                                    ))}
                                    <th className="px-3 py-2.5 font-bold text-right">Total</th>
                                    <th className="px-3 py-2.5 font-bold">Petugas</th>
                                    <th className="px-3 py-2.5 font-bold text-center">Aksi</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 text-xs">
                                {loading ? (
                                    <tr><td colSpan={JENIS_FIELDS.length + 6} className="text-center py-10">
                                        <i className="fas fa-spinner fa-spin text-cyan-500 text-2xl mb-2 block"></i>
                                        <span className="text-gray-500 text-xs font-semibold">Memuat data...</span>
                                    </td></tr>
                                ) : data.length === 0 ? (
                                    <tr><td colSpan={JENIS_FIELDS.length + 6} className="text-center py-12 text-gray-400">
                                        <i className="fas fa-inbox text-4xl mb-3 block opacity-40"></i>Belum ada data limbah anorganik.
                                    </td></tr>
                                ) : (
                                    data.map((item, idx) => {
                                        const rowNo = (page - 1) * itemsPerPage + idx + 1;
                                        const total = JENIS_FIELDS.reduce((sum, f) => sum + (parseFloat(item[f.name]) || 0), 0);
                                        return (
                                            <tr key={item.id} className={item.isOffline ? "bg-amber-50/70 hover:bg-amber-100/70 border-l-4 border-l-amber-500 transition-colors" : "hover:bg-cyan-50/40 transition-colors"}>
                                                <td className="px-3 py-2 text-gray-400 font-medium">{rowNo}</td>
                                                <td className="px-3 py-2 font-medium text-gray-800 whitespace-nowrap">
                                                    {new Date(item.tanggal).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                                                    {item.isOffline && <span className="ml-1.5 inline-flex items-center gap-1 text-[9px] font-extrabold bg-amber-200 text-amber-900 border border-amber-400 px-1.5 py-px rounded-full animate-pulse"><i className="fas fa-wifi-slash text-amber-700"></i>Draft</span>}
                                                </td>
                                                <td className="px-3 py-2 font-bold text-cyan-700">
                                                    <span className="inline-block bg-cyan-100 text-cyan-800 text-[10px] px-2 py-0.5 rounded-lg">{item.ruangan || '-'}</span>
                                                </td>
                                                {JENIS_FIELDS.map(f => (
                                                    <td key={f.name} className="px-3 py-2 text-right font-semibold text-gray-700">{(parseFloat(item[f.name]) || 0).toFixed(2)}</td>
                                                ))}
                                                <td className="px-3 py-2 text-right font-black text-slate-800">{total.toFixed(2)} Kg</td>
                                                <td className="px-3 py-2 text-gray-600">{item.petugas || '-'}</td>
                                                <td className="px-3 py-2 text-center whitespace-nowrap">
                                                    <button onClick={() => handleEdit(item)} className="bg-blue-100 text-blue-600 hover:bg-blue-200 px-2 py-1 rounded-lg mx-0.5 transition active:scale-95 text-xs"><i className="fas fa-edit"></i></button>
                                                    <button onClick={() => handleDelete(item)} className="bg-red-100 text-red-600 hover:bg-red-200 px-2 py-1 rounded-lg mx-0.5 transition active:scale-95 text-xs"><i className="fas fa-trash"></i></button>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Mobile card list */}
                    <div className="md:hidden divide-y divide-gray-100">
                        {loading ? (
                            <div className="text-center py-10">
                                <i className="fas fa-spinner fa-spin text-cyan-500 text-2xl"></i>
                                <p className="text-gray-500 text-xs mt-2">Memuat data...</p>
                            </div>
                        ) : data.length === 0 ? (
                            <div className="text-center py-10 text-gray-400">
                                <i className="fas fa-inbox text-3xl mb-2 block opacity-50"></i>
                                <p className="text-xs">Belum ada data limbah anorganik.</p>
                            </div>
                        ) : (
                            data.map((item, idx) => {
                                const rowNo = (page - 1) * itemsPerPage + idx + 1;
                                const total = JENIS_FIELDS.reduce((sum, f) => sum + (parseFloat(item[f.name]) || 0), 0);
                                return (
                                    <div key={item.id} className={`flex items-start gap-3 px-4 py-3 border-l-4 ${item.isOffline ? 'border-l-amber-500 bg-amber-50/60' : 'border-l-cyan-400'}`}>
                                        <span className="text-[10px] text-gray-400 font-bold pt-0.5 w-5 shrink-0">{rowNo}</span>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-1.5 flex-wrap mb-1">
                                                <span className="text-xs font-bold text-gray-800">{new Date(item.tanggal).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                                                <span className="text-[10px] font-bold bg-cyan-100 text-cyan-800 px-2 py-px rounded-full">{item.ruangan || '-'}</span>
                                                {item.isOffline && <span className="text-[9px] font-bold bg-amber-200 text-amber-900 px-1.5 py-px rounded-full animate-pulse">Draft</span>}
                                            </div>
                                            <div className="grid grid-cols-3 gap-x-1 gap-y-0.5 text-[10px]">
                                                {JENIS_FIELDS.map(f => (
                                                    <div key={f.name}><span className="text-gray-400">{f.label}</span><br /><span className="font-bold text-gray-700">{(parseFloat(item[f.name]) || 0).toFixed(2)}</span></div>
                                                ))}
                                                <div><span className="text-gray-400">Total</span><br /><span className="font-black text-slate-800">{total.toFixed(2)}</span></div>
                                            </div>
                                        </div>
                                        <div className="flex gap-1 shrink-0">
                                            <button onClick={() => handleEdit(item)} className="w-7 h-7 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center text-xs"><i className="fas fa-edit"></i></button>
                                            <button onClick={() => handleDelete(item.id)} className="w-7 h-7 rounded-lg bg-red-100 text-red-600 flex items-center justify-center text-xs"><i className="fas fa-trash"></i></button>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>

                    {totalPages > 0 && (
                        <div className="flex flex-col sm:flex-row justify-between items-center px-6 py-4 bg-gray-50 border-t text-sm gap-3">
                            <div className="flex items-center space-x-2 text-gray-600">
                                <span>Halaman</span>
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
                                    className="w-16 px-2 py-1 border rounded-lg text-center outline-none focus:ring-2 focus:ring-cyan-500 font-bold bg-white text-xs"
                                />
                                <span>dari {totalPages}</span>
                            </div>
                            <div className="flex gap-2">
                                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                                    className="px-3.5 py-1.5 bg-white border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-100 disabled:opacity-50 transition text-xs font-semibold">
                                    Sebelumnya
                                </button>
                                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                                    className="px-3.5 py-1.5 bg-white border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-100 disabled:opacity-50 transition text-xs font-semibold">
                                    Selanjutnya
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <SearchableBottomSheet
                isOpen={showRuanganSheet}
                onClose={() => setShowRuanganSheet(false)}
                options={ruanganList}
                value={formData.ruangan}
                onChange={(val) => setFormData(prev => ({ ...prev, ruangan: val }))}
                label="Pilih Ruangan / Unit"
                placeholder="Cari ruangan atau unit..."
                accentColor="emerald"
            />
        </Wrapper>
    );
}