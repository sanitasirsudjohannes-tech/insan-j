-- Jalankan satu kali melalui Supabase SQL Editor sebelum menguji fitur Pemeriksaan Air.
create extension if not exists pgcrypto;

create table if not exists public.water_clean_locations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint water_clean_locations_name_not_blank check (length(trim(name)) > 0)
);

create unique index if not exists water_clean_locations_name_unique
  on public.water_clean_locations (lower(trim(name)));

create table if not exists public.water_examinations (
  id uuid primary key default gen_random_uuid(),
  water_type text not null check (water_type in ('clean', 'wastewater')),
  clean_water_location_id uuid references public.water_clean_locations(id) on delete restrict,
  sample_point text check (sample_point in ('Inlet', 'Outlet')),
  sampled_at date not null,
  resulted_at date,
  laboratory text,
  report_number text,
  parameters jsonb not null default '[]'::jsonb,
  notes text,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint water_examinations_location_check check (
    (water_type = 'clean' and clean_water_location_id is not null and sample_point is null)
    or (water_type = 'wastewater' and clean_water_location_id is null and sample_point is not null)
  ),
  constraint water_examinations_parameters_array check (
    jsonb_typeof(parameters) = 'array' and jsonb_array_length(parameters) > 0
  )
);

create index if not exists water_examinations_sampled_at_idx on public.water_examinations (sampled_at desc);
create index if not exists water_examinations_type_date_idx on public.water_examinations (water_type, sampled_at desc);
create index if not exists water_examinations_location_idx on public.water_examinations (clean_water_location_id);

alter table public.water_clean_locations enable row level security;
alter table public.water_examinations enable row level security;

drop policy if exists "water locations readable by staff" on public.water_clean_locations;
create policy "water locations readable by staff" on public.water_clean_locations
for select to authenticated using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and lower(p.role) in ('admin', 'petugas', 'user'))
);

drop policy if exists "water locations managed by admin" on public.water_clean_locations;
create policy "water locations managed by admin" on public.water_clean_locations
for all to authenticated
using (exists (select 1 from public.profiles p where p.id = auth.uid() and lower(p.role) = 'admin'))
with check (exists (select 1 from public.profiles p where p.id = auth.uid() and lower(p.role) = 'admin'));

drop policy if exists "water examinations readable by staff" on public.water_examinations;
create policy "water examinations readable by staff" on public.water_examinations
for select to authenticated using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and lower(p.role) in ('admin', 'petugas', 'user'))
);

drop policy if exists "water examinations insertable by staff" on public.water_examinations;
create policy "water examinations insertable by staff" on public.water_examinations
for insert to authenticated with check (
  created_by = auth.uid()
  and exists (select 1 from public.profiles p where p.id = auth.uid() and lower(p.role) in ('admin', 'petugas', 'user'))
);

drop policy if exists "water examinations editable by staff" on public.water_examinations;
create policy "water examinations editable by staff" on public.water_examinations
for update to authenticated
using (exists (select 1 from public.profiles p where p.id = auth.uid() and lower(p.role) in ('admin', 'petugas', 'user')))
with check (exists (select 1 from public.profiles p where p.id = auth.uid() and lower(p.role) in ('admin', 'petugas', 'user')));

drop policy if exists "water examinations deletable by staff" on public.water_examinations;
create policy "water examinations deletable by staff" on public.water_examinations
for delete to authenticated using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and lower(p.role) in ('admin', 'petugas', 'user'))
);

grant select on public.water_clean_locations to authenticated;
grant insert, update, delete on public.water_clean_locations to authenticated;
grant select, insert, update, delete on public.water_examinations to authenticated;
