-- Jalankan skrip ini melalui Supabase Dashboard > SQL Editor.
-- Skrip mengaudit sekaligus memperketat akses profiles, app_settings,
-- dan fungsi reset password administrator.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.is_sanitasi_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND lower(role) = 'admin'
  );
$$;

REVOKE ALL ON FUNCTION public.is_sanitasi_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_sanitasi_admin() TO authenticated;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Hapus policy lama yang dapat memberi akses terlalu luas sebelum
-- menggantinya dengan aturan yang eksplisit.
DO $$
DECLARE
  existing_policy record;
BEGIN
  FOR existing_policy IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('profiles', 'app_settings')
  LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON %I.%I',
      existing_policy.policyname,
      existing_policy.schemaname,
      existing_policy.tablename
    );
  END LOOP;
END;
$$;

CREATE POLICY profiles_select_own_or_admin
ON public.profiles
FOR SELECT
TO authenticated
USING (id = auth.uid() OR public.is_sanitasi_admin());

CREATE POLICY profiles_insert_admin_only
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (public.is_sanitasi_admin());

CREATE POLICY profiles_update_admin_only
ON public.profiles
FOR UPDATE
TO authenticated
USING (public.is_sanitasi_admin())
WITH CHECK (public.is_sanitasi_admin());

CREATE POLICY profiles_delete_admin_only
ON public.profiles
FOR DELETE
TO authenticated
USING (public.is_sanitasi_admin());

-- Petugas dapat membaca pengaturan aplikasi yang diperlukan untuk
-- laporan, tetapi daftar NIP seluruh pengguna hanya tersedia bagi admin.
CREATE POLICY app_settings_select_authorized
ON public.app_settings
FOR SELECT
TO authenticated
USING (
  public.is_sanitasi_admin()
  OR key NOT LIKE 'nip_pengguna%'
);

CREATE POLICY app_settings_insert_admin_only
ON public.app_settings
FOR INSERT
TO authenticated
WITH CHECK (public.is_sanitasi_admin());

CREATE POLICY app_settings_update_admin_only
ON public.app_settings
FOR UPDATE
TO authenticated
USING (public.is_sanitasi_admin())
WITH CHECK (public.is_sanitasi_admin());

CREATE POLICY app_settings_delete_admin_only
ON public.app_settings
FOR DELETE
TO authenticated
USING (public.is_sanitasi_admin());

CREATE OR REPLACE FUNCTION public.admin_reset_user_password(
  target_user_id uuid,
  new_password text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
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
END;
$$;

REVOKE ALL ON FUNCTION public.admin_reset_user_password(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_reset_user_password(uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_reset_user_password(uuid, text) TO authenticated;

COMMIT;

-- Audit: pastikan RLS aktif dan policy yang berlaku sesuai kebutuhan.
SELECT
  namespace.nspname AS schema_name,
  relation.relname AS table_name,
  relation.relrowsecurity AS rls_enabled
FROM pg_class AS relation
JOIN pg_namespace AS namespace ON namespace.oid = relation.relnamespace
WHERE namespace.nspname = 'public'
  AND relation.relname IN ('profiles', 'app_settings');

SELECT
  schemaname,
  tablename,
  policyname,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('profiles', 'app_settings')
ORDER BY tablename, policyname;

SELECT
  has_function_privilege('anon', 'public.admin_reset_user_password(uuid, text)', 'EXECUTE') AS anon_can_reset,
  has_function_privilege('authenticated', 'public.admin_reset_user_password(uuid, text)', 'EXECUTE') AS authenticated_can_call;
