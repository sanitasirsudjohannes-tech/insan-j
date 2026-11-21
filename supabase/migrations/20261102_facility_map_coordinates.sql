-- Koordinat peta untuk master ruangan dan lokasi air bersih.
-- Jalankan satu kali melalui Supabase Dashboard > SQL Editor.

alter table public.ruangan
  add column if not exists latitude double precision,
  add column if not exists longitude double precision;

alter table public.water_clean_locations
  add column if not exists latitude double precision,
  add column if not exists longitude double precision;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'ruangan_latitude_range'
      and conrelid = 'public.ruangan'::regclass
  ) then
    alter table public.ruangan
      add constraint ruangan_latitude_range
      check (latitude is null or latitude between -90 and 90);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'ruangan_longitude_range'
      and conrelid = 'public.ruangan'::regclass
  ) then
    alter table public.ruangan
      add constraint ruangan_longitude_range
      check (longitude is null or longitude between -180 and 180);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'ruangan_coordinates_pair'
      and conrelid = 'public.ruangan'::regclass
  ) then
    alter table public.ruangan
      add constraint ruangan_coordinates_pair
      check (
        (latitude is null and longitude is null)
        or (latitude is not null and longitude is not null)
      );
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'water_clean_locations_latitude_range'
      and conrelid = 'public.water_clean_locations'::regclass
  ) then
    alter table public.water_clean_locations
      add constraint water_clean_locations_latitude_range
      check (latitude is null or latitude between -90 and 90);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'water_clean_locations_longitude_range'
      and conrelid = 'public.water_clean_locations'::regclass
  ) then
    alter table public.water_clean_locations
      add constraint water_clean_locations_longitude_range
      check (longitude is null or longitude between -180 and 180);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'water_clean_locations_coordinates_pair'
      and conrelid = 'public.water_clean_locations'::regclass
  ) then
    alter table public.water_clean_locations
      add constraint water_clean_locations_coordinates_pair
      check (
        (latitude is null and longitude is null)
        or (latitude is not null and longitude is not null)
      );
  end if;
end;
$$;

-- Mahasiswa membutuhkan nama lokasi air bersih untuk melihat marker peta.
drop policy if exists "water locations readable by mahasiswa" on public.water_clean_locations;
create policy "water locations readable by mahasiswa" on public.water_clean_locations
for select to authenticated using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and lower(trim(p.role)) = 'mahasiswa'
  )
);

-- Pastikan seluruh pengguna login dapat membaca nama ruangan untuk peta.
-- Policy ini bersifat permisif sehingga tidak menghapus policy lama.
drop policy if exists "ruangan readable for facility map" on public.ruangan;
create policy "ruangan readable for facility map" on public.ruangan
for select to authenticated using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and lower(trim(p.role)) in ('admin', 'petugas', 'user', 'mahasiswa')
  )
);

create or replace function public.set_ruangan_map_coordinates(
  target_id uuid,
  new_latitude double precision,
  new_longitude double precision
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and lower(trim(p.role)) = 'admin'
  ) then
    raise exception 'Hanya administrator yang dapat mengubah titik peta.';
  end if;

  if (new_latitude is null) <> (new_longitude is null) then
    raise exception 'Latitude dan longitude harus diisi bersamaan.';
  end if;

  if new_latitude is not null and (
    new_latitude < -90 or new_latitude > 90
    or new_longitude < -180 or new_longitude > 180
  ) then
    raise exception 'Koordinat tidak valid.';
  end if;

  update public.ruangan
  set latitude = new_latitude, longitude = new_longitude
  where id = target_id;

  if not found then
    raise exception 'Ruangan tidak ditemukan.';
  end if;
end;
$$;

create or replace function public.set_clean_water_location_map_coordinates(
  target_id uuid,
  new_latitude double precision,
  new_longitude double precision
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and lower(trim(p.role)) = 'admin'
  ) then
    raise exception 'Hanya administrator yang dapat mengubah titik peta.';
  end if;

  if (new_latitude is null) <> (new_longitude is null) then
    raise exception 'Latitude dan longitude harus diisi bersamaan.';
  end if;

  if new_latitude is not null and (
    new_latitude < -90 or new_latitude > 90
    or new_longitude < -180 or new_longitude > 180
  ) then
    raise exception 'Koordinat tidak valid.';
  end if;

  update public.water_clean_locations
  set latitude = new_latitude, longitude = new_longitude, updated_at = now()
  where id = target_id;

  if not found then
    raise exception 'Lokasi air bersih tidak ditemukan.';
  end if;
end;
$$;

revoke all on function public.set_ruangan_map_coordinates(uuid, double precision, double precision) from public;
revoke all on function public.set_ruangan_map_coordinates(uuid, double precision, double precision) from anon;
grant execute on function public.set_ruangan_map_coordinates(uuid, double precision, double precision) to authenticated;

revoke all on function public.set_clean_water_location_map_coordinates(uuid, double precision, double precision) from public;
revoke all on function public.set_clean_water_location_map_coordinates(uuid, double precision, double precision) from anon;
grant execute on function public.set_clean_water_location_map_coordinates(uuid, double precision, double precision) to authenticated;
