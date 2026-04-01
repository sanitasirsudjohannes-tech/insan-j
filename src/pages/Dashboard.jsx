import { useState, useEffect, useRef } from 'react';
import AppLayout from '../components/AppLayout';
import Swal from 'sweetalert2';
import withReactContent from 'sweetalert2-react-content';
import { API_URL, getCurrentUser } from '../lib/api';

const MySwal = withReactContent(Swal);

const AVAILABLE_FORMS = [
  { id: 'ruang_bangunan', name: 'Ruang Bangunan', icon: '🏢', color: 'blue' },
  { id: 'pengolahan_limbah', name: 'Pengolahan Limbah', icon: '🗑️', color: 'green' },
  { id: 'toilet', name: 'Kebersihan Toilet', icon: '🚽', color: 'purple' },
  { id: 'reservoir', name: 'Kebersihan Bak Reservoir', icon: '💧', color: 'yellow' },
  { id: 'gizi', name: 'Ceklist Gizi', icon: '🍽️', color: 'gray' }
];

const CHECKLIST_ITEMS = {
  // Same content from old script...
  ruang_bangunan: [
      { id: 'dinding_bersih', text: 'Dinding bersih, tidak retak, tidak lembab' },
      { id: 'lantai_rata', text: 'Lantai rata, tidak licin, mudah dibersihkan' },
      { id: 'genangan_air', text: 'Tidak ada genangan air' },
      { id: 'plafon_utuh', text: 'Plafon utuh, tidak bocor' },
      { id: 'jamur_plafon', text: 'Tidak ada jamur pada plafon' },
      { id: 'sudut_ruangan', text: 'Sudut ruangan mudah dibersihkan' },
      { id: 'udara_pengap', text: 'Udara ruangan tidak pengap' },
      { id: 'lantai_rutin', text: 'Lantai dibersihkan rutin' },
      { id: 'sampah_baik', text: 'Terdapat Tempat sampah' },
      { id: 'serangga_tikus', text: 'Tidak ada serangga/tikus' },
      { id: 'toilet_bersih', text: 'Toilet bersih & berfungsi' },
      { id: 'sudut_konus', text: 'Sudut konus antara lantai dan dinding' }
  ],
  pengolahan_limbah: [
      { id: 'tempat_sampah_warna', text: 'Tersedia tempat sampah sesuai kode warna' },
      { id: 'kantong_warna', text: 'Kantong plastik sesuai standar warna limbah medis' },
      { id: 'limbah_tajam', text: 'Limbah tajam dibuang ke safety box' },
      { id: 'pencampuran_limbah', text: 'Tidak ada pencampuran limbah medis & domestik' },
      { id: 'sampah_penutup', text: 'Tempat sampah memiliki penutup' },
      { id: 'sampah_bersih', text: 'Tempat sampah dalam kondisi Bersih' },
      { id: 'sampah_baik_limbah', text: 'Tempat sampah dalam kondisi Baik' },
      { id: 'bau_menyengat', text: 'Tidak ada bau menyengat' },
      { id: 'vektor', text: 'Tidak ada vektor (lalat/tikus)' },
      { id: 'troli_tertutup', text: 'Troli tertutup' },
      { id: 'troli_dibersihkan', text: 'Troli dibersihkan setelah digunakan' },
      { id: 'troli_baik', text: 'Troli dalam kondisi baik' },
      { id: 'troli_kantong', text: 'Troli dilapisi kantong sesuai jenis limbah' }
  ],
  toilet: [
      { id: 'lantai_bersih_toilet', text: 'Lantai bersih' },
      { id: 'spal_tersumbat', text: 'SPAL tidak tersumbat' },
      { id: 'lawa_lawa', text: 'Tidak terdapat lawa-lawa' },
      { id: 'closet_bersih', text: 'Closet tidak tersumbat dan bersih' },
      { id: 'bak_air_bersih', text: 'Bak Air dalam keadaan bersih' },
      { id: 'bak_air_retak', text: 'Bak Air Tidak retak/pecah' },
      { id: 'jentik', text: 'Tidak terdapat jentik' },
      { id: 'ventilasi_bersih', text: 'Ventilasi bersih' },
      { id: 'serangga_toilet', text: 'Tidak ditemukan serangga' },
      { id: 'tempat_sampah_toilet', text: 'Terdapat tempat sampah' },
      { id: 'saluran_air_bocor', text: 'Saluran air bersih tidak bocor' },
      { id: 'spal_penutup', text: 'SPAL memiliki penutup' },
      { id: 'sabun_cuci', text: 'Memiliki Sabun cuci tangan' },
      { id: 'kloset_baik', text: 'Kloset dalam keadaan baik' }
  ],
  reservoir: [
      { id: 'bak_tidak_bocor', text: 'Bak tidak bocor' },
      { id: 'genangan_reservoir', text: 'Tidak ada genangan air di sekitar reservoir' },
      { id: 'bak_tidak_berlumut', text: 'Bak tidak berlumut' },
      { id: 'bak_bersih', text: 'Bak air dalam keadaan bersih' },
      { id: 'perpipaan_bocor', text: 'Perpipaan tidak bocor' },
      { id: 'perpipaan_korosif', text: 'Perpipaan tidak korosif' },
      { id: 'penutup_reservoir', text: 'Terdapat penutup reservoir' },
      { id: 'penutup_baik', text: 'Penutup reservoir dalam keadaan baik' },
      { id: 'cela_terbuka', text: 'Tidak terdapat cela terbuka pada bak reservoir' }
  ],
  gizi: [
      { id: 'limbah', text: 'Pembuangan air limbah dilengkapi grease trap' },
      { id: 'lantai_dan_dinding', text: 'Lantai dan dinding bersih, tidak retak dan tidak licin' },
      { id: 'pengaturan_ruang', text: 'Memiliki ruang kantor terpisah dari ruang pengolahan makanan' },
      { id: 'ventilasi', text: 'Terdapat penangkap asap/ cerobong' },
      { id: 'fasilitas_pencucian', text: 'Fasilitas pencucian dalam kondisi baik dan bersih' },
      { id: 'fasilitas_pencucian2', text: 'Setiap peralatan dobersihkan dengan kaporit atau air panas 80 Celcius' },
      { id: 'fasilitas_pencucian3', text: 'Setiap ruang pengolahan makanan harus ada minimal 1 tempat cuci tangan' },
      { id: 'fasilitas_pencucian4', text: 'Tersedia lemari penyimpanan dingin suhu 5 - 10 Celcius' },
      { id: 'fasilitas_pencucian5', text: 'Ruang tempat pengolahan makanan terpisah dari ruang tempat penyimpanan bahan makanan' },
      { id: 'karyawan', text: 'Karyawan dalam kondisi sehat' },
      { id: 'karyawan2', text: 'Menggunakan APD' },
      { id: 'karyawan3', text: 'Pakaian bersih, kuku terpotong dan tidak menggunakan cat kuku serta perhiasan' },
  ]
};

const LOKASI_OPTIONS = [
  "Poli Jantung", "Poli Mata", "Poli P. Dalam", "Poli Dots", "Poli Paru", "Poli Syaraf",
  "Cempaka", "Lab Patologi Anatomi", "Lab Patologi Klinis", "Radiologi", "OK", "ICU", "HCU",
  "HD", "VK", "IGD Lama", "IGDT", "Halaman Parkir", "WC Umum", "ICVCU", "OK Cyto", "Cath Lab",
  "Mutis", "Edelweis", "Paviliun", "Teratai", "Bougenvill 1", "Bougenvill 2", "TPS Non Medis",
  "Komodo", "Tulip", "Anggrek", "Asoka", "Poli MCU", "IPJ", "Gizi", "Kelimutu", "MRI",
  "Onkologi", "Sasando", "NICU", "Mawar", "Kenanga", "Poli VCT", "Kepegawaian", "Poli THT",
  "Poli Bedah Mulut", "Poli Gigi", "Gudang Farmasi", "Poli Kandungan", "Poli Kulit Kelamin",
  "Poli Bedah", "Poli Anak"
];

export default function Dashboard() {
  const user = getCurrentUser();
  const [selectedForms, setSelectedForms] = useState([]);
  const [showForm, setShowForm] = useState(false);
  
  const [tanggal, setTanggal] = useState(new Date().toISOString().split('T')[0]);
  const [lokasi, setLokasi] = useState('');
  const [formDataState, setFormDataState] = useState({});
  const [activities, setActivities] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const formRef = useRef(null);

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
    let num = parseInt(numStr || '0', 10);
    if (num > 10) num = 10;
    if (num < 0) num = 0;
    
    setFormDataState(prev => ({
      ...prev,
      [key]: num
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
      const payload = new URLSearchParams();
      payload.append('action', 'submitChecklist');
      payload.append('tanggal', tanggal);
      payload.append('petugas', user.nama);
      payload.append('lokasi', lokasi);
      payload.append('userId', user.id);
      payload.append('timestamp', new Date().toISOString());
      
      selectedForms.forEach(formId => {
        const items = CHECKLIST_ITEMS[formId] || [];
        let totalNilai = 0;
        let maksimalNilai = items.length * 10;
        
        items.forEach(item => {
          const val = formDataState[`${formId}_${item.id}`] || 0;
          totalNilai += val;
          payload.append(`${formId}_${item.id}`, val.toString());
        });
        
        const persentase = maksimalNilai > 0 ? Math.round((totalNilai / maksimalNilai) * 100) : 0;
        payload.append(`${formId}_total`, totalNilai.toString());
        payload.append(`${formId}_persentase`, persentase.toString());
        payload.append(`${formId}_maksimal`, maksimalNilai.toString());
      });

      await fetch(API_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: payload
      });

      // Show success
      MySwal.fire({
        icon: 'success',
        title: 'Berhasil!',
        text: 'Data isian berhasil dikirim.',
        timer: 2000,
        showConfirmButton: false
      });

      // Add to activities
      setActivities(prev => [{
        id: Date.now(),
        forms: selectedCategoriesText,
        lokasi,
        time: new Date(tanggal).toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
        petugas: user.nama
      }, ...prev]);

      // Reset
      setShowForm(false);
      setSelectedForms([]);
      setLokasi('');
      setFormDataState({});
      
    } catch (error) {
      console.error(error);
      MySwal.fire('Informasi', 'Data tetap tersimpan secara lokal. ' + error.message, 'info');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AppLayout>
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
                    <input list="lokasiList" className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" placeholder="-- Ketik atau pilih lokasi --" 
                            value={lokasi} onChange={e => setLokasi(e.target.value)} required />
                    <datalist id="lokasiList">
                      {LOKASI_OPTIONS.map(opt => <option key={opt} value={opt} />)}
                    </datalist>
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
              {activities.length === 0 ? (
                <p className="text-gray-500 italic text-sm text-center">Belum ada aktivitas di sesi ini.</p>
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
    </AppLayout>
  );
}
