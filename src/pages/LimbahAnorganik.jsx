import { useState, useEffect } from 'react';
import AppLayout from '../components/AppLayout';
import { supabase } from '../lib/supabase';
import Swal from 'sweetalert2';
import withReactContent from 'sweetalert2-react-content';
import { getCurrentUser, fetchDaftarRuangan } from '../lib/api';
import {
  saveToOfflineQueue,
  getUnsyncedItemsForTable,
  removeLocalRecordQueue,
  getOfflineDeletedIds,
} from '../lib/offlineStorage';

import AnorganikForm, { JENIS_FIELDS } from '../components/limbah/anorganik/AnorganikForm';
import AnorganikTable from '../components/limbah/anorganik/AnorganikTable';
import OfflineBanner from '../components/limbah/OfflineBanner';
import Pagination from '../components/limbah/Pagination';

const MySwal = withReactContent(Swal);

function EmbeddedWrapper({ children }) {
  return <div className="bg-gray-100 min-h-screen">{children}</div>;
}
function FullWrapper({ children }) {
  return <AppLayout title="Limbah Anorganik">{children}</AppLayout>;
}

const ITEMS_PER_PAGE = 10;

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
    keterangan: '',
  };
  const [formData, setFormData] = useState(emptyForm);

  // ── Fetch ruangan ────────────────────────────────────────────────────────────
  useEffect(() => {
    fetchDaftarRuangan().then(setRuanganList);
  }, []);

  // ── Fetch data ───────────────────────────────────────────────────────────────
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
          const start = `${year}-${month}-01`;
          const end = `${year}-${month}-${String(new Date(year, month, 0).getDate()).padStart(2, '0')}`;
          queryCount = queryCount.gte('tanggal', start).lte('tanggal', end);
        }
        if (filterRuangan) queryCount = queryCount.eq('ruangan', filterRuangan);

        const { count: c } = await queryCount;
        count = c || 0;

        const from = (page - 1) * ITEMS_PER_PAGE;
        let queryData = supabase
          .from('limbah_anorganik')
          .select('id, tanggal, ruangan, infus, jerigen, kertas, kardus, botol_mineral, bayclin_dll, keterangan, petugas, waktu_input')
          .order('tanggal', { ascending: false })
          .order('waktu_input', { ascending: false })
          .range(from, from + ITEMS_PER_PAGE - 1);

        if (filterMonth) {
          const [year, month] = filterMonth.split('-');
          const start = `${year}-${month}-01`;
          const end = `${year}-${month}-${String(new Date(year, month, 0).getDate()).padStart(2, '0')}`;
          queryData = queryData.gte('tanggal', start).lte('tanggal', end);
        }
        if (filterRuangan) queryData = queryData.eq('ruangan', filterRuangan);

        const { data: result, error } = await queryData;
        if (!error) dbData = result || [];
      } catch (e) {
        console.warn('Handling offline/network error fetching limbah anorganik:', e);
      }

      let unsynced = getUnsyncedItemsForTable('limbah_anorganik');
      if (filterMonth) unsynced = unsynced.filter(i => i.tanggal?.startsWith(filterMonth));
      if (filterRuangan) unsynced = unsynced.filter(i => i.ruangan === filterRuangan);

      const unsyncedIds = new Set(unsynced.map(u => String(u.id)));
      const delIds = new Set(getOfflineDeletedIds('limbah_anorganik'));
      const filteredDb = dbData.filter(d => !unsyncedIds.has(String(d.id)) && !delIds.has(String(d.id)));

      setData([...unsynced, ...filteredDb]);
      setTotalData((count || 0) + unsynced.length);
    } catch (error) {
      console.error('Error fetching limbah anorganik:', error);
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
  }, [page, filterMonth, filterRuangan]);

  // ── Handlers ─────────────────────────────────────────────────────────────────
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
      waktu_input: new Date().toISOString(),
    };

    try {
      if (!navigator.onLine) {
        saveToOfflineQueue('limbah_anorganik', formData.id ? 'update' : 'insert',
          formData.id ? { ...payload, id: formData.id } : payload,
          `Input Limbah Anorganik ${formData.ruangan}`);
        MySwal.fire({ icon: 'info', title: 'Tersimpan Offline', text: 'Data telah disimpan di HP (Draft). Akan otomatis dikirim saat terhubung internet.', confirmButtonColor: '#0891b2' });
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
        saveToOfflineQueue('limbah_anorganik', formData.id ? 'update' : 'insert',
          formData.id ? { ...payload, id: formData.id } : payload,
          `Input Limbah Anorganik ${formData.ruangan}`);
        MySwal.fire({ icon: 'info', title: 'Tersimpan Offline', text: 'Jaringan terputus. Data telah disimpan di HP (Draft) dan akan dikirim otomatis.', confirmButtonColor: '#0891b2' });
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
      keterangan: item.keterangan || '',
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
      confirmButtonText: 'Ya, Hapus!',
    });
    if (!confirm.isConfirmed) return;

    try {
      if (item.isOffline && item.offlineAction === 'insert') {
        removeLocalRecordQueue(item);
        MySwal.fire('Terhapus', 'Draft offline berhasil dihapus', 'success');
        fetchData();
        return;
      }
      removeLocalRecordQueue(item);

      if (!navigator.onLine) {
        saveToOfflineQueue('limbah_anorganik', 'delete', { id: item.id }, `Hapus Limbah Anorganik ${item.ruangan || ''}`);
        MySwal.fire({ icon: 'info', title: 'Tersimpan Offline', text: 'Perintah hapus disimpan di HP. Akan diproses otomatis saat terhubung internet.', confirmButtonColor: '#0891b2' });
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
        MySwal.fire({ icon: 'info', title: 'Tersimpan Offline', text: 'Jaringan terputus. Perintah hapus disimpan dan akan diproses otomatis.', confirmButtonColor: '#0891b2' });
        fetchData();
      } else {
        MySwal.fire('Gagal', error.message, 'error');
      }
    }
  };

  const totalPages = Math.ceil(totalData / ITEMS_PER_PAGE);
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
                  <i className="fas fa-recycle text-xl" />
                </span>
                Input Data Limbah Anorganik
              </h1>
              <p className="text-cyan-100 text-sm mt-1">
                Catat timbulan limbah anorganik per ruangan/unit (infus, jerigen, kertas, kardus, botol mineral, bayclin dll).
              </p>
            </div>
            <div className="flex items-center gap-2 bg-white/10 backdrop-blur-md px-4 py-2 rounded-xl border border-white/20 self-start md:self-auto">
              <i className="fas fa-hospital text-cyan-200" />
              <span className="text-xs font-bold uppercase tracking-wider">{ruanganList.length} Ruangan Terdaftar</span>
            </div>
          </div>
        </div>

        {/* Form */}
        <AnorganikForm
          formData={formData}
          emptyForm={emptyForm}
          setFormData={setFormData}
          handleInputChange={handleInputChange}
          handleSubmit={handleSubmit}
          submitting={submitting}
          user={user}
          ruanganList={ruanganList}
          showRuanganSheet={showRuanganSheet}
          setShowRuanganSheet={setShowRuanganSheet}
        />

        {/* Tabel */}
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
          <OfflineBanner data={data} />
          <AnorganikTable
            data={data}
            loading={loading}
            page={page}
            itemsPerPage={ITEMS_PER_PAGE}
            filterMonth={filterMonth}
            filterRuangan={filterRuangan}
            ruanganList={ruanganList}
            totalData={totalData}
            setFilterMonth={setFilterMonth}
            setFilterRuangan={setFilterRuangan}
            setPage={setPage}
            onEdit={handleEdit}
            onDelete={handleDelete}
          />
          <Pagination
            page={page}
            totalPages={totalPages}
            onPageChange={setPage}
            accentColor="cyan"
          />
        </div>

      </div>
    </Wrapper>
  );
}