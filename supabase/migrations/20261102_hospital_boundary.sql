-- Batas luar rumah sakit untuk tampilan peta.
-- Jalankan satu kali melalui Supabase Dashboard > SQL Editor.

create table if not exists public.hospital_boundary (
  id smallint primary key default 1,
  points jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  constraint hospital_boundary_singleton check (id = 1),
  constraint hospital_boundary_points_array check (
    case
      when jsonb_typeof(points) = 'array' then jsonb_array_length(points) between 3 and 200
      else false
    end
  )
);

alter table public.hospital_boundary enable row level security;

drop policy if exists "hospital boundary readable by authenticated" on public.hospital_boundary;
create policy "hospital boundary readable by authenticated" on public.hospital_boundary
for select to authenticated using (true);

revoke all on public.hospital_boundary from public;
revoke all on public.hospital_boundary from anon;
grant select on public.hospital_boundary to authenticated;

create or replace function public.save_hospital_boundary(new_points jsonb)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  point_item jsonb;
  point_lat double precision;
  point_lng double precision;
  previous_lat double precision;
  previous_lng double precision;
  point_count integer;
begin
  if not exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and lower(trim(p.role)) = 'admin'
  ) then
    raise exception 'Hanya administrator yang dapat mengubah batas rumah sakit.';
  end if;

  if new_points is null or jsonb_typeof(new_points) <> 'array' then
    raise exception 'Titik batas tidak valid.';
  end if;

  point_count := jsonb_array_length(new_points);
  if point_count < 3 or point_count > 200 then
    raise exception 'Batas rumah sakit harus memiliki 3 sampai 200 titik.';
  end if;

  for point_item in select value from jsonb_array_elements(new_points)
  loop
    if jsonb_typeof(point_item) is distinct from 'array' then
      raise exception 'Setiap titik harus berisi latitude dan longitude.';
    end if;
    if jsonb_array_length(point_item) <> 2 then
      raise exception 'Setiap titik harus berisi latitude dan longitude.';
    end if;
    if jsonb_typeof(point_item->0) is distinct from 'number'
      or jsonb_typeof(point_item->1) is distinct from 'number'
    then
      raise exception 'Latitude dan longitude harus berupa angka.';
    end if;

    point_lat := (point_item->>0)::double precision;
    point_lng := (point_item->>1)::double precision;

    if point_lat is null or point_lng is null then
      raise exception 'Koordinat batas tidak valid.';
    end if;
    if point_lat < -90 or point_lat > 90 or point_lng < -180 or point_lng > 180 then
      raise exception 'Koordinat batas tidak valid.';
    end if;

    if previous_lat is not null
      and abs(point_lat - previous_lat) < 1e-12
      and abs(point_lng - previous_lng) < 1e-12
    then
      raise exception 'Titik batas tidak boleh berurutan sama.';
    end if;

    previous_lat := point_lat;
    previous_lng := point_lng;
  end loop;

  insert into public.hospital_boundary (id, points, updated_at, updated_by)
  values (1, new_points, now(), auth.uid())
  on conflict (id) do update
  set points = excluded.points,
      updated_at = now(),
      updated_by = auth.uid();
end;
$$;

create or replace function public.clear_hospital_boundary()
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
    raise exception 'Hanya administrator yang dapat menghapus batas rumah sakit.';
  end if;

  delete from public.hospital_boundary where id = 1;
end;
$$;

revoke all on function public.save_hospital_boundary(jsonb) from public;
revoke all on function public.save_hospital_boundary(jsonb) from anon;
grant execute on function public.save_hospital_boundary(jsonb) to authenticated;

revoke all on function public.clear_hospital_boundary() from public;
revoke all on function public.clear_hospital_boundary() from anon;
grant execute on function public.clear_hospital_boundary() to authenticated;
