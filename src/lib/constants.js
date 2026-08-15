export const AVAILABLE_FORMS = [
  { id: 'ruang_bangunan', name: 'Ruang Bangunan', icon: '🏢', color: 'blue', table: 'ruang_bangunan' },
  { id: 'pengolahan_limbah', name: 'Pengolahan Limbah', icon: '🗑️', color: 'green', table: 'limbah_medis' },
  { id: 'toilet', name: 'Kebersihan Toilet', icon: '🚽', color: 'purple', table: 'pemeriksaan_toilet' },
  { id: 'reservoir', name: 'Kebersihan Bak Reservoir', icon: '💧', color: 'yellow', table: 'pemeriksaan_reservoir' },
  { id: 'gizi', name: 'Ceklist Gizi', icon: '🍽️', color: 'gray', table: 'pemeriksaan_gizi' }
];

export const CHECKLIST_ITEMS = {
  // DB Table: ruang_bangunan
  ruang_bangunan: [
    { id: 'dinding_bersih', text: 'Dinding bersih, tidak retak, tidak lembab', dbCol: 'dinding_bersih' },
    { id: 'lantai_rata', text: 'Lantai rata, tidak licin, mudah dibersihkan', dbCol: 'lantai_rata' },
    { id: 'genangan_air', text: 'Tidak ada genangan air', dbCol: 'tidak_ada_genangan_air' },
    { id: 'plafon_utuh', text: 'Plafon utuh, tidak bocor', dbCol: 'plafon_utuh' },
    { id: 'jamur_plafon', text: 'Tidak ada jamur pada plafon', dbCol: 'tidak_ada_jamur' },
    { id: 'sudut_ruangan', text: 'Sudut ruangan mudah dibersihkan', dbCol: 'sudut_mudah_dibersihkan' },
    { id: 'udara_pengap', text: 'Udara ruangan tidak pengap', dbCol: 'udara_tidak_pengap' },
    { id: 'lantai_rutin', text: 'Lantai dibersihkan rutin', dbCol: 'lantai_dibersihkan' },
    { id: 'sampah_baik', text: 'Terdapat Tempat sampah', dbCol: 'tempat_sampah' },
    { id: 'serangga_tikus', text: 'Tidak ada serangga/tikus', dbCol: 'tidak_ada_serangga' },
    { id: 'toilet_bersih', text: 'Toilet bersih & berfungsi', dbCol: 'toilet_bersih' },
    { id: 'sudut_konus', text: 'Sudut konus antara lantai dan dinding', dbCol: 'sudut_konus' }
  ],
  // DB Table: limbah_medis
  pengolahan_limbah: [
    { id: 'tempat_sampah_warna', text: 'Tersedia tempat sampah sesuai kode warna', dbCol: 'tempat_sampah_sesuai_kode' },
    { id: 'kantong_warna', text: 'Kantong plastik sesuai standar warna limbah medis', dbCol: 'kantong_sesuai_warna' },
    { id: 'limbah_tajam', text: 'Limbah tajam dibuang ke safety box', dbCol: 'limbah_tajam_ke_safetybox' },
    { id: 'pencampuran_limbah', text: 'Tidak ada pencampuran limbah medis & domestik', dbCol: 'tidak_ada_pencampuran_limbah' },
    { id: 'sampah_penutup', text: 'Tempat sampah memiliki penutup', dbCol: 'tempat_sampah_berpenutup' },
    { id: 'sampah_bersih', text: 'Tempat sampah dalam kondisi Bersih', dbCol: 'tempat_sampah_bersih' },
    { id: 'sampah_baik_limbah', text: 'Tempat sampah dalam kondisi Baik', dbCol: 'tempat_sampah_baik' },
    { id: 'bau_menyengat', text: 'Tidak ada bau menyengat', dbCol: 'tidak_ada_bau' },
    { id: 'vektor', text: 'Tidak ada vektor (lalat/tikus)', dbCol: 'tidak_ada_vektor' },
    { id: 'troli_tertutup', text: 'Troli tertutup', dbCol: 'troli_tertutup' },
    { id: 'troli_dibersihkan', text: 'Troli dibersihkan setelah digunakan', dbCol: 'troli_dibersihkan' },
    { id: 'troli_baik', text: 'Troli dalam kondisi baik', dbCol: 'troli_baik' },
    { id: 'troli_kantong', text: 'Troli dilapisi kantong sesuai jenis limbah', dbCol: 'troli_kantong_sesuai' }
  ],
  // DB Table: pemeriksaan_toilet
  toilet: [
    { id: 'lantai_bersih_toilet', text: 'Lantai bersih', dbCol: 'lantai_bersih' },
    { id: 'spal_tersumbat', text: 'SPAL tidak tersumbat', dbCol: 'spal_tidak_tersumbat' },
    { id: 'lawa_lawa', text: 'Tidak terdapat lawa-lawa', dbCol: 'tidak_ada_laba_laba' },
    { id: 'closet_bersih', text: 'Closet tidak tersumbat dan bersih', dbCol: 'closet_bersih_tidak_tersumbat' },
    { id: 'bak_air_bersih', text: 'Bak Air dalam keadaan bersih', dbCol: 'bak_air_bersih' },
    { id: 'bak_air_retak', text: 'Bak Air Tidak retak/pecah', dbCol: 'bak_air_tidak_retak' },
    { id: 'jentik', text: 'Tidak terdapat jentik', dbCol: 'tidak_ada_jentik' },
    { id: 'ventilasi_bersih', text: 'Ventilasi bersih', dbCol: 'ventilasi_bersih' },
    { id: 'serangga_toilet', text: 'Tidak ditemukan serangga', dbCol: 'tidak_ada_serangga' },
    { id: 'tempat_sampah_toilet', text: 'Terdapat tempat sampah', dbCol: 'ada_tempat_sampah' },
    { id: 'saluran_air_bocor', text: 'Saluran air bersih tidak bocor', dbCol: 'saluran_air_tidak_bocor' },
    { id: 'spal_penutup', text: 'SPAL memiliki penutup', dbCol: 'spal_berpenutup' },
    { id: 'sabun_cuci', text: 'Memiliki Sabun cuci tangan', dbCol: 'ada_sabun_cuci_tangan' },
    { id: 'kloset_baik', text: 'Kloset dalam keadaan baik', dbCol: 'kloset_kondisi_baik' }
  ],
  // DB Table: pemeriksaan_reservoir
  reservoir: [
    { id: 'bak_tidak_bocor', text: 'Bak tidak bocor', dbCol: 'bak_tidak_bocor' },
    { id: 'genangan_reservoir', text: 'Tidak ada genangan air di sekitar reservoir', dbCol: 'tidak_ada_genangan' },
    { id: 'bak_tidak_berlumut', text: 'Bak tidak berlumut', dbCol: 'bak_tidak_berlumut' },
    { id: 'bak_bersih', text: 'Bak air dalam keadaan bersih', dbCol: 'bak_air_bersih' },
    { id: 'perpipaan_bocor', text: 'Perpipaan tidak bocor', dbCol: 'perpipaan_tidak_bocor' },
    { id: 'perpipaan_korosif', text: 'Perpipaan tidak korosif', dbCol: 'perpipaan_tidak_korosif' },
    { id: 'penutup_reservoir', text: 'Terdapat penutup reservoir', dbCol: 'reservoir_berpenutup' },
    { id: 'penutup_baik', text: 'Penutup reservoir dalam keadaan baik', dbCol: 'penutup_reservoir_baik' },
    { id: 'celah_terbuka', text: 'Tidak terdapat celah terbuka pada bak reservoir', dbCol: 'tidak_ada_celah_reservoir' }
  ],
  // DB Table: pemeriksaan_gizi
  gizi: [
    { id: 'limbah', text: 'Pembuangan air limbah dilengkapi grease trap', dbCol: 'limbah_dilengkapi_grease_trap' },
    { id: 'lantai_dan_dinding', text: 'Lantai dan dinding bersih, tidak retak dan tidak licin', dbCol: 'lantai_dinding_bersih' },
    { id: 'pengaturan_ruang', text: 'Memiliki ruang kantor terpisah dari ruang pengolahan makanan', dbCol: 'ruang_kantor_terpisah' },
    { id: 'ventilasi', text: 'Terdapat penangkap asap/ cerobong', dbCol: 'ada_penangkap_asap' },
    { id: 'fasilitas_pencucian', text: 'Fasilitas pencucian dalam kondisi baik dan bersih', dbCol: 'fasilitas_cuci_baik' },
    { id: 'fasilitas_pencucian2', text: 'Setiap peralatan dobersihkan dengan kaporit atau air panas 80 Celcius', dbCol: 'peralatan_disterilkan' },
    { id: 'fasilitas_pencucian3', text: 'Setiap ruang pengolahan makanan harus ada minimal 1 tempat cuci tangan', dbCol: 'ada_tempat_cuci_tangan' },
    { id: 'fasilitas_pencucian4', text: 'Tersedia lemari penyimpanan dingin suhu 5 - 10 Celcius', dbCol: 'lemari_dingin_5_10c' },
    { id: 'fasilitas_pencucian5', text: 'Ruang tempat pengolahan makanan terpisah dari ruang tempat penyimpanan bahan makanan', dbCol: 'ruang_olah_terpisah' },
    { id: 'karyawan', text: 'Karyawan dalam kondisi sehat', dbCol: 'karyawan_sehat' },
    { id: 'karyawan2', text: 'Menggunakan APD', dbCol: 'menggunakan_apd' },
    { id: 'karyawan3', text: 'Pakaian bersih, kuku terpotong dan tidak menggunakan cat kuku serta perhiasan', dbCol: 'kebersihan_personal' },
  ]
};


