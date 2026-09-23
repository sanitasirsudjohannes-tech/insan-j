-- Jalankan sesudah 20260923_water_examinations.sql dan 20260924_water_examinations_staff_only.sql.
-- Master baku mutu milik admin; trigger memastikan petugas tidak dapat mengganti
-- baku mutu/rujukan melalui permintaan API langsung.
create table if not exists public.water_regulations (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(trim(title)) > 0),
  number text,
  year integer check (year between 1900 and 2200),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.water_parameter_standards (
  id uuid primary key default gen_random_uuid(),
  water_type text not null check (water_type in ('clean', 'wastewater')),
  parameter text not null check (length(trim(parameter)) > 0),
  unit text not null default '',
  standard text not null check (length(trim(standard)) > 0),
  regulation_id uuid references public.water_regulations(id) on delete restrict,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint clean_water_parameter_names check (
    water_type <> 'clean' or parameter in ('Total coliform', 'E. coli')
  )
);
create unique index if not exists water_standards_unique_parameter
  on public.water_parameter_standards (water_type, lower(trim(parameter)));

alter table public.water_regulations enable row level security;
alter table public.water_parameter_standards enable row level security;

drop policy if exists "water regulations staff read" on public.water_regulations;
create policy "water regulations staff read" on public.water_regulations
  for select to authenticated using (
    exists (select 1 from public.profiles p where p.id = auth.uid()
      and lower(trim(p.role)) in ('admin', 'petugas', 'user'))
  );
drop policy if exists "water regulations admin write" on public.water_regulations;
create policy "water regulations admin write" on public.water_regulations
  for all to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid()
    and lower(trim(p.role)) = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid()
    and lower(trim(p.role)) = 'admin'));

drop policy if exists "water standards staff read" on public.water_parameter_standards;
create policy "water standards staff read" on public.water_parameter_standards
  for select to authenticated using (
    exists (select 1 from public.profiles p where p.id = auth.uid()
      and lower(trim(p.role)) in ('admin', 'petugas', 'user'))
  );
drop policy if exists "water standards admin write" on public.water_parameter_standards;
create policy "water standards admin write" on public.water_parameter_standards
  for all to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid()
    and lower(trim(p.role)) = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid()
    and lower(trim(p.role)) = 'admin'));

grant select, insert, update on public.water_regulations to authenticated;
grant select, insert, update on public.water_parameter_standards to authenticated;

create or replace function public.water_result_status(result_text text, standard_text text)
returns text language plpgsql immutable set search_path = public, pg_temp as $$
declare
  v text := replace(trim(coalesce(result_text, '')), ',', '.');
  lim text := replace(regexp_replace(trim(coalesce(standard_text, '')), '\s*/\s*100\s*ml\s*$', '', 'i'), ',', '.');
  m text[];
  n numeric;
  lower_limit numeric;
  upper_limit numeric;
  ok boolean;
begin
  if v !~ '^[0-9]+(\.[0-9]+)?$' then return 'belum_dinilai'; end if;
  n := v::numeric;
  m := regexp_match(lim, '^([0-9]+(\.[0-9]+)?)\s*[-–]\s*([0-9]+(\.[0-9]+)?)$');
  if m is not null then
    lower_limit := m[1]::numeric;
    upper_limit := m[3]::numeric;
    if lower_limit > upper_limit then return 'belum_dinilai'; end if;
    ok := n between lower_limit and upper_limit;
  else
    m := regexp_match(lim, '^(<=|>=|<|>|≤|≥)?\s*([0-9]+(\.[0-9]+)?)$');
    if m is null then return 'belum_dinilai'; end if;
    upper_limit := m[2]::numeric;
    case coalesce(m[1], '')
      when '>=' then ok := n >= upper_limit;
      when '≥' then ok := n >= upper_limit;
      when '>' then ok := n > upper_limit;
      when '<' then ok := n < upper_limit;
      else ok := n <= upper_limit;
    end case;
  end if;
  return case when ok then 'memenuhi' else 'tidak_memenuhi' end;
end;
$$;

create or replace function public.enforce_water_result_standards()
returns trigger language plpgsql set search_path = public, pg_temp as $$
declare
  item jsonb;
  previous_item jsonb;
  snapshot jsonb := '[]'::jsonb;
  master_record record;
  regulation_text text;
  parameter_name text;
  result_text text;
begin
  if jsonb_typeof(new.parameters) <> 'array' or jsonb_array_length(new.parameters) = 0 then
    raise exception 'Minimal satu hasil parameter wajib diisi';
  end if;
  for item in select elem.value from jsonb_array_elements(new.parameters) as elem(value) loop
    parameter_name := trim(item->>'parameter');
    result_text := trim(item->>'result');
    if coalesce(parameter_name, '') = '' or coalesce(result_text, '') = '' then
      raise exception 'Parameter dan hasil tidak boleh kosong';
    end if;
    previous_item := null;
    if tg_op = 'UPDATE' then
      if new.water_type = old.water_type then
      select elem.value into previous_item
      from jsonb_array_elements(old.parameters) as elem(value)
      where lower(trim(elem.value->>'parameter')) = lower(parameter_name)
         or (new.water_type = 'clean' and parameter_name = 'Total coliform'
             and lower(trim(elem.value->>'parameter')) = 'coliform')
      limit 1;
      end if;
    end if;
    if previous_item is not null
       and nullif(previous_item->>'standard_id', '') is not null
       and nullif(previous_item->>'regulation', '') is not null then
      snapshot := snapshot || jsonb_build_object(
        'parameter', parameter_name, 'result', result_text,
        'unit', previous_item->>'unit', 'standard', previous_item->>'standard',
        'standard_id', previous_item->>'standard_id',
        'regulation', previous_item->>'regulation',
        'status', public.water_result_status(result_text, previous_item->>'standard')
      );
    else
      select s.id, s.unit, s.standard, r.title, r.number, r.year into master_record
      from public.water_parameter_standards s
      join public.water_regulations r on r.id = s.regulation_id and r.is_active
      where s.water_type = new.water_type
        and lower(trim(s.parameter)) = lower(parameter_name)
        and s.is_active
      limit 1;
      if not found then raise exception 'Baku mutu dan rujukan aktif untuk % belum diatur admin', parameter_name; end if;
      regulation_text := concat_ws(' · ', master_record.title, master_record.number, master_record.year::text);
      snapshot := snapshot || jsonb_build_object(
        'parameter', parameter_name, 'result', result_text,
        'unit', master_record.unit, 'standard', master_record.standard,
        'standard_id', master_record.id, 'regulation', regulation_text,
        'status', public.water_result_status(result_text, master_record.standard)
      );
    end if;
  end loop;
  if new.water_type = 'clean' and (
    jsonb_array_length(snapshot) <> 2
    or (select count(*) from jsonb_array_elements(snapshot) as v(value)
        where v.value->>'parameter' in ('Total coliform', 'E. coli')) <> 2
    or (select count(distinct v.value->>'parameter') from jsonb_array_elements(snapshot) as v(value)) <> 2
  ) then
    raise exception 'Air bersih wajib memiliki Total coliform dan E. coli';
  end if;
  new.parameters := snapshot;
  return new;
end;
$$;

drop trigger if exists enforce_water_result_standards on public.water_examinations;
create trigger enforce_water_result_standards
before insert or update on public.water_examinations
for each row execute function public.enforce_water_result_standards();
