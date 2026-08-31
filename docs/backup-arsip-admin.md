# Backup & Arsip Admin INSAN-J

Fitur ini berada di branch `fitur/backup-arsip-admin`. Kode branch tidak
menjalankan migrasi atau deploy Edge Function secara otomatis.

## Isi fitur

- Preview jumlah data berdasarkan rentang tanggal dan jenis tabel.
- Paket ZIP berisi `manifest.json`, `backup.json`, dan Excel.
- SHA-256 keseluruhan backup dan setiap tabel.
- Riwayat backup dan audit aktivitas Admin.
- Restore bertahap dengan transaksi final seluruh tabel.
- Purge berdasarkan ID snapshot, bukan hanya tanggal.
- Deteksi record yang berubah setelah backup.
- Mode pemeliharaan server untuk menghentikan mutasi sementara.
- Penolakan draft lama yang mencoba masuk ke periode yang sudah dipurge.
- Cache server dibersihkan setelah restore/purge tanpa menghapus draft offline.

Tabel akun, `profiles`, `ruangan`, `app_settings`, dan Supabase Auth tidak pernah
masuk daftar backup/purge operasional.

## Pemasangan backend pengujian

1. Pastikan project Supabase mempunyai tabel operasional berikut:

   - `limbah_padat`
   - `limbah_ruangan`
   - `limbah_anorganik`
   - `pengangkutan_limbah`
   - `ruang_bangunan`
   - `limbah_medis`
   - `pemeriksaan_toilet`
   - `pemeriksaan_reservoir`
   - `pemeriksaan_gizi`

2. Jalankan isi migration berikut melalui Supabase SQL Editor:

   `supabase/migrations/202608310001_backup_arsip_admin.sql`

   Migrasi hanya menambah tabel, fungsi, trigger, dan setting. Tidak ada data
   operasional yang dihapus saat migrasi dipasang.

3. Deploy Edge Functions:

   ```bash
   npx supabase functions deploy admin-backup-data
   npx supabase functions deploy admin-restore-data
   npx supabase functions deploy admin-purge-data
   ```

   `SUPABASE_URL` dan `SUPABASE_SERVICE_ROLE_KEY` hanya digunakan di lingkungan
   Edge Function. Jangan menambah Service Role Key ke `.env` frontend/Vercel.

4. Buka preview deployment branch, masuk sebagai Admin, lalu buka
   **Kelola Admin → Backup & Arsip**.

## Urutan uji aman

Gunakan periode pendek dan data dummy terlebih dahulu.

1. Pastikan semua draft pada perangkat Admin sudah tersinkronisasi.
2. Klik **Periksa Data** dan catat jumlah setiap tabel.
3. Aktifkan **Mode Pemeliharaan**.
4. Coba input dari akun petugas. Server harus menolak input dengan pesan
   pemeliharaan dan data lama tidak boleh berubah.
5. Klik **Buat & Unduh Backup**.
6. Pastikan riwayat berubah menjadi **Terverifikasi**.
7. Simpan salinan file ZIP di dua lokasi aman.
8. Gunakan **Pulihkan Data** ketika data dummy masih ada. Semua record identik
   harus dilewati tanpa duplikasi.
9. Buat backup dummy baru, lalu klik **Hapus Data Backup Ini**.
10. Pastikan hanya ID yang berada dalam snapshot yang terhapus.
11. Unggah paket ZIP tersebut dan jalankan restore.
12. Cocokkan jumlah dan beberapa record sampel dengan isi Excel/JSON.
13. Nonaktifkan mode pemeliharaan dan pastikan input normal kembali.

## Perilaku kegagalan

- File rusak atau checksum berbeda: restore ditolak sebelum transaksi.
- ID sama dengan isi berbeda: seluruh restore dibatalkan.
- Record berubah/hilang setelah backup: seluruh purge dibatalkan.
- Salah satu tabel gagal dipulihkan/dihapus: transaksi database di-rollback.
- Draft offline: tidak dihapus. Sinkronisasi ditunda saat maintenance aktif.
- Draft untuk periode yang sudah dipurge: server menolak agar data arsip tidak
  muncul kembali tanpa disadari.

## Operasional produksi yang disarankan

1. Backup per tahun setelah seluruh input tahun tersebut selesai.
2. Simpan ZIP di laptop dan media/cloud privat kedua.
3. Uji restore sebelum menghapus data produksi.
4. Hapus berdasarkan arsip terverifikasi, bukan tombol hapus umum.
5. Nonaktifkan pemeliharaan segera setelah pekerjaan selesai.
6. Periksa ukuran database dan bloat setelah penghapusan besar. Jangan
   menjalankan `VACUUM FULL` saat jam kerja karena tabel dapat terkunci.

## Pemeriksaan metadata

```sql
select
  id,
  period_start,
  period_end,
  table_counts,
  status,
  file_name,
  file_size_bytes,
  created_at,
  verified_at,
  purged_at,
  restored_at
from public.data_archives
order by created_at desc;
```

```sql
select action, actor_id, archive_id, details, created_at
from public.admin_audit_logs
order by created_at desc
limit 100;
```
