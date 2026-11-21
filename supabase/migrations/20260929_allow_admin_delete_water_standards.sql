-- Penghapusan hanya boleh dilakukan admin, setelah baku mutu dinonaktifkan,
-- dan hanya jika ID baku mutu belum pernah tersimpan pada snapshot pemeriksaan.
revoke delete on public.water_parameter_standards from authenticated;

create or replace function public.get_used_water_standard_ids()
returns table (standard_id uuid)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select distinct standard.id
  from public.water_examinations examination
  cross join lateral jsonb_array_elements(examination.parameters) parameter(value)
  join public.water_parameter_standards standard
    on standard.id::text = parameter.value->>'standard_id'
  where nullif(parameter.value->>'standard_id', '') is not null
    and exists (
      select 1 from public.profiles profile
      where profile.id = auth.uid()
        and lower(trim(profile.role)) = 'admin'
    );
$$;

create or replace function public.delete_unused_water_standard(target_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  target_active boolean;
begin
  if not exists (
    select 1 from public.profiles profile
    where profile.id = auth.uid()
      and lower(trim(profile.role)) = 'admin'
  ) then
    raise exception 'Hanya admin yang dapat menghapus baku mutu';
  end if;

  select is_active into target_active
  from public.water_parameter_standards
  where id = target_id;

  if not found then
    raise exception 'Baku mutu tidak ditemukan';
  end if;
  if target_active then
    raise exception 'Nonaktifkan baku mutu sebelum menghapusnya';
  end if;
  if exists (
    select 1
    from public.water_examinations examination
    cross join lateral jsonb_array_elements(examination.parameters) parameter(value)
    where parameter.value->>'standard_id' = target_id::text
  ) then
    raise exception 'Baku mutu sudah pernah digunakan dan tidak dapat dihapus';
  end if;

  delete from public.water_parameter_standards where id = target_id;
end;
$$;

revoke all on function public.get_used_water_standard_ids() from public;
revoke all on function public.delete_unused_water_standard(uuid) from public;
grant execute on function public.get_used_water_standard_ids() to authenticated;
grant execute on function public.delete_unused_water_standard(uuid) to authenticated;
