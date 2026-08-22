# PRD Final — Fitur Rekap Limbah INSAN-J

## 1. Nama Fitur

**Rekap Limbah**

Fitur untuk menampilkan rekapitulasi **limbah yang dihasilkan, limbah yang diangkut, dan sisa/akumulasi limbah** berdasarkan data yang sudah ada di INSAN-J.

Fitur ini juga menyediakan **cetak laporan rekap limbah**.

> **Penting:** fitur ini hanya mengolah data yang sudah tersedia. Tidak membuat proses input limbah baru.

---

# 2. Tujuan

Fitur Rekap Limbah harus memungkinkan pengguna untuk mengetahui dengan cepat:

* Berapa limbah yang dihasilkan setiap bulan.
* Berapa limbah yang diangkut setiap bulan.
* Berapa sisa/akumulasi limbah setiap bulan.
* Berapa total timbulan dalam periode tertentu.
* Berapa total limbah yang diangkut.
* Berapa sisa limbah pada akhir periode.
* Mencetak data tersebut sebagai laporan.

---

# 3. Prinsip Utama

Rekap Limbah **bukan sumber data baru**.

Data harus dihitung dari data yang sudah ada di aplikasi.

```text
DATA LIMBAH DIHASILKAN
        +
DATA PENGANGKUTAN
        ↓
   PERHITUNGAN
        ↓
   REKAP LIMBAH
        ↓
      CETAK
```

Jangan membuat tabel database baru hanya untuk menyimpan hasil rekap apabila seluruh angka dapat dihitung dari data sumber yang sudah tersedia.

---

# 4. Posisi Fitur pada Aplikasi

Tambahkan **Rekap Limbah sebagai menu utama di Sidebar**.

Struktur menu:

```text
Dashboard

Limbah Dihasilkan
Pengangkutan Limbah
Rekap Limbah
Form Inspeksi

Riwayat Inspeksi
...

Setting Akun
```

Route:

```text
/rekap-limbah
```

Gunakan pola routing dan struktur aplikasi yang sudah ada.

**Jangan mengubah struktur routing existing.**

---

# 5. Fitur Existing yang Tidak Boleh Diubah

Implementasi Rekap Limbah harus bersifat **additive**.

Jangan menghapus, mengganti, atau merusak:

* Dashboard
* Limbah Dihasilkan
* Data Limbah
* Limbah per Ruangan
* Pengangkutan Limbah
* Form Inspeksi
* Riwayat Inspeksi
* Login/authentication
* Role Admin/User
* Setting Akun
* Tombol cetak Data Limbah
* Tombol cetak Limbah per Ruangan
* Template cetak yang sudah ada
* Struktur database existing yang tidak berkaitan langsung dengan fitur baru

Tombol cetak pada **Data Limbah** dan **Limbah per Ruangan** tetap berfungsi seperti sebelumnya.

---

# 6. Perbedaan Fungsi Cetak

Fitur cetak existing **tidak digabungkan** dengan cetak Rekap Limbah.

### Data Limbah

Digunakan untuk mencetak data operasional/detail limbah.

### Limbah per Ruangan

Digunakan untuk mencetak data limbah berdasarkan ruangan.

### Rekap Limbah

Digunakan untuk mencetak **laporan rekapitulasi pengelolaan limbah**.

Dengan demikian ketiga fungsi cetak memiliki tujuan yang berbeda.

---

# 7. Sumber Data

Rekap Limbah mengambil data dari sumber yang sudah digunakan aplikasi.

### Data Limbah Dihasilkan

Digunakan untuk mendapatkan:

**Timbulan Limbah**

### Data Pengangkutan

Digunakan untuk mendapatkan:

**Limbah yang Diangkut**

### Data historis

Digunakan untuk menentukan:

**Sisa/Akumulasi Limbah**

Jangan membuat user memasukkan angka timbulan atau pengangkutan sekali lagi pada halaman Rekap Limbah.

---

# 8. Logika Perhitungan

Gunakan rumus:

```text
Sisa Akhir =
Sisa Awal
+ Limbah Dihasilkan
- Limbah Diangkut
```

Kemudian:

```text
Sisa Awal Bulan Berikutnya =
Sisa Akhir Bulan Sebelumnya
```

Contoh:

| Bulan    | Sisa Awal | Timbulan | Diangkut | Sisa Akhir |
| -------- | --------: | -------: | -------: | ---------: |
| Januari  |         0 | 3.850 kg | 3.500 kg |     350 kg |
| Februari |    350 kg | 4.259 kg | 3.800 kg |     809 kg |
| Maret    |    809 kg | 4.125 kg | 3.900 kg |   1.034 kg |

Contoh perhitungan Februari:

```text
350 + 4.259 - 3.800 = 809 kg
```

---

# 9. Penentuan Sisa Awal

Sistem harus menggunakan data historis yang tersedia untuk menentukan **sisa awal periode**.

Jangan selalu menganggap sisa awal = 0.

Contoh:

Jika sebelum Januari 2026 masih terdapat akumulasi 1.000 kg, maka:

```text
Sisa Awal Januari 2026 = 1.000 kg
```

Jika memang tidak terdapat data historis sebelum periode tersebut, sistem dapat menggunakan 0 kg sesuai kondisi data.

---

# 10. Halaman Rekap Limbah

Halaman tidak menggunakan grafik.

**Grafik tetap berada di Dashboard.**

Halaman Rekap hanya fokus pada:

1. Filter periode
2. Summary
3. Tabel rekap
4. Cetak laporan

---

# 11. Header Halaman

Tampilkan:

**Rekap Limbah**

Subjudul:

> Rekapitulasi timbulan, pengangkutan, dan akumulasi limbah.

---

# 12. Filter

Minimal tersedia:

### Tahun

Contoh:

```text
[ 2026 ▼ ]
```

### Periode

Contoh:

```text
[ Semua Bulan ▼ ]
```

Pilihan:

```text
Semua Bulan
Januari
Februari
Maret
April
Mei
Juni
Juli
Agustus
September
Oktober
November
Desember
```

Tampilan filter harus menggunakan Bahasa Indonesia.

---

# 13. Summary Cards

Tampilkan empat summary.

### 1. Total Timbulan

Total limbah yang dihasilkan pada periode yang dipilih.

```text
25.761 kg
```

### 2. Total Diangkut

Total limbah yang diangkut pada periode yang dipilih.

```text
23.200 kg
```

### 3. Sisa/Akumulasi

Sisa akhir pada periode yang dipilih.

```text
2.561 kg
```

### 4. Rata-rata Timbulan

Rumus:

```text
Total Timbulan ÷ jumlah bulan yang memiliki data
```

Contoh:

```text
4.293,5 kg/bulan
```

---

# 14. Tabel Rekap Utama

Gunakan struktur:

|  No | Bulan     | Sisa Awal |   Timbulan |   Diangkut | Sisa Akhir |
| --: | --------- | --------: | ---------: | ---------: | ---------: |
|   1 | Januari   |      0 kg |   3.850 kg |   3.500 kg |     350 kg |
|   2 | Februari  |    350 kg |   4.259 kg |   3.800 kg |     809 kg |
|   3 | Maret     |    809 kg |   4.125 kg |   3.900 kg |   1.034 kg |
| ... | ...       |       ... |        ... |        ... |        ... |
|     | **TOTAL** |         — | **... kg** | **... kg** | **... kg** |

Kolom:

* No
* Bulan
* Sisa Awal
* Timbulan
* Diangkut
* Sisa Akhir

Semua nilai berat menggunakan **kg**.

---

# 15. Perhitungan Total

Untuk periode lebih dari satu bulan:

### Total Timbulan

```text
Σ seluruh timbulan
```

### Total Diangkut

```text
Σ seluruh pengangkutan
```

### Sisa/Akumulasi

Gunakan:

```text
Sisa akhir bulan terakhir
```

**Jangan menjumlahkan seluruh kolom Sisa Akhir**, karena itu akan menghasilkan angka yang salah.

---

# 16. Penanganan Data Kosong

Sistem harus membedakan:

```text
Tidak ada data
```

dan:

```text
0 kg
```

Jangan otomatis mengubah data yang tidak tersedia menjadi 0 kg tanpa dasar.

Contoh:

Jika Februari belum mempunyai data:

```text
Februari | Tidak ada data
```

bukan:

```text
Februari | 0 kg
```

kecuali database memang menyimpan nilai 0.

---

# 17. Aturan Tanggal Indonesia

**WAJIB.**

Seluruh implementasi tanggal pada fitur ini harus menggunakan konsep **tanggal kalender Indonesia**.

Format tampilan:

```text
DD/MM/YYYY
```

Contoh:

```text
01/01/2026
15/02/2026
31/08/2026
```

Nama bulan harus menggunakan Bahasa Indonesia:

```text
Januari
Februari
Maret
April
Mei
Juni
Juli
Agustus
September
Oktober
November
Desember
```

---

# 18. Penyimpanan vs Tampilan Tanggal

Jangan mengubah struktur/tipe tanggal database hanya demi format tampilan.

Gunakan alur:

```text
Database
   ↓
Tanggal asli
   ↓
Filtering/perhitungan
   ↓
Format Indonesia
   ↓
UI/PDF
```

Database tetap mengikuti struktur yang sudah digunakan aplikasi.

---

# 19. Larangan Parsing Tanggal Ambigu

Jangan menggunakan parsing JavaScript yang ambigu terhadap format:

```text
DD/MM/YYYY
```

Contoh:

```text
01/02/2026
```

harus selalu berarti:

> **1 Februari 2026**

bukan 2 Januari 2026.

Parsing tanggal harus dilakukan secara eksplisit dan konsisten.

---

# 20. Aturan Batas Periode

Filter tanggal harus bersifat **inclusive**.

Jika periode:

```text
01/08/2026 – 31/08/2026
```

maka:

```text
01/08/2026
```

**WAJIB masuk.**

dan:

```text
31/08/2026
```

**WAJIB masuk.**

Tidak boleh kehilangan data pada tanggal terakhir karena penggunaan operator `<` yang salah.

---

# 21. Tidak Boleh Ada Pergeseran Tanggal

Wajib mencegah masalah timezone.

Contoh yang tidak boleh terjadi:

```text
Database:
01/08/2026

UI:
31/07/2026
```

Tanggal pencatatan harus diperlakukan sebagai **calendar date**, bukan timestamp yang kemudian bergeser karena timezone.

Prinsip:

> Jika database mencatat 01 Agustus 2026, aplikasi harus selalu menampilkan 01 Agustus 2026.

---

# 22. Rekap Bulanan

Perhitungan bulan harus benar-benar berdasarkan tanggal kalender.

Contoh:

**Januari 2026**

```text
01/01/2026 – 31/01/2026
```

**Februari 2026**

```text
01/02/2026 – 28/02/2026
```

Untuk tahun kabisat, jumlah hari Februari harus mengikuti tahun tersebut.

Jangan menggunakan rentang tanggal tetap yang dapat menyebabkan data bulan berikutnya ikut masuk.

---

# 23. Cetak Rekap

Sediakan tombol:

**🖨 Cetak Rekap**

Cetak hanya data sesuai filter yang sedang dipilih.

Contoh pengguna memilih:

```text
Tahun: 2026
Periode: Januari–Juni
```

Maka PDF hanya menampilkan Januari–Juni 2026.

Tidak boleh memasukkan data Juli atau bulan lainnya.

---

# 24. Format PDF

PDF harus dibuat sebagai laporan resmi.

### Header

```text
REKAPITULASI PENGELOLAAN LIMBAH

RS Prof. Dr. W.Z. Johannes Kupang

Periode: Januari – Juni 2026
```

### Ringkasan

```text
Total Timbulan     : xxx kg
Total Diangkut     : xxx kg
Sisa/Akumulasi     : xxx kg
Rata-rata Timbulan : xxx kg/bulan
```

### Tabel

| No | Bulan | Sisa Awal | Timbulan | Diangkut | Sisa Akhir |
| -: | ----- | --------: | -------: | -------: | ---------: |

---

# 25. Format Tanggal PDF

Semua tanggal pada PDF menggunakan format Indonesia:

```text
01/01/2026
```

Bukan:

```text
2026-01-01
```

Jika periode ditampilkan dalam bentuk nama bulan:

```text
Januari – Juni 2026
```

Gunakan Bahasa Indonesia.

---

# 26. Error/Anomali Data

Jika perhitungan menghasilkan:

```text
Sisa Akhir < 0
```

jangan otomatis mengubah angka menjadi 0.

Sistem harus memberikan indikasi bahwa terdapat ketidaksesuaian data.

Contoh:

> ⚠️ Terdapat ketidaksesuaian antara data timbulan dan pengangkutan. Periksa kembali data sumber.

Jangan mengubah data sumber secara otomatis.

---

# 27. Konsistensi Data

Rekap harus menggunakan sumber data yang sama dengan halaman existing.

Jangan menggunakan:

* hardcoded data
* dummy data
* data sementara
* data dari localStorage sebagai sumber utama
* state Dashboard sebagai sumber utama

Sumber utama harus berasal dari data aplikasi/database yang sudah ada.

Tujuannya agar:

```text
Refresh
↓
Logout/Login
↓
Buka kembali aplikasi
↓
Rekap tetap sama
```

selama data sumber tidak berubah.

---

# 28. Responsiveness

Halaman harus tetap dapat digunakan pada:

* Desktop
* Tablet
* Mobile

Tabel boleh menggunakan horizontal scrolling pada layar kecil.

Jangan memaksa seluruh kolom menjadi terlalu sempit sehingga angka sulit dibaca.

---

# 29. UI/UX

Gunakan gaya visual yang sudah digunakan INSAN-J.

Jangan membuat desain baru yang bertentangan dengan desain existing.

Prioritas:

1. Mudah dibaca.
2. Angka mudah ditemukan.
3. Tabel tidak terlalu padat.
4. Filter mudah digunakan.
5. Tombol cetak mudah ditemukan.
6. Responsive.
7. Konsisten dengan Dashboard dan halaman existing.

---

# 30. Acceptance Criteria

Fitur dinyatakan selesai apabila:

* [ ] Menu **Rekap Limbah** tersedia di Sidebar.
* [ ] Route `/rekap-limbah` tersedia.
* [ ] Halaman Rekap Limbah tidak memiliki grafik.
* [ ] Grafik existing tetap berada di Dashboard.
* [ ] Data rekap berasal dari data existing.
* [ ] Tidak ada input data baru khusus untuk rekap.
* [ ] Timbulan bulanan dapat dihitung.
* [ ] Pengangkutan bulanan dapat dihitung.
* [ ] Sisa awal dapat dihitung.
* [ ] Sisa akhir dapat dihitung.
* [ ] Sisa akhir bulan menjadi sisa awal bulan berikutnya.
* [ ] Total timbulan benar.
* [ ] Total pengangkutan benar.
* [ ] Sisa akhir periode benar.
* [ ] Rata-rata timbulan benar.
* [ ] Filter tahun berfungsi.
* [ ] Filter periode berfungsi.
* [ ] Data hanya masuk sesuai periode yang dipilih.
* [ ] Tidak ada data sebelum periode yang ikut masuk.
* [ ] Tidak ada data setelah periode yang ikut masuk.
* [ ] Tanggal awal periode ikut dihitung.
* [ ] Tanggal akhir periode ikut dihitung.
* [ ] Format tanggal UI menggunakan `DD/MM/YYYY`.
* [ ] Format tanggal PDF menggunakan `DD/MM/YYYY`.
* [ ] Nama bulan menggunakan Bahasa Indonesia.
* [ ] Tidak terjadi pergeseran tanggal akibat timezone.
* [ ] Tidak menggunakan parsing tanggal ambigu.
* [ ] Data kosong tidak otomatis dianggap 0 tanpa dasar.
* [ ] Data anomali tidak otomatis diubah.
* [ ] Tombol Cetak Rekap berfungsi.
* [ ] PDF hanya mencetak periode yang dipilih.
* [ ] PDF memiliki format laporan yang rapi.
* [ ] Tombol cetak existing tetap berfungsi.
* [ ] Dashboard tidak rusak.
* [ ] Data Limbah tidak rusak.
* [ ] Limbah per Ruangan tidak rusak.
* [ ] Pengangkutan tidak rusak.
* [ ] Authentication tidak berubah.
* [ ] Role Admin/User tidak berubah.
* [ ] Tidak terjadi duplikasi data.
* [ ] Refresh halaman tidak menyebabkan rekap berubah/hilang.
* [ ] Logout/login tidak menyebabkan rekap berubah/hilang.

---

# 31. Batasan Implementasi

**Jangan melakukan refactor besar-besaran.**

Implementasikan fitur dengan prinsip:

> **Tambahkan fitur, jangan mengubah arsitektur existing kecuali benar-benar diperlukan.**

Jangan:

* Mengganti library existing tanpa alasan.
* Mengubah struktur database yang tidak diperlukan.
* Mengubah komponen Dashboard.
* Mengubah sistem autentikasi.
* Mengubah sistem input limbah.
* Mengubah sistem pengangkutan.
* Menghapus template cetak existing.
* Membuat sumber data duplikat.

Jika menemukan kebutuhan perubahan pada struktur existing, **identifikasi terlebih dahulu dan gunakan perubahan seminimal mungkin.**

---

# 32. Konsep Akhir

```text
                    INSAN-J
                       │
       ┌───────────────┼────────────────┐
       │               │                │
   Dashboard      Operasional        Laporan
       │               │                │
   Grafik         Data Limbah      REKAP LIMBAH
   Monitoring     Pengangkutan          │
                  Per Ruangan            │
                                        ├── Timbulan
                                        ├── Diangkut
                                        ├── Sisa Awal
                                        ├── Sisa Akhir
                                        ├── Filter Periode
                                        └── Cetak PDF
```

### Prinsip paling penting

**Dashboard → melihat kondisi.**

**Data Limbah → mencatat timbulan.**

**Pengangkutan → mencatat limbah keluar.**

**Rekap Limbah → menghitung dan melaporkan hasil akhirnya.**

**Cetak Rekap → menghasilkan laporan resmi.**

**Tidak ada grafik tambahan di Rekap Limbah.**

**Tidak ada input ulang data.**

**Tanggal harus akurat secara kalender Indonesia dan tidak boleh bergeser, kurang, ataupun lebih dari periode yang dipilih.**
