# Pemisahan modul limbah

Dasar perubahan: `main` pada commit `6f8cd9b581008ee3bd23ff581e9be6c5c6ac5a0d`.
Perubahan disiapkan di `refactor/limbah-modular-20260828`, bukan langsung di `main`.

## Tanggung jawab modul

| Modul | Tanggung jawab |
| --- | --- |
| `src/pages/Limbah*.jsx` | Menyusun komponen tampilan dan menghubungkan hook |
| `src/hooks/limbah/use*Data.js` | Data tabel, filter, pagination, cache/offline overlay, dan langganan event |
| `src/hooks/limbah/use*Form.js` | State formulir, validasi, input, edit, hapus, konflik versi, dan antrean offline |
| `src/hooks/limbah/usePadatReports.js` | Cetak, ekspor, template, dan impor limbah padat |
| `src/hooks/limbah/useRuanganReports.js` | Cetak, ekspor, template, dan impor limbah ruangan |
| `src/lib/limbah/anorganikReport.js` | Cetak anorganik, tanpa menambah fitur Excel baru |
| `src/lib/limbah/padatData.js` | Pengambilan sumber padat/ruangan dan penggabungan perubahan offline |
| `src/lib/limbah/padatAggregation.js` | Perhitungan akumulasi harian beserta referensi record manual |
| `src/lib/limbah/ruanganDistribution.js` | Pembagian dua desimal, sisa pembulatan ke tanggal terakhir |
| `src/lib/limbah/rowOrder.js` | Urutan tanggal dan waktu input yang sesuai dengan query server |
| `src/lib/limbah/constants.js` | Ukuran halaman dan batch bersama |

## Perilaku yang dipertahankan

- Komponen form/tabel, JSX utama halaman, dan hasil CSS tidak diubah.
- Kolom query, batas periode, pengurutan, dan pagination tetap sama.
- Pembaruan data dibatasi event tabel terkait; debounce sinkronisasi tetap 180 ms.
- Draft lokal tetap memeriksa pemetaan ID setelah sinkronisasi.
- Edit terbaru tetap menunggu antrean terdahulu dan memeriksa versi record.
- Antrean edit hanya dibersihkan setelah operasi server yang bersangkutan berhasil.
- Distribusi ruangan tetap menggunakan batch antrean dan mempertahankan pilihan
  tanggal distribusi untuk input berikutnya.
- Akumulasi padat tetap membedakan sumber ruangan dari input manual. Edit/hapus
  pada tabel akumulasi tidak dialihkan ke record ruangan.
- Validasi bilangan bulat untuk jerigen, validasi Excel, serta transaksi impor
  tetap menggunakan perilaku sebelumnya.
- `offlineStorage.js`, `recordVersion.js`, service worker, skema Supabase, RLS,
  dan Edge Functions tidak diubah.

Fungsi pengambilan data ruangan/padat dibungkus `useCallback` agar dependensi
effect eksplisit tanpa meminta ulang data saat state formulir berubah.
Pembersihan iframe cetak membaca ref terakhir saat hook dilepas.

## Verifikasi

Jalankan dari direktori proyek:

```sh
npm test
npm run build
npm run lint
```

`npm test` menggunakan test runner bawaan Node dan tidak memerlukan akun atau
database. Tes mencakup pembulatan distribusi, konservasi total untuk 1–31 hari,
akumulasi manual/ruangan, metadata edit, dan urutan draft/server.

Pada pengerjaan refaktor, 61 skenario simulasi dibandingkan dengan kode dasar:
input online/offline, jaringan gagal, ID draft setelah sinkron, edit berantre,
konflik, pembatalan/gagal hapus, filter dan pagination, pembatasan UI mahasiswa,
distribusi, cetak, serta impor/ekspor Excel. Simulasi memakai backend dan hook
runner tiruan; bukan bukti pengujian React di browser atau Supabase nyata.

Build lulus. Lint menghasilkan 0 error dan 144 peringatan (sebelumnya 147).
Uji browser lokal terhalang akses browser pada lingkungan pengerjaan.

## Sebelum digabung ke main

Uji branch ini di deployment preview dengan record uji yang dapat dikenali:

1. Input, edit, hapus, ganti filter, dan pindah halaman pada ketiga fitur.
2. Matikan koneksi, input/edit draft, lalu sambungkan kembali dan pastikan
   sinkronisasi tidak menggandakan atau menimpa nilai terbaru.
3. Coba distribusi beberapa tanggal; cocokkan total dan pilihan yang dipertahankan.
4. Coba campuran data ruangan dan manual pada akumulasi padat.
5. Periksa hasil cetak/Excel, validasi impor, akun mahasiswa, serta tampilan HP.

Jangan gabungkan ke `main` sebelum pengujian perangkat dan persetujuan pemilik.
