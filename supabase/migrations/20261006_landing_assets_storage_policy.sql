-- Script untuk mengizinkan Admin mengunggah dan menghapus file di bucket 'landing_assets'
-- serta mengizinkan semua orang untuk melihat file.

-- 1. Pastikan bucket 'landing_assets' ada dan diset public
INSERT INTO storage.buckets (id, name, public)
VALUES ('landing_assets', 'landing_assets', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 2. Policy agar siapapun bisa melihat gambar (SELECT)
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
USING ( bucket_id = 'landing_assets' );

-- 3. Policy agar Admin bisa mengunggah (INSERT)
CREATE POLICY "Admin can upload"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'landing_assets' 
  AND public.is_sanitasi_admin()
);

-- 4. Policy agar Admin bisa menghapus (DELETE)
CREATE POLICY "Admin can delete"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'landing_assets' 
  AND public.is_sanitasi_admin()
);

-- 5. Policy agar Admin bisa memperbarui (UPDATE)
CREATE POLICY "Admin can update"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'landing_assets' 
  AND public.is_sanitasi_admin()
);
