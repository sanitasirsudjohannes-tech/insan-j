import { useState, useEffect, useRef } from 'react';
import AppLayout from '../components/AppLayout';
import Swal from 'sweetalert2';
import withReactContent from 'sweetalert2-react-content';
import { supabase } from '../lib/supabase';
import { saveToOfflineQueue } from '../lib/offlineStorage';
import { AVAILABLE_FORMS, CHECKLIST_ITEMS } from '../lib/constants';
import { getCurrentUser, fetchDaftarRuangan } from '../lib/api';
import SearchableBottomSheet from '../components/SearchableBottomSheet';
import { isNetworkError } from '../lib/networkErrors';
import { submitInspectionEntries } from '../lib/inspectionSubmission';
import { notifyDatabaseTablesChanged } from '../lib/databaseAggregations';

const MySwal = withReactContent(Swal);

export default function Inspeksi({ user: propUser }) {
  const user = propUser || getCurrentUser();

  const [selectedForms, setSelectedForms] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [tanggal, setTanggal] = useState(new Date().toISOString().split('T')[0]);
  const [lokasi, setLokasi] = useState('');
  const [ruanganList, setRuanganList] = useState([]);
  const [formDataState, setFormDataState] = useState({});
  const [activities, setActivities] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadingActivities, setLoadingActivities] = useState(true);
  const [showRuanganSheet, setShowRuanganSheet] = useState(false);

  const formRef = useRef(null);

  useEffect(() => {
    fetchDaftarRuangan().then(list => setRuanganList(list));
  }, []);

  useEffect(() => {
    const fetchRecentActivities = async () => {
      if (!user?.nama) return;
      setLoadingActivities(true);
      try {
        const tables = [
          { name: 'ruang_bangunan', label: 'Ruang Bangunan' },
          { name: 'limbah_medis', label: 'Pengolahan Limbah' },
          { name: 'pemeriksaan_toilet', label: 'Kebersihan Toilet' },
          { name: 'pemeriksaan_reservoir', label: 'Kebersihan Bak Reservoir' },
          { name: 'pemeriksaan_gizi', label: 'Ceklist Gizi' }
        ];

        const queries = tables.map(table =>
          supabase.from(table.name)
            .select('id, waktu_input, tanggal_pemeriksaan, petugas, ruangan')
            .eq('petugas', user.nama)
            .order('waktu_input', { ascending: false })
            .limit(4)
        );

        const results = await Promise.all(queries);

        let allActivities = [];
        results.forEach((res, index) => {
          if (res.data) {
            res.data.forEach(item => {
              allActivities.push({
                id: `${tables[index].name}_${item.id}`,
                forms: tables[index].label,
                lokasi: item.ruangan,
                time: new Date(item.tanggal_pemeriksaan).toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
                waktu_input: item.waktu_input,
                petugas: item.petugas
              });
            });
          }
        });

        // Sort by waktu_input descending
        allActivities.sort((a, b) => new Date(b.waktu_input) - new Date(a.waktu_input));

        // Take top 4
        setActivities(allActivities.slice(0, 4));
      } catch (err) {
        console.error("Error fetching activities:", err);
      } finally {
        setLoadingActivities(false);
      }
    };

    fetchRecentActivities();
  }, [user?.nama]);

  const toggleForm = (formId) => {
    const isRemoving = selectedForms.includes(formId);
    setSelectedForms(prev =>
      isRemoving ? prev.filter(id => id !== formId) : [...prev, formId]
    );

    // When adding a new form, initialize its values to 0 immediately
    if (!isRemoving) {
      setFormDataState(prev => {
        const merged = { ...prev };
        const items = CHECKLIST_ITEMS[formId] || [];
        items.forEach(item => {
          const key = `${formId}_${item.id}`;
          if (!(key in merged)) {
            merged[key] = 0;
          }
        });
        return merged;
      });
    }
  };

  const selectedCategoriesText = selectedForms.map(id =>
    AVAILABLE_FORMS.find(f => f.id === id)?.name
  ).join(', ') || 'Belum ada form dipilih';

  const handleGenerate = () => {
    if (selectedForms.length === 0) {
      MySwal.fire('Perhatian', 'Pilih minimal 1 form terlebih dahulu!', 'warning');
      return;
    }

    // Merge new form values, preserve existing ones
    setFormDataState(prev => {
      const merged = { ...prev };
      selectedForms.forEach(formId => {
        const items = CHECKLIST_ITEMS[formId] || [];
        items.forEach(item => {
          const key = `${formId}_${item.id}`;
          if (!(key in merged)) {
            merged[key] = 0;
          }
        });
      });
      return merged;
    });
    setShowForm(true);

    setTimeout(() => {
      formRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const handleInputChange = (key, value) => {
    // Only allow numbers, replace invalid
    let numStr = value.replace(/[^0-9]/g, '');
    let finalVal;

    if (numStr === '') {
      finalVal = '';
    } else {
      finalVal = parseInt(numStr, 10);
      if (finalVal > 10) finalVal = 10;
      if (finalVal < 0) finalVal = 0;
    }

    setFormDataState(prev => ({
      ...prev,
      [key]: finalVal
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!lokasi) {
      MySwal.fire('Peringatan', 'Lokasi harus diisi!', 'warning');
      return;
    }

    const confirm = await MySwal.fire({
      title: 'Kirim Data?',
      text: "Pastikan data isian nilai sudah benar.",
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#d33',
      confirmButtonText: 'Ya, Kirim!'
    });

    if (!confirm.isConfirmed) return;

    setIsSubmitting(true);
    MySwal.fire({
      title: 'Mengirim Data...',
      allowOutsideClick: false,
      didOpen: () => {
        MySwal.showLoading();
      }
    });

    try {
      const submissionTime = new Date().toISOString();
      const entries = selectedForms.map(formId => {
        const items = CHECKLIST_ITEMS[formId] || [];
        const formInfo = AVAILABLE_FORMS.find(f => f.id === formId);
        const tableName = formInfo?.table;

        let totalNilai = 0;
        const maksimalNilai = items.length * 10;

        const insertData = {
          waktu_input: submissionTime,
          tanggal_pemeriksaan: tanggal,
          petugas: user.nama,
          ruangan: lokasi,
        };

        items.forEach(item => {
          const val = formDataState[`${formId}_${item.id}`] || 0;
          totalNilai += val;
          insertData[item.dbCol] = val;
        });

        insertData.total = totalNilai;
        insertData.persen = maksimalNilai > 0 ? Math.round((totalNilai / maksimalNilai) * 100) : 0;
        insertData.nilai_maks = maksimalNilai;

        return {
          formId,
          label: formInfo?.name || formId,
          table: tableName,
          payload: insertData,
          description: `Inspeksi ${formInfo?.name || formId}`,
        };
      });

      const submission = await submitInspectionEntries({
        entries,
        online: navigator.onLine,
        insertEntry: async entry => {
          if (!entry.table) throw new Error(`Tabel untuk ${entry.label} tidak tersedia.`);
          const { error } = await supabase.from(entry.table).insert([entry.payload]);
          if (error) {
            const submissionError = new Error(`Gagal menyimpan ${entry.label}: ${error.message}`);
            submissionError.status = error.status;
            submissionError.code = error.code;
            submissionError.details = error.details;
            submissionError.cause = error;
            throw submissionError;
          }
          notifyDatabaseTablesChanged(entry.table);
        },
        queueEntry: entry => {
          if (!entry.table) throw new Error(`Tabel untuk ${entry.label} tidak tersedia.`);
          saveToOfflineQueue(entry.table, 'insert', entry.payload, entry.description);
        },
        isNetworkError,
      });

      const accepted = [...submission.synced, ...submission.queued];

      if (submission.failed.length > 0) {
        const failedIds = new Set(submission.failed.map(entry => entry.formId));
        const failedLabels = submission.failed.map(entry => entry.label).join(', ');
        setSelectedForms(selected => selected.filter(formId => failedIds.has(formId)));
        setFormDataState(current => Object.fromEntries(
          Object.entries(current).filter(([key]) => (
            [...failedIds].some(formId => key.startsWith(`${formId}_`))
          ))
        ));
        setShowForm(true);

        await MySwal.fire({
          icon: accepted.length > 0 ? 'warning' : 'error',
          title: accepted.length > 0 ? 'Sebagian Data Belum Tersimpan' : 'Data Belum Tersimpan',
          text: `${accepted.length} formulir sudah aman. Formulir yang gagal (${failedLabels}) tetap terbuka dan tidak dibuang.`,
          confirmButtonColor: '#dc2626',
        });
      } else if (submission.queued.length > 0 && submission.synced.length > 0) {
        MySwal.fire({
          icon: 'warning',
          title: 'Tersimpan Sebagian sebagai Draft',
          text: `${submission.synced.length} formulir tersimpan di server dan ${submission.queued.length} formulir aman di antrean offline.`,
          confirmButtonColor: '#2563eb',
        });
      } else if (submission.queued.length > 0) {
        MySwal.fire({
          icon: 'info',
          title: 'Tersimpan Offline (Draft)',
          text: `${submission.queued.length} formulir inspeksi disimpan di HP dan akan dikirim otomatis.`,
          confirmButtonColor: '#2563eb'
        });
      } else {
        MySwal.fire({
          icon: 'success',
          title: 'Berhasil!',
          text: 'Data isian berhasil dikirim.',
          timer: 2000,
          showConfirmButton: false
        });
      }

      if (accepted.length > 0) setActivities(prev => {
        const newAct = {
          id: Date.now(),
          forms: accepted.map(entry => entry.label).join(', '),
          lokasi,
          time: new Date(tanggal).toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
          petugas: user.nama,
          waktu_input: new Date().toISOString()
        };
        return [newAct, ...prev].slice(0, 4);
      });

      if (submission.failed.length === 0) {
        setShowForm(false);
        setSelectedForms([]);
        setLokasi('');
        setFormDataState({});
      }

    } catch (error) {
      console.error(error);
      MySwal.fire('Gagal', `${error.message}. Isian tetap dipertahankan.`, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AppLayout title="Dashboard">
      <div className="container mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow-lg p-6 mb-8 flex items-center border-l-4 border-blue-500">
          <div>
            <h2 className="text-2xl font-bold text-gray-800">Hallo, {user?.nama}! <span className="text-2xl">👋</span></h2>
            <p className="text-gray-600">Silakan pilih form isian nilai yang ingin diisi</p>
          </div>
        </div>

        {/* Pilihan Form */}
        <div className="bg-white rounded-lg shadow-lg mb-6 overflow-hidden">
          <div className="bg-blue-600 text-white px-6 py-3">
            <h5 className="font-semibold"><i className="fas fa-check-circle mr-2"></i>Pilih Form Isian (Bisa lebih dari 1)</h5>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {AVAILABLE_FORMS.map(form => (
                <div
                  key={form.id}
                  onClick={() => toggleForm(form.id)}
                  className={`form-card rounded-lg shadow p-4 ${selectedForms.includes(form.id) ? 'selected' : 'bg-white border-2 border-transparent'}`}
                >
                  <div className="text-center">
                    <div className="text-4xl mb-2">{form.icon}</div>
                    <h5 className="font-bold">{form.name}</h5>
                    <p className="text-sm text-gray-500 mt-1">{CHECKLIST_ITEMS[form.id]?.length || 0} item</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Tombol Generate */}
        <div className="mb-6">
          <button
            onClick={handleGenerate}
            disabled={selectedForms.length === 0}
            className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-4 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <i className="fas fa-file-alt mr-2"></i>Generate Form Isian
          </button>
        </div>

        {/* Generated Form */}
        <div ref={formRef} className={showForm ? 'block' : 'hidden'}>
          <div className="bg-white rounded-lg shadow-lg overflow-hidden">
            <div className="bg-blue-600 text-white px-6 py-3 flex flex-col md:flex-row justify-between md:items-center space-y-2 md:space-y-0">
              <h5 className="font-semibold"><i className="fas fa-clipboard-list mr-2"></i>Form Isian Nilai Terintegrasi</h5>
              <span className="bg-white text-blue-600 px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap overflow-hidden text-ellipsis">{selectedCategoriesText}</span>
            </div>
            <div className="p-6">
              <form onSubmit={handleSubmit}>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  <div>
                    <label className="block text-gray-700 font-bold mb-2">Tanggal Inspeksi</label>
                    <input type="date" className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={tanggal} onChange={e => setTanggal(e.target.value)} required />
                  </div>
                  <div>
                    <label className="block text-gray-700 font-bold mb-2">Petugas Inspeksi</label>
                    <input type="text" className="w-full border rounded-lg px-3 py-2 bg-gray-100 text-gray-600 cursor-not-allowed"
                      value={user?.nama || ''} readOnly />
                  </div>
                  <div>
                    <label className="block text-gray-700 font-bold mb-2">Lokasi/Unit</label>
                    <button
                      type="button"
                      onClick={() => setShowRuanganSheet(true)}
                      className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-left flex items-center justify-between text-sm"
                    >
                      <span className={lokasi ? 'text-gray-800 font-medium' : 'text-gray-400'}>
                        {lokasi || '-- Ketik atau pilih lokasi --'}
                      </span>
                      <i className="fas fa-chevron-down text-gray-400 text-xs" />
                    </button>
                  </div>
                </div>

                <div className="space-y-6">
                  {selectedForms.map(formId => {
                    const formInfo = AVAILABLE_FORMS.find(f => f.id === formId);
                    const items = CHECKLIST_ITEMS[formId] || [];

                    return (
                      <div key={formId} className="p-4 border border-gray-200 rounded-lg">
                        <h6 className={`font-bold text-${formInfo.color}-600 mb-3 flex items-center`}>
                          <i className="fas fa-check-circle mr-2"></i>{formInfo.name}
                        </h6>
                        {items.length === 0 ? (
                          <p className="text-gray-500 italic">Form sedang dalam pengembangan</p>
                        ) : (
                          <div className="space-y-2">
                            {items.map(item => (
                              <div key={item.id} className="checklist-item flex items-center justify-between">
                                <label htmlFor={`${formId}_${item.id}`} className="text-gray-700 flex-1 mr-4">
                                  {item.text}
                                </label>
                                <div className="flex items-center space-x-2">
                                  <input
                                    type="text"
                                    inputMode="numeric"
                                    className="nilai-input"
                                    id={`${formId}_${item.id}`}
                                    value={formDataState[`${formId}_${item.id}`] ?? ''}
                                    onChange={(e) => handleInputChange(`${formId}_${item.id}`, e.target.value)}
                                    required
                                  />
                                  <span className="text-gray-400 text-xs">(0-10)</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className="mt-8">
                  <button type="submit" disabled={isSubmitting} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg transition disabled:opacity-70 flex justify-center items-center">
                    {isSubmitting ? (
                      <><i className="fas fa-spinner fa-spin mr-2"></i>Mengirim...</>
                    ) : (
                      <><i className="fas fa-paper-plane mr-2"></i>Kirim Form Isian</>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-white rounded-lg shadow-lg mt-8 overflow-hidden">
          <div className="bg-gray-100 px-6 py-3">
            <h5 className="font-semibold text-gray-700">Aktivitas Terakhir</h5>
          </div>
          <div className="p-6">
            <div className="space-y-3">
              {loadingActivities ? (
                <div className="flex justify-center py-4">
                  <i className="fas fa-spinner fa-spin text-blue-500 text-xl"></i>
                  <span className="ml-2 text-gray-500 text-sm">Memuat aktivitas...</span>
                </div>
              ) : activities.length === 0 ? (
                <p className="text-gray-500 italic text-sm text-center">Belum ada aktivitas yang tercatat.</p>
              ) : (
                activities.map(act => (
                  <div key={act.id} className="bg-gray-50 p-4 rounded-lg border-l-4 border-green-500">
                    <div className="flex justify-between items-start flex-col sm:flex-row space-y-2 sm:space-y-0">
                      <div>
                        <span className="font-semibold text-gray-800 wrap-break-word line-clamp-2" title={act.forms}>{act.forms}</span>
                        <span className="inline-block bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded mt-1 sm:mt-0 sm:ml-2 font-medium">{act.lokasi}</span>
                      </div>
                      <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded font-bold self-start"><i className="fas fa-check mr-1"></i>Terkirim</span>
                    </div>
                    <div className="text-xs text-gray-500 mt-2"><i className="far fa-clock mr-1"></i>{act.time} | Petugas: <span className="font-medium">{act.petugas}</span></div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
      <SearchableBottomSheet
        isOpen={showRuanganSheet}
        onClose={() => setShowRuanganSheet(false)}
        options={ruanganList}
        value={lokasi}
        onChange={setLokasi}
        label="Pilih Lokasi / Unit"
        placeholder="Cari lokasi atau unit..."
        accentColor="blue"
      />
    </AppLayout>
  );
}
