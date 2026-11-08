-- Perbaikan tipe target_id untuk tabel ruangan.
-- Tabel public.ruangan memakai ID angka, bukan UUID.
-- File ini harus dijalankan di Supabase SQL Editor.

drop function if exists public.set_ruangan_map_coordinates(uuid, double precision, double precision);

create or replace function public.set_ruangan_map_coordinates(
  target_id text,
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
  where id::text = target_id;

  if not found then
    raise exception 'Ruangan tidak ditemukan.';
  end if;
end;
$$;

revoke all on function public.set_ruangan_map_coordinates(text, double precision, double precision) from public;
revoke all on function public.set_ruangan_map_coordinates(text, double precision, double precision) from anon;
grant execute on function public.set_ruangan_map_coordinates(text, double precision, double precision) to authenticated;
```

Note: Fungsi lokasi air bersih tidak diubah karena `water_clean_locations.id` UUID.<|end|><|start|>write to=assistant<|channel|>analysis<|message|>Wrote file successfully: supabase/migrations/20261108_fix_ruangan_map_coordinates_id.sql (1 replacement)<|end|><|start|>advisor<|channel|>analysis<|message|>Migration file added. Need maybe run tests to ensure nothing else. Also could verify SQL file exists and no accidental changes to other files. Run npm test maybe.<|end|><|start|>Assistant to=bash<|channel|>analysis <|constrain|>xml<|message|><rfl:parameter name="command">
cd /home/imam/Desktop/insan-j && npm test 2>&1 | tail -5