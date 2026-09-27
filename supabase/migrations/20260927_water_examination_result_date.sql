-- Cegah tanggal hasil laboratorium lebih awal dari tanggal sampling.
alter table public.water_examinations
  drop constraint if exists water_examinations_result_date_check;

alter table public.water_examinations
  add constraint water_examinations_result_date_check
  check (resulted_at is null or resulted_at >= sampled_at) not valid;

-- NOT VALID tetap memeriksa insert/update baru tanpa menggagalkan migrasi
-- apabila database lama sudah memiliki tanggal historis yang tidak konsisten.
