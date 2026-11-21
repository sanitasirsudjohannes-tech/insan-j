-- Jalankan di Supabase SQL Editor jika migrasi pemeriksaan air sebelumnya sudah dijalankan.
-- Kebijakan RESTRICTIVE berlaku bersama seluruh kebijakan lain; admin tidak dapat
-- menulis nilai pemeriksaan walaupun masih ada kebijakan lama yang permisif.
alter table public.water_examinations enable row level security;

drop policy if exists "water results insert only staff" on public.water_examinations;
create policy "water results insert only staff"
on public.water_examinations as restrictive for insert to authenticated
with check (
  created_by = auth.uid()
  and exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and lower(trim(p.role)) in ('petugas', 'user')
  )
);

drop policy if exists "water results update only staff" on public.water_examinations;
create policy "water results update only staff"
on public.water_examinations as restrictive for update to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and lower(trim(p.role)) in ('petugas', 'user')
  )
)
with check (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and lower(trim(p.role)) in ('petugas', 'user')
  )
);

drop policy if exists "water results delete only staff" on public.water_examinations;
create policy "water results delete only staff"
on public.water_examinations as restrictive for delete to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and lower(trim(p.role)) in ('petugas', 'user')
  )
);
