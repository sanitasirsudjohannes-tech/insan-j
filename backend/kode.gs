const SHEET_ID = "1n24g6Q-YrCN7GmeHJkHY8W4yGrAehH6lLHUEiYZn7Fs";

function doGet(e) {
  return handleRequest(e);
}

function doPost(e) {
  return handleRequest(e);
}

function handleRequest(e) {
  try {
    // Parse data dari POST atau GET
    let params = e.parameter;
    
    if (e.postData && e.postData.contents) {
      try {
        params = JSON.parse(e.postData.contents);
      } catch (e) {
        // Jika bukan JSON, tetap pakai parameter
      }
    }
    
    const action = params.action;
    
    if (action === 'login') {
      return login(params);
    } else if (action === 'changePassword') { 
      return changePassword(params);
    } else if (action === 'submitChecklist') {
      return submitChecklist(params);
    } else if (action === 'getRiwayat') {      // <--- ADDED: Tangkap action getRiwayat
      return getRiwayat(params);
    }
    
    return createResponse({ status: 'error', message: 'Unknown action' });
    
  } catch (err) {
    return createResponse({ status: 'error', message: err.toString() });
  }
}

function login(params) {
  try {
    const username = params.username;
    const password = params.password;
    
    const ss = SpreadsheetApp.openById(SHEET_ID);
    const sheet = ss.getSheetByName('users');
    
    if (!sheet) {
      return createResponse({ status: 'error', message: 'Sheet users tidak ditemukan' });
    }
    
    const data = sheet.getDataRange().getValues();
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][1] === username && data[i][2] === password) {
        return createResponse({
          status: 'success',
          data: {
            id: data[i][0],
            username: data[i][1],
            nama: data[i][3],
            role: data[i][4]
          }
        });
      }
    }
    
    return createResponse({ status: 'error', message: 'Username/password salah' });
    
  } catch (err) {
    return createResponse({ status: 'error', message: err.toString() });
  }
}

function submitChecklist(params) {
  try {
    const ss = SpreadsheetApp.openById(SHEET_ID);
    
    // Data umum
    const tanggal = params.tanggal || '';
    const petugas = params.petugas || '';
    const lokasi = params.lokasi || '';
    const userId = params.userId || '';
    const timestamp = params.timestamp || new Date().toISOString();
    
    const results = [];
    
    // ===== SHEET RUANG BANGUNAN =====
    if (params.ruang_bangunan_dinding_bersih !== undefined) {
      let sheet = ss.getSheetByName('ruang_bangunan');
      if (!sheet) {
        sheet = ss.insertSheet('ruang_bangunan');
        const headers = [
          'Timestamp','Tanggal', 'Petugas', 'Lokasi', 'User ID', 
          'Dinding bersih, tidak retak, tidak lembab',
          'Lantai rata, tidak licin, mudah dibersihkan',
          'Tidak ada genangan air',
          'Plafon utuh, tidak bocor',
          'Tidak ada jamur pada plafon',
          'Sudut ruangan mudah dibersihkan',
          'Udara ruangan tidak pengap',
          'Lantai dibersihkan rutin',
          'Terdapat Tempat Sampah',
          'Tidak ada serangga/tikus',
          'Toilet bersih & berfungsi',
          'Sudut konus antara lantai dan dinding',
          'Total', 'Persentase', 'Maksimal'
        ];
        sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
        sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
      }
      
      // Ambil data ruang bangunan
      const rowData = [
        timestamp, tanggal, petugas, lokasi, userId,
        params.ruang_bangunan_dinding_bersih || '0',
        params.ruang_bangunan_lantai_rata || '0',
        params.ruang_bangunan_genangan_air || '0',
        params.ruang_bangunan_plafon_utuh || '0',
        params.ruang_bangunan_jamur_plafon || '0',
        params.ruang_bangunan_sudut_ruangan || '0',
        params.ruang_bangunan_udara_pengap || '0',
        params.ruang_bangunan_lantai_rutin || '0',
        params.ruang_bangunan_sampah_baik || '0',
        params.ruang_bangunan_serangga_tikus || '0',
        params.ruang_bangunan_toilet_bersih || '0',
        params.ruang_bangunan_sudut_konus || '0',
        params.ruang_bangunan_total || '0',
        params.ruang_bangunan_persentase || '0',
        params.ruang_bangunan_maksimal || '120'
      ];
      
      sheet.appendRow(rowData);
      results.push('ruang_bangunan: 1 baris');
    }
    
    // ===== SHEET PENGOLAHAN LIMBAH =====
    if (params.pengolahan_limbah_tempat_sampah_warna !== undefined) {
      let sheet = ss.getSheetByName('pengolahan_limbah');
      if (!sheet) {
        sheet = ss.insertSheet('pengolahan_limbah');
        const headers = [
          'Timestamp','Tanggal', 'Petugas', 'Lokasi', 'User ID',
          'Tersedia tempat sampah sesuai kode warna (infeksius, non medis, tajam, farmasi)',
          'Kantong plastik sesuai standar warna limbah medis',
          'Limbah tajam dibuang ke safety box',
          'Tidak ada pencampuran limbah medis & domestik',
          'Tempat sampah memiliki penutup',
          'Tempat sampah dalam kondisi Bersih',
          'Tempat sampah dalam kondisi Baik',
          'Tidak ada bau menyengat',
          'Tidak ada vektor (lalat/tikus)',
          'Troli tertutup',
          'Troli dibersihkan setelah digunakan',
          'Troli dalam kondisi baik',
          'Troli dilapisi kantong sesuai jenis limbah',
          'Total', 'Persentase', 'Maksimal'
        ];
        sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
        sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
      }
      
      const rowData = [
        timestamp, tanggal, petugas, lokasi, userId,
        params.pengolahan_limbah_tempat_sampah_warna || '0',
        params.pengolahan_limbah_kantong_warna || '0',
        params.pengolahan_limbah_limbah_tajam || '0',
        params.pengolahan_limbah_pencampuran_limbah || '0',
        params.pengolahan_limbah_sampah_penutup || '0',
        params.pengolahan_limbah_sampah_bersih || '0',
        params.pengolahan_limbah_sampah_baik_limbah || '0',
        params.pengolahan_limbah_bau_menyengat || '0',
        params.pengolahan_limbah_vektor || '0',
        params.pengolahan_limbah_troli_tertutup || '0',
        params.pengolahan_limbah_troli_dibersihkan || '0',
        params.pengolahan_limbah_troli_baik || '0',
        params.pengolahan_limbah_troli_kantong || '0',
        params.pengolahan_limbah_total || '0',
        params.pengolahan_limbah_persentase || '0',
        params.pengolahan_limbah_maksimal || '130'
      ];
      
      sheet.appendRow(rowData);
      results.push('pengolahan_limbah: 1 baris');
    }
    
    // ===== SHEET TOILET =====
    if (params.toilet_lantai_bersih_toilet !== undefined) {
      let sheet = ss.getSheetByName('toilet');
      if (!sheet) {
        sheet = ss.insertSheet('toilet');
        const headers = [
          'Timestamp','Tanggal', 'Petugas', 'Lokasi', 'User ID',
          'Lantai bersih',
          'SPAL tidak tersumbat',
          'tidak terdapat lawa-lawa',
          'Closet tidak tersumbat dan bersih',
          'Bak Air bersih',
          'Bak Air Tidak retak/pecah',
          'tidak terdapat jentik',
          'ventilasi bersih',
          'tidak ditemukan serangga',
          'terdapat tempat sampah',
          'saluran air bersih tidak bocor',
          'SPAL memiliki penutup',
          'memiliki Sabun cuci tangan',
          'Kloset dalam keadaan baik (memiliki penutup untuk kloset duduk, penampung air untuk bilas)',
          'Total', 'Persentase', 'Maksimal'
        ];
        sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
        sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
      }
      
      const rowData = [
        timestamp, tanggal, petugas, lokasi, userId,
        params.toilet_lantai_bersih_toilet || '0',
        params.toilet_spal_tersumbat || '0',
        params.toilet_lawa_lawa || '0',
        params.toilet_closet_bersih || '0',
        params.toilet_bak_air_bersih || '0',
        params.toilet_bak_air_retak || '0',
        params.toilet_jentik || '0',
        params.toilet_ventilasi_bersih || '0',
        params.toilet_serangga_toilet || '0',
        params.toilet_tempat_sampah_toilet || '0',
        params.toilet_saluran_air_bocor || '0',
        params.toilet_spal_penutup || '0',
        params.toilet_sabun_cuci || '0',
        params.toilet_kloset_baik || '0',
        params.toilet_total || '0',
        params.toilet_persentase || '0',
        params.toilet_maksimal || '140'
      ];
      
      sheet.appendRow(rowData);
      results.push('toilet: 1 baris');
    }
    
    // ===== SHEET RESERVOIR =====
    if (params.reservoir_bak_tidak_bocor !== undefined) {
      let sheet = ss.getSheetByName('reservoir');
      if (!sheet) {
        sheet = ss.insertSheet('reservoir');
        const headers = [
          'Timestamp','Tanggal', 'Petugas', 'Lokasi', 'User ID',
          'bak tidak bocor',
          'tidak terdapat genangan air, sampah, lumpur disekitar reservoir',
          'bak tidak berlumut',
          'bak air dalam keadaan bersih (tidak terdapat endapan)',
          'perpipaan tidak bocor',
          'perpipaan tidak korosif',
          'terdapat penutup reservoir',
          'penutup reservoir dalam keadaan baik',
          'tidak terdapat cela terbuka pada bak reservoir',
           'Total', 'Persentase', 'Maksimal'
        ];
        sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
        sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
      }
      
      const rowData = [
        timestamp, tanggal, petugas, lokasi, userId,
        params.reservoir_bak_tidak_bocor || '0',
        params.reservoir_genangan_reservoir || '0',
        params.reservoir_bak_tidak_berlumut || '0',
        params.reservoir_bak_bersih || '0',
        params.reservoir_perpipaan_bocor || '0',
        params.reservoir_perpipaan_korosif || '0',
        params.reservoir_penutup_reservoir || '0',
        params.reservoir_penutup_baik || '0',
        params.reservoir_cela_terbuka || '0',
         params.reservoir_total || '0',
        params.reservoir_persentase || '0',
        params.reservoir_maksimal || '90'
      ];
      
      sheet.appendRow(rowData);
      results.push('reservoir: 1 baris');
    }
    
    // ===== SHEET GIZI =====
    if (params.gizi_limbah !== undefined) {
      let sheet = ss.getSheetByName('gizi');
      if (!sheet) {
        sheet = ss.insertSheet('gizi');
        const headers = [
          'Timestamp','Tanggal', 'Petugas', 'Lokasi', 'User ID',
          'Pembuangan air limbah dilengkapi grease trap',
          'Lantai dan dinding bersih, tidak retak dan tidak licin',
          'Memiliki ruang kantor terpisah dari ruang pengolahan makanan',
          'Terdapat penangkap asap/ cerobong',
          'Fasilitas pencucian dalam kondisi baik dan bersih',
          'Setiap peralatan dobersihkan dengan kaporit atau air panas 80 Celcius',
          'Setiap ruang pengolahan makanan harus ada minimal 1 tempat cuci tangan',
          'Tersedia lemari penyimpanan dingin suhu 5 - 10 Celcius',
          'Ruang tempat pengolahan makanan terpisah dari ruang tempat penyimpanan bahan makanan',
          'Karyawan dalam kondisi sehat',
          'Menggunakan APD',
          'Pakaian bersih, kuku terpotong dan tidak menggunakan cat kuku serta perhiasan',
          'Total', 'Persentase', 'Maksimal'
        ];
        sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
        sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
      }
      
      const rowData = [
        timestamp, tanggal, petugas, lokasi, userId,
        params.gizi_limbah|| '0',
        params.gizi_lantai_dan_dinding|| '0',
        params.gizi_pengaturan_ruang || '0',
        params.gizi_ventilasi || '0',
        params.gizi_fasilitas_pencucian || '0',
        params.gizi_fasilitas_pencucian2 || '0',
        params.gizi_fasilitas_pencucian3 || '0',
        params.gizi_fasilitas_pencucian4 || '0',
        params.gizi_fasilitas_pencucian5 || '0',
        params.gizi_karyawan || '0',
        params.gizi_karyawan2 || '0',
        params.gizi_karyawan3 || '0',
        params.gizi_total || '0',
        params.gizi_persentase || '0',
        params.gizi_maksimal || '120'
      ];
      
      sheet.appendRow(rowData);
      results.push('gizi: 1 baris');
    }
      
    
    return createResponse({
      status: 'success',
      message: 'Data berhasil disimpan ke sheet masing-masing',
      details: results
    });
    
  } catch (err) {
    return createResponse({ status: 'error', message: err.toString() });
  }
}

// ==== FUNGSI BARU UNTUK MENGAMBIL RIWAYAT / HISTORY ====
function getRiwayat(params) {
  try {
    const userId = params.userId; // User ID dikirim dari frontend untuk filtering spesifik jika diinginkan
    const ss = SpreadsheetApp.openById(SHEET_ID);
    
    const sheetsToRead = [
      { name: 'ruang_bangunan', title: 'Ruang Bangunan' },
      { name: 'pengolahan_limbah', title: 'Pengolahan Limbah' },
      { name: 'toilet', title: 'Kebersihan Toilet' },
      { name: 'reservoir', title: 'Kebersihan Bak Reservoir' },
      { name: 'gizi', title: 'Ceklist Gizi' }
    ];
    
    let allData = [];
    
    sheetsToRead.forEach(s => {
      let sheet = ss.getSheetByName(s.name);
      if (sheet) {
        const data = sheet.getDataRange().getValues();
        
        // Mulai dari i=1 untuk melewati header di baris ke-0
        for (let i = 1; i < data.length; i++) {
          const row = data[i];
          
          if (!row || row.length === 0 || !row[0]) continue; // Skip jika kosong
          
          const rowUserId = row[4];   // Kolom ke-5: User ID
          const rowTanggal = row[1];  // Kolom ke-2: Tanggal
          const rowPetugas = row[2];  // Kolom ke-3: Petugas
          const rowLokasi = row[3];   // Kolom ke-4: Lokasi
          
          // Total, Persentase, dan Maksimal selalu berada di 3 kolom paling akhir
          const rowLength = row.length;
          const total = row[rowLength - 3] || 0;
          const persentase = row[rowLength - 2] || 0;
          const maksimal = row[rowLength - 1] || 0;
          
          // Pengecekan user untuk filter data spesifik (jika ada param userId)
          // Frontend memfilter ini juga, tapi bagus dilakukan di Backend
          if (!userId || rowUserId == userId) {
            allData.push({
              id: `${s.name}_${i}`,
              tanggal: rowTanggal,
              formName: s.title,
              lokasi: rowLokasi,
              petugas: rowPetugas,
              userId: rowUserId,
              nilai: total,
              persentase: persentase,
              maksimal: maksimal
            });
          }
        }
      }
    });
    
    // Sort array history berdasarkan tanggal secara mengecil (terbaru duluan)
    allData.sort(function(a, b) {
      return new Date(b.tanggal).getTime() - new Date(a.tanggal).getTime();
    });
    
    // Kembalikan outputnya secara langsung karena fetch default frontend me-render json langsung
    return createResponse(allData);
    
  } catch (err) {
    return createResponse({ status: 'error', message: err.toString() });
  }
}
// ========================================================


function createResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// Fungsi untuk membuat semua sheet sekaligus dengan kolom Total dan Persentase
function setupAllSheets() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  
  // Daftar sheet yang akan dibuat
  const sheets = [
    {
      name: 'ruang_bangunan',
      headers: [
        'Timestamp','Tanggal', 'Petugas', 'Lokasi', 'User ID',
        'Dinding bersih, tidak retak, tidak lembab',
        'Lantai rata, tidak licin, mudah dibersihkan',
        'Tidak ada genangan air',
        'Plafon utuh, tidak bocor',
        'Tidak ada jamur pada plafon',
        'Sudut ruangan mudah dibersihkan',
        'Udara ruangan tidak pengap',
        'Lantai dibersihkan rutin',
        'Terdapat Tempat Sampah',
        'Tidak ada serangga/tikus',
        'Toilet bersih & berfungsi',
        'Sudut konus antara lantai dan dinding',
        'Total', 'Persentase', 'Maksimal'
      ]
    },
    {
      name: 'pengolahan_limbah',
      headers: [
        'Timestamp','Tanggal', 'Petugas', 'Lokasi', 'User ID',
        'Tersedia tempat sampah sesuai kode warna (infeksius, non medis, tajam, farmasi)',
        'Kantong plastik sesuai standar warna limbah medis',
        'Limbah tajam dibuang ke safety box',
        'Tidak ada pencampuran limbah medis & domestik',
        'Tempat sampah memiliki penutup',
        'Tempat sampah dalam kondisi Bersih',
        'Tempat sampah dalam kondisi Baik',
        'Tidak ada bau menyengat',
        'Tidak ada vektor (lalat/tikus)',
        'Troli tertutup',
        'Troli dibersihkan setelah digunakan',
        'Troli dalam kondisi baik',
        'Troli dilapisi kantong sesuai jenis limbah',
        'Total', 'Persentase', 'Maksimal'
      ]
    },
    {
      name: 'toilet',
      headers: [
        'Timestamp','Tanggal', 'Petugas', 'Lokasi', 'User ID',
        'Lantai bersih',
        'SPAL tidak tersumbat',
        'tidak terdapat lawa-lawa',
        'Closet tidak tersumbat dan bersih',
        'Bak Air bersih',
        'Bak Air Tidak retak/pecah',
        'tidak terdapat jentik',
        'ventilasi bersih',
        'tidak ditemukan serangga',
        'terdapat tempat sampah',
        'saluran air bersih tidak bocor',
        'SPAL memiliki penutup',
        'memiliki Sabun cuci tangan',
        'Kloset dalam keadaan baik (memiliki penutup untuk kloset duduk, penampung air untuk bilas)',
        'Total', 'Persentase', 'Maksimal'
      ]
    },
    {
      name: 'reservoir',
      headers: [
        'Timestamp','Tanggal', 'Petugas', 'Lokasi', 'User ID',
        'bak tidak bocor',
        'tidak terdapat genangan air, sampah, lumpur disekitar reservoir',
        'bak tidak berlumut',
        'bak air dalam keadaan bersih (tidak terdapat endapan)',
        'perpipaan tidak bocor',
        'perpipaan tidak korosif',
        'terdapat penutup reservoir',
        'penutup reservoir dalam keadaan baik',
        'tidak terdapat cela terbuka pada bak reservoir',
        'Total', 'Persentase', 'Maksimal'
      ]
    },
    {
      name: 'gizi',
      headers: [
        'Timestamp','Tanggal', 'Petugas', 'Lokasi', 'User ID',
        'Pembuangan air limbah dilengkapi grease trap',
        'Lantai dan dinding bersih, tidak retak dan tidak licin',
        'Memiliki ruang kantor terpisah dari ruang pengolahan makanan',
        'Terdapat penangkap asap/ cerobong',
        'Fasilitas pencucian dalam kondisi baik dan bersih',
        'Setiap peralatan dobersihkan dengan kaporit atau air panas 80 Celcius',
        'Setiap ruang pengolahan makanan harus ada minimal 1 tempat cuci tangan',
        'Tersedia lemari penyimpanan dingin suhu 5 - 10 Celcius',
        'Ruang tempat pengolahan makanan terpisah dari ruang tempat penyimpanan bahan makanan',
        'Karyawan dalam kondisi sehat',
        'Menggunakan APD',
        'Pakaian bersih, kuku terpotong dan tidak menggunakan cat kuku serta perhiasan',
        'Total', 'Persentase', 'Maksimal'
      ]
    }
  ];
  
  const results = [];
  
  sheets.forEach(sheetConfig => {
    let sheet = ss.getSheetByName(sheetConfig.name);
    if (sheet) {
      ss.deleteSheet(sheet);
    }
    sheet = ss.insertSheet(sheetConfig.name);
    sheet.getRange(1, 1, 1, sheetConfig.headers.length).setValues([sheetConfig.headers]);
    sheet.getRange(1, 1, 1, sheetConfig.headers.length).setFontWeight('bold');
    results.push(`Sheet ${sheetConfig.name} dibuat dengan ${sheetConfig.headers.length} kolom`);
  });
  
  return createResponse({ 
    status: 'success', 
    message: 'Semua sheet berhasil dibuat',
    details: results
  });
}

// TAMBAHKAN FUNGSI INI UNTUK GANTI PASSWORD
function changePassword(params) {
  try {
    const username = params.username;
    const userId = params.userId;
    const oldPassword = params.oldPassword;
    const newPassword = params.newPassword;
    
    // Validasi input
    if (!username || !userId || !oldPassword || !newPassword) {
      return createResponse({ 
        status: 'error', 
        message: 'Data tidak lengkap' 
      });
    }
    
    if (newPassword.length < 6) {
      return createResponse({ 
        status: 'error', 
        message: 'Password minimal 6 karakter' 
      });
    }
    
    const ss = SpreadsheetApp.openById(SHEET_ID);
    const sheet = ss.getSheetByName('users');
    
    if (!sheet) {
      return createResponse({ status: 'error', message: 'Sheet users tidak ditemukan' });
    }
    
    const data = sheet.getDataRange().getValues();
    let userFound = false;
    let userRow = -1;
    
    // Cari user berdasarkan username (kolom B) atau ID (kolom A)
    for (let i = 1; i < data.length; i++) {
      const rowId = data[i][0].toString(); // Kolom A (ID)
      const rowUsername = data[i][1]; // Kolom B (username)
      
      if (rowUsername === username || rowId === userId.toString()) {
        userFound = true;
        userRow = i + 1; // Baris di sheet (1-based)
        
        // Verifikasi password lama (kolom C)
        const currentPassword = data[i][2];
        if (currentPassword !== oldPassword) {
          return createResponse({ 
            status: 'error', 
            message: 'Password saat ini salah' 
          });
        }
        
        break;
      }
    }
    
    if (!userFound) {
      return createResponse({ status: 'error', message: 'User tidak ditemukan' });
    }
    
    // Update password baru (kolom C = kolom 3)
    sheet.getRange(userRow, 3).setValue(newPassword);
    
    return createResponse({ 
      status: 'success', 
      message: 'Password berhasil diubah'
    });
    
  } catch (err) {
    return createResponse({ status: 'error', message: err.toString() });
  }
}
