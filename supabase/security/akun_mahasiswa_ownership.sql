-- BELUM DIJALANKAN: periksa hasil audit di bagian akhir sebelum COMMIT.
-- Tujuan:
-- 1. Menambahkan pemilik data pada dua tabel input mahasiswa.
-- 2. Petugas/admin tetap dapat CRUD semua data.
-- 3. Mahasiswa hanya dapat CRUD data yang dibuat oleh auth.uid() miliknya.
--
-- Data lama dibiarkan created_by = NULL agar tidak mengubah atau menghapus
-- riwayat yang sudah ada. Data lama tetap terlihat oleh petugas dan admin.

BEGIN;

ALTER TABLE public.limbah_ruangan
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.limbah_anorganik
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.limbah_ruangan
  ALTER COLUMN created_by SET DEFAULT auth.uid();

ALTER TABLE public.limbah_anorganik
  ALTER COLUMN created_by SET DEFAULT auth.uid();

CREATE INDEX IF NOT EXISTS idx_limbah_ruangan_created_by
  ON public.limbah_ruangan(created_by);

CREATE INDEX IF NOT EXISTS idx_limbah_anorganik_created_by
  ON public.limbah_anorganik(created_by);

CREATE OR REPLACE FUNCTION public.current_sanitasi_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT lower(role)
  FROM public.profiles
  WHERE id = auth.uid();
$$;

REVOKE ALL ON FUNCTION public.current_sanitasi_role() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_sanitasi_role() TO authenticated;

ALTER TABLE public.limbah_ruangan ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.limbah_anorganik ENABLE ROW LEVEL SECURITY;

-- Policy PostgreSQL bersifat permisif (digabung dengan OR). Karena itu seluruh
-- policy lama di dua tabel ini diganti agar policy lama yang terlalu luas tidak
-- dapat melewati pembatasan mahasiswa.
DO $$
DECLARE
  existing_policy record;
BEGIN
  FOR existing_policy IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('limbah_ruangan', 'limbah_anorganik')
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

CREATE POLICY limbah_ruangan_select_by_role
ON public.limbah_ruangan FOR SELECT TO authenticated
USING (
  public.current_sanitasi_role() IN ('admin', 'petugas', 'user')
  OR (public.current_sanitasi_role() = 'mahasiswa' AND created_by = auth.uid())
);

CREATE POLICY limbah_ruangan_insert_by_role
ON public.limbah_ruangan FOR INSERT TO authenticated
WITH CHECK (
  public.current_sanitasi_role() IN ('admin', 'petugas', 'user')
  OR (public.current_sanitasi_role() = 'mahasiswa' AND created_by = auth.uid())
);

CREATE POLICY limbah_ruangan_update_by_role
ON public.limbah_ruangan FOR UPDATE TO authenticated
USING (
  public.current_sanitasi_role() IN ('admin', 'petugas', 'user')
  OR (public.current_sanitasi_role() = 'mahasiswa' AND created_by = auth.uid())
)
WITH CHECK (
  public.current_sanitasi_role() IN ('admin', 'petugas', 'user')
  OR (public.current_sanitasi_role() = 'mahasiswa' AND created_by = auth.uid())
);

CREATE POLICY limbah_ruangan_delete_by_role
ON public.limbah_ruangan FOR DELETE TO authenticated
USING (
  public.current_sanitasi_role() IN ('admin', 'petugas', 'user')
  OR (public.current_sanitasi_role() = 'mahasiswa' AND created_by = auth.uid())
);

CREATE POLICY limbah_anorganik_select_by_role
ON public.limbah_anorganik FOR SELECT TO authenticated
USING (
  public.current_sanitasi_role() IN ('admin', 'petugas', 'user')
  OR (public.current_sanitasi_role() = 'mahasiswa' AND created_by = auth.uid())
);

CREATE POLICY limbah_anorganik_insert_by_role
ON public.limbah_anorganik FOR INSERT TO authenticated
WITH CHECK (
  public.current_sanitasi_role() IN ('admin', 'petugas', 'user')
  OR (public.current_sanitasi_role() = 'mahasiswa' AND created_by = auth.uid())
);

CREATE POLICY limbah_anorganik_update_by_role
ON public.limbah_anorganik FOR UPDATE TO authenticated
USING (
  public.current_sanitasi_role() IN ('admin', 'petugas', 'user')
  OR (public.current_sanitasi_role() = 'mahasiswa' AND created_by = auth.uid())
)
WITH CHECK (
  public.current_sanitasi_role() IN ('admin', 'petugas', 'user')
  OR (public.current_sanitasi_role() = 'mahasiswa' AND created_by = auth.uid())
);

CREATE POLICY limbah_anorganik_delete_by_role
ON public.limbah_anorganik FOR DELETE TO authenticated
USING (
  public.current_sanitasi_role() IN ('admin', 'petugas', 'user')
  OR (public.current_sanitasi_role() = 'mahasiswa' AND created_by = auth.uid())
);

COMMIT;

-- Audit setelah migrasi. Pastikan:
-- - role mahasiswa dapat disimpan pada profiles;
-- - hanya policy di bawah yang aktif pada dua tabel limbah;
-- - data lama dengan created_by NULL masih tersedia untuk petugas/admin.
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'public.profiles'::regclass
  AND contype = 'c';

SELECT schemaname, tablename, policyname, roles, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('limbah_ruangan', 'limbah_anorganik')
ORDER BY tablename, policyname;
