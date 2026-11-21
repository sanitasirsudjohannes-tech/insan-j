-- Jalankan sekali melalui Supabase Dashboard > SQL Editor.
-- Memperbaiki reset password dan memindahkan hapus/restore arsip ke transaksi server.

BEGIN;

CREATE OR REPLACE FUNCTION public.admin_reset_user_password(
  target_user_id uuid,
  new_password text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions, pg_temp
AS $$
BEGIN
  IF NOT public.is_sanitasi_admin() THEN
    RAISE EXCEPTION 'Hanya administrator yang dapat mereset password.';
  END IF;

  IF target_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Gunakan menu Akun untuk mengganti password sendiri.';
  END IF;

  IF new_password IS NULL
     OR char_length(new_password) < 12
     OR new_password !~ '[A-Z]'
     OR new_password !~ '[a-z]'
     OR new_password !~ '[0-9]'
     OR new_password !~ '[^a-zA-Z0-9]' THEN
    RAISE EXCEPTION 'Password sementara tidak memenuhi standar keamanan.';
  END IF;

  UPDATE auth.users
  SET encrypted_password = extensions.crypt(new_password, extensions.gen_salt('bf')),
      updated_at = now()
  WHERE id = target_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Akun pengguna tidak ditemukan.';
  END IF;

  DELETE FROM auth.sessions WHERE user_id::text = target_user_id::text;
  DELETE FROM auth.refresh_tokens WHERE user_id::text = target_user_id::text;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_reset_user_password(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_reset_user_password(uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_reset_user_password(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_delete_archived_year(p_year integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  table_name text;
  affected integer;
  result jsonb := '{}'::jsonb;
BEGIN
  IF NOT public.is_sanitasi_admin() THEN
    RAISE EXCEPTION 'Hanya administrator yang dapat menghapus arsip.';
  END IF;
  IF p_year < 2000 OR p_year > extract(year FROM current_date)::integer - 2 THEN
    RAISE EXCEPTION 'Tahun arsip tidak diizinkan.';
  END IF;

  FOREACH table_name IN ARRAY ARRAY[
    'limbah_padat', 'limbah_ruangan', 'limbah_anorganik', 'pengangkutan_limbah'
  ]
  LOOP
    EXECUTE format(
      'DELETE FROM public.%I WHERE tanggal >= $1 AND tanggal < $2',
      table_name
    )
    USING make_date(p_year, 1, 1), make_date(p_year + 1, 1, 1);
    GET DIAGNOSTICS affected = ROW_COUNT;
    result := result || jsonb_build_object(table_name, affected);
  END LOOP;

  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_delete_archived_year(integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_delete_archived_year(integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_delete_archived_year(integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_restore_data_archive(
  p_year integer,
  p_datasets jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  table_name text;
  dataset jsonb;
  restored integer;
  result jsonb := '{}'::jsonb;
BEGIN
  IF NOT public.is_sanitasi_admin() THEN
    RAISE EXCEPTION 'Hanya administrator yang dapat memulihkan arsip.';
  END IF;
  IF p_year < 2000 OR p_year >= extract(year FROM current_date)::integer THEN
    RAISE EXCEPTION 'Tahun arsip tidak diizinkan.';
  END IF;
  IF jsonb_typeof(p_datasets) <> 'object' THEN
    RAISE EXCEPTION 'Dataset arsip tidak valid.';
  END IF;

  FOREACH table_name IN ARRAY ARRAY[
    'limbah_padat', 'limbah_ruangan', 'limbah_anorganik', 'pengangkutan_limbah'
  ]
  LOOP
    dataset := p_datasets -> table_name;
    IF dataset IS NULL OR jsonb_typeof(dataset) <> 'array' THEN
      RAISE EXCEPTION 'Dataset % tidak tersedia.', table_name;
    END IF;
    IF jsonb_array_length(dataset) > 100000 THEN
      RAISE EXCEPTION 'Dataset % melebihi batas.', table_name;
    END IF;
    IF EXISTS (
      SELECT 1
      FROM jsonb_array_elements(dataset) AS item
      WHERE NOT (item ? 'id')
         OR NOT (item ? 'tanggal')
         OR (item ->> 'tanggal') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
         OR substring(item ->> 'tanggal', 1, 4)::integer <> p_year
    ) THEN
      RAISE EXCEPTION 'Dataset % memuat ID/tanggal yang tidak valid atau berada di luar tahun %.', table_name, p_year;
    END IF;
    IF (
      SELECT count(*) <> count(DISTINCT item ->> 'id')
      FROM jsonb_array_elements(dataset) AS item
    ) THEN
      RAISE EXCEPTION 'Dataset % memuat ID ganda.', table_name;
    END IF;

    EXECUTE format(
      'DELETE FROM public.%I WHERE id::text IN (SELECT item ->> ''id'' FROM jsonb_array_elements($1) item)',
      table_name
    ) USING dataset;

    EXECUTE format(
      'INSERT INTO public.%I SELECT * FROM jsonb_populate_recordset(NULL::public.%I, $1)',
      table_name,
      table_name
    ) USING dataset;

    restored := jsonb_array_length(dataset);
    result := result || jsonb_build_object(table_name, restored);
  END LOOP;

  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_restore_data_archive(integer, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_restore_data_archive(integer, jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_restore_data_archive(integer, jsonb) TO authenticated;

COMMIT;

SELECT
  p.proname AS function_name,
  p.prosecdef AS security_definer,
  has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_can_execute,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated_can_execute
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN (
    'admin_reset_user_password',
    'admin_delete_archived_year',
    'admin_restore_data_archive'
  )
ORDER BY p.proname;
