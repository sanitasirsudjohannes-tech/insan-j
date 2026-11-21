-- Ringkas indeks arsip di server agar halaman tidak mengunduh satu baris untuk
-- setiap hasil pemeriksaan. RLS water_examinations tetap berlaku (security invoker).
create or replace function public.get_water_examination_archive_summary()
returns table (
  water_type text,
  sampled_at date,
  total bigint
)
language sql
stable
security invoker
set search_path = public
as $$
  select examination.water_type, examination.sampled_at, count(*)::bigint as total
  from public.water_examinations examination
  group by examination.water_type, examination.sampled_at
  order by examination.sampled_at desc, examination.water_type;
$$;

revoke all on function public.get_water_examination_archive_summary() from public;
grant execute on function public.get_water_examination_archive_summary() to authenticated;
