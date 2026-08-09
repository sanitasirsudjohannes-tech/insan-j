import { useState, useEffect, useRef } from 'react';
import AppLayout from '../components/AppLayout';
import Swal from 'sweetalert2';
import withReactContent from 'sweetalert2-react-content';
import { supabase } from '../lib/supabase';
import { saveToOfflineQueue } from '../lib/offlineStorage';
import { AVAILABLE_FORMS, CHECKLIST_ITEMS } from '../lib/constants';
import { fetchDaftarRuangan } from '../lib/api';
import SearchableBottomSheet from '../components/SearchableBottomSheet';

const MySwal = withReactContent(Swal);

export default function Inspeksi({ user }) {
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
      const insertionPromises = selectedForms.map(async formId => {
        const items = CHECKLIST_ITEMS[formId] || [];
        let totalNilai = 0;
        let maksimalNilai = items.length * 10;

        items.forEach(item => {
          const val = formDataState[`${formId}_${item.id}`] || 0;
          totalNilai += val;
        });

        const persentase = maksimalNilai > 0 ? Math.round((totalNilai / maksimalNilai) * 100) : 0;

        let tableName = '';
        let insertData = {
          waktu_input: new Date().toISOString(),
          tanggal_pemeriksaan: tanggal,
          petugas: user.nama,
          ruangan: lokasi,
          total: totalNilai,
          persen: persentase,
          nilai_maks: maksimalNilai,
        };

        if (formId === 'ruang_bangunan') {
          tableName = 'ruang_bangunan';
          insertData.dinding_bersih = formDataState['ruang_bangunan_dinding_bersih'] || 0;
          insertData.lantai_rata = formDataState['ruang_bangunan_lantai_rata'] || 0;
          insertData.tidak_ada_genangan_air = formDataState['ruang_bangunan_genangan_air'] || 0;
          insertData.plafon_utuh = formDataState['ruang_bangunan_plafon_utuh'] || 0;
          insertData.tidak_ada_jamur = formDataState['ruang_bangunan_jamur_plafon'] || 0;
          insertData.sudut_mudah_dibersihkan = formDataState['ruang_bangunan_sudut_ruangan'] || 0;
          insertData.udara_tidak_pengap = formDataState['ruang_bangunan_udara_pengap'] || 0;
          insertData.lantai_dibersihkan = formDataState['ruang_bangunan_lantai_rutin'] || 0;
          insertData.tempat_sampah = formDataState['ruang_bangunan_sampah_baik'] || 0;
          insertData.tidak_ada_serangga = formDataState['ruang_bangunan_serangga_tikus'] || 0;
          insertData.toilet_bersih = formDataState['ruang_bangunan_toilet_bersih'] || 0;
          insertData.sudut_konus = formDataState['ruang_bangunan_sudut_konus'] || 0;
        } else if (formId === 'pengolahan_limbah') {
          tableName = 'limbah_medis';
          insertData.tempat_sampah_sesuai_kode = formDataState['pengolahan_limbah_tempat_sampah_warna'] || 0;
          insertData.kantong_sesuai_warna = formDataState['pengolahan_limbah_kantong_warna'] || 0;
          insertData.limbah_tajam_ke_safetybox = formDataState['pengolahan_limbah_limbah_tajam'] || 0;
          insertData.tidak_ada_pencampuran_limbah = formDataState['pengolahan_limbah_pencampuran_limbah'] || 0;
          insertData.tempat_sampah_berpenutup = formDataState['pengolahan_limbah_sampah_penutup'] || 0;
          insertData.tempat_sampah_bersih = formDataState['pengolahan_limbah_sampah_bersih'] || 0;
          insertData.tempat_sampah_baik = formDataState['pengolahan_limbah_sampah_baik_limbah'] || 0;
          insertData.tidak_ada_bau = formDataState['pengolahan_limbah_bau_menyengat'] || 0;
          insertData.tidak_ada_vektor = formDataState['pengolahan_limbah_vektor'] || 0;
          insertData.troli_tertutup = formDataState['pengolahan_limbah_troli_tertutup'] || 0;
          insertData.troli_dibersihkan = formDataState['pengolahan_limbah_troli_dibersihkan'] || 0;
          insertData.troli_baik = formDataState['pengolahan_limbah_troli_baik'] || 0;
          insertData.troli_kantong_sesuai = formDataState['pengolahan_limbah_troli_kantong'] || 0;
        } else if (formId === 'toilet') {
          tableName = 'pemeriksaan_toilet';
          insertData.lantai_bersih = formDataState['toilet_lantai_bersih_toilet'] || 0;
          insertData.spal_tidak_tersumbat = formDataState['toilet_spal_tersumbat'] || 0;
          insertData.tidak_ada_laba_laba = formDataState['toilet_lawa_lawa'] || 0;
          insertData.closet_bersih_tidak_tersumbat = formDataState['toilet_closet_bersih'] || 0;
          insertData.bak_air_bersih = formDataState['toilet_bak_air_bersih'] || 0;
          insertData.bak_air_tidak_retak = formDataState['toilet_bak_air_retak'] || 0;
          insertData.tidak_ada_jentik = formDataState['toilet_jentik'] || 0;
          insertData.ventilasi_bersih = formDataState['toilet_ventilasi_bersih'] || 0;
          insertData.tidak_ada_serangga = formDataState['toilet_serangga_toilet'] || 0;
          insertData.ada_tempat_sampah = formDataState['toilet_tempat_sampah_toilet'] || 0;
          insertData.saluran_air_tidak_bocor = formDataState['toilet_saluran_air_bocor'] || 0;
          insertData.spal_berpenutup = formDataState['toilet_spal_penutup'] || 0;
          insertData.ada_sabun_cuci_tangan = formDataState['toilet_sabun_cuci'] || 0;
          insertData.kloset_kondisi_baik = formDataState['toilet_kloset_baik'] || 0;
        } else if (formId === 'reservoir') {
          tableName = 'pemeriksaan_reservoir';
          insertData.bak_tidak_bocor = formDataState['reservoir_bak_tidak_bocor'] || 0;
          insertData.tidak_ada_genangan = formDataState['reservoir_genangan_reservoir'] || 0;
          insertData.bak_tidak_berlumut = formDataState['reservoir_bak_tidak_berlumut'] || 0;
          insertData.bak_air_bersih = formDataState['reservoir_bak_bersih'] || 0;
          insertData.perpipaan_tidak_bocor = formDataState['reservoir_perpipaan_bocor'] || 0;
          insertData.perpipaan_tidak_korosif = formDataState['reservoir_perpipaan_korosif'] || 0;
          insertData.reservoir_berpenutup = formDataState['reservoir_penutup_reservoir'] || 0;
          insertData.penutup_reservoir_baik = formDataState['reservoir_penutup_baik'] || 0;
          insertData.tidak_ada_celah_reservoir = formDataState['reservoir_celah_terbuka'] || 0;
        } else if (formId === 'gizi') {
          tableName = 'pemeriksaan_gizi';
          insertData.limbah_dilengkapi_grease_trap = formDataState['gizi_limbah'] || 0;
          insertData.lantai_dinding_bersih = formDataState['gizi_lantai_dan_dinding'] || 0;
          insertData.ruang_kantor_terpisah = formDataState['gizi_pengaturan_ruang'] || 0;
          insertData.ada_penangkap_asap = formDataState['gizi_ventilasi'] || 0;
          insertData.fasilitas_cuci_baik = formDataState['gizi_fasilitas_pencucian'] || 0;
          insertData.peralatan_disterilkan = formDataState['gizi_fasilitas_pencucian2'] || 0;
          insertData.ada_tempat_cuci_tangan = formDataState['gizi_fasilitas_pencucian3'] || 0;
          insertData.lemari_dingin_5_10c = formDataState['gizi_fasilitas_pencucian4'] || 0;
          insertData.ruang_olah_terpisah = formDataState['gizi_fasilitas_pencucian5'] || 0;
          insertData.karyawan_sehat = formDataState['gizi_karyawan'] || 0;
          insertData.menggunakan_apd = formDataState['gizi_karyawan2'] || 0;
          insertData.kebersihan_personal = formDataState['gizi_karyawan3'] || 0;
        }

        if (tableName) {
          if (!navigator.onLine) {
            saveToOfflineQueue(tableName, 'insert', insertData, `Inspeksi ${selectedCategoriesText}`);
          } else {
            const { error } = await supabase.from(tableName).insert([insertData]);
            if (error) throw new Error(`Gagal menyimpan ${tableName}: ` + error.message);
          }
        }
      });

      await Promise.all(insertionPromises);

      if (!navigator.onLine) {
        MySwal.fire({
          icon: 'info',
          title: 'Tersimpan Offline (Draft)',
          text: 'Data inspeksi disimpan di HP. Akan otomatis di-sync ke server saat terhubung internet.',
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

      // Add to activities (top 4 only)
      setActivities(prev => {
        const newAct = {
          id: Date.now(),
          forms: selectedCategoriesText,
          lokasi,
          time: new Date(tanggal).toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
          petugas: user.nama,
          waktu_input: new Date().toISOString()
        };
        return [newAct, ...prev].slice(0, 4);
      });

      // Reset
      setShowForm(false);
      setSelectedForms([]);
      setLokasi('');
      setFormDataState({});

    } catch (error) {
      console.error(error);
      if (!navigator.onLine || error.message?.includes('Failed to fetch') || error.message?.includes('network')) {
        MySwal.fire({
          icon: 'info',
          title: 'Tersimpan Offline (Draft)',
          text: 'Jaringan terputus. Data inspeksi disimpan di HP dan akan di-sync otomatis.',
          confirmButtonColor: '#2563eb'
        });
        setShowForm(false);
        setSelectedForms([]);
        setLokasi('');
        setFormDataState({});
      } else {
        MySwal.fire('Gagal', error.message, 'error');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AppLayout title="Dashboard">
      <div className="container mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow-lg p-6 mb-8 flex items-center border-l-4 border-blue-500">
          <div>
            <h2 className="text-2xl font-bold text-gray-800">Selamat Datang, {user?.nama}!</h2>
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
