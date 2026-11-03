-- Pencarian email login yang tidak membedakan huruf besar/kecil.
-- Jalankan satu kali melalui Supabase Dashboard > SQL Editor.

create or replace function public.resolve_login_email(p_username text)
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select u.email::text
  from public.profiles p
  join auth.users u on u.id = p.id
  where lower(trim(p.username)) = lower(trim(p_username))
  order by
    case when p.username = p_username then 0 else 1 end,
    p.username
  limit 1;
$$;

revoke all on function public.resolve_login_email(text) from public;
revoke all on function public.resolve_login_email(text) from anon;
grant execute on function public.resolve_login_email(text) to anon;
grant execute on function public.resolve_login_email(text) to authenticated;
