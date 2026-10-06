-- Script untuk mengizinkan pengguna publik (anonim) membaca pengaturan landing page.

CREATE POLICY app_settings_select_anon
ON public.app_settings
FOR SELECT
TO anon
USING (
  key = 'landing_gallery'
);
