## Ringkasan kandidat refactor

| File | Masalah | Rekomendasi |
|---|---|---|
| **`src/pages/Inspeksi.jsx`** | `handleSubmit` punya ~150 baris if/else yang hardcode mapping `formDataState` → kolom DB, padahal `CHECKLIST_ITEMS` di `constants.js` **sudah punya `dbCol`** untuk tiap item — datanya duplikat sia-sia | Jadikan loop generik berbasis `dbCol` (kode di bawah) |
| **`src/pages/KelolaAdmin.jsx`** (~500 baris) | 3 tab (Pengguna, Ruangan, Pengaturan) menyatu dalam 1 file | Split jadi `components/kelola-admin/{PenggunaTab,RuanganTab,PengaturanTab}.jsx`, ikuti pola yang sudah dipakai di `components/limbah/*` |
| **`src/pages/PengangkutanLimbah.jsx`** | Satu-satunya modul limbah yang belum di-split (LimbahPadat/Ruangan/Anorganik sudah punya Form/Table/Toolbar terpisah) | Buat `components/limbah/pengangkutan/{PengangkutanForm,PengangkutanTable,PengangkutanImportExportToolbar}.jsx` |
| **`src/pages/Riwayat.jsx`** | Logic `fetchRiwayat` (5 query paralel + transform) nempel di komponen | Extract ke `hooks/useRiwayat.js` |
| **Dashboard / TabPengangkutan / TabJenisLimbah** | Query Supabase ke `limbah_padat` + `limbah_ruangan` diduplikasi di 3 tempat berbeda dengan logic akumulasi mirip | Extract ke `lib/wasteQueries.js` (misal `fetchCombinedLimbah(dateRange)`) |
| **`lib/api.js`** | Sudah cukup layered (settings, ruangan cache terpisah) — OK, tidak perlu diubah | — |

Yang paling **worth dikerjakan duluan** adalah `Inspeksi.jsx`, karena rawan bug (typo kolom) dan setiap tambah 1 item checklist harus edit 2 tempat (constants + handleSubmit). Ini kode finalnya:

## 1. `src/lib/constants.js` — tambahkan `table` pada `AVAILABLE_FORMS`

```javascript
export const AVAILABLE_FORMS = [
  { id: 'ruang_bangunan', name: 'Ruang Bangunan', icon: '🏢', color: 'blue', table: 'ruang_bangunan' },
  { id: 'pengolahan_limbah', name: 'Pengolahan Limbah', icon: '🗑️', color: 'green', table: 'limbah_medis' },
  { id: 'toilet', name: 'Kebersihan Toilet', icon: '🚽', color: 'purple', table: 'pemeriksaan_toilet' },
  { id: 'reservoir', name: 'Kebersihan Bak Reservoir', icon: '💧', color: 'yellow', table: 'pemeriksaan_reservoir' },
  { id: 'gizi', name: 'Ceklist Gizi', icon: '🍽️', color: 'gray', table: 'pemeriksaan_gizi' }
];

// ...CHECKLIST_ITEMS tetap sama, tidak perlu diubah (dbCol sudah ada)
```

## 2. `src/pages/Inspeksi.jsx` — ganti `handleSubmit`

Cari blok besar `const insertionPromises = selectedForms.map(async formId => { ... })` (dari `if (formId === 'ruang_bangunan') { ... }` sampai penutup `if (tableName) { ... }`), lalu **ganti seluruhnya** dengan:

```javascript
      const insertionPromises = selectedForms.map(async formId => {
        const items = CHECKLIST_ITEMS[formId] || [];
        const formInfo = AVAILABLE_FORMS.find(f => f.id === formId);
        const tableName = formInfo?.table;
        if (!tableName) return;

        let totalNilai = 0;
        const maksimalNilai = items.length * 10;

        const insertData = {
          waktu_input: new Date().toISOString(),
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

        if (!navigator.onLine) {
          saveToOfflineQueue(tableName, 'insert', insertData, `Inspeksi ${selectedCategoriesText}`);
        } else {
          const { error } = await supabase.from(tableName).insert([insertData]);
          if (error) throw new Error(`Gagal menyimpan ${tableName}: ` + error.message);
        }
      });
```

Dan pastikan import di atas file sudah termasuk `AVAILABLE_FORMS` (sudah ada di baris `import { AVAILABLE_FORMS, CHECKLIST_ITEMS } from '../lib/constants';`, jadi tidak perlu diubah).