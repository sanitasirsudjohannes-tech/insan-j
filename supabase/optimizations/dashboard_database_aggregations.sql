-- Jalankan seluruh skrip ini melalui Supabase Dashboard > SQL Editor.
-- Fungsi memakai SECURITY INVOKER sehingga tetap mengikuti RLS pengguna aktif.
-- Aman dijalankan berulang setelah perubahan frontend di-deploy.

BEGIN;

CREATE INDEX IF NOT EXISTS idx_limbah_padat_tanggal
  ON public.limbah_padat (tanggal);

CREATE INDEX IF NOT EXISTS idx_limbah_ruangan_tanggal
  ON public.limbah_ruangan (tanggal);

CREATE INDEX IF NOT EXISTS idx_pengangkutan_limbah_tanggal
  ON public.pengangkutan_limbah (tanggal);

CREATE INDEX IF NOT EXISTS idx_limbah_anorganik_tanggal
  ON public.limbah_anorganik (tanggal);

CREATE INDEX IF NOT EXISTS idx_ruang_bangunan_tanggal_pemeriksaan
  ON public.ruang_bangunan (tanggal_pemeriksaan);

CREATE INDEX IF NOT EXISTS idx_limbah_medis_tanggal_pemeriksaan
  ON public.limbah_medis (tanggal_pemeriksaan);

CREATE INDEX IF NOT EXISTS idx_pemeriksaan_toilet_tanggal_pemeriksaan
  ON public.pemeriksaan_toilet (tanggal_pemeriksaan);

CREATE INDEX IF NOT EXISTS idx_pemeriksaan_reservoir_tanggal_pemeriksaan
  ON public.pemeriksaan_reservoir (tanggal_pemeriksaan);

CREATE INDEX IF NOT EXISTS idx_pemeriksaan_gizi_tanggal_pemeriksaan
  ON public.pemeriksaan_gizi (tanggal_pemeriksaan);

CREATE OR REPLACE FUNCTION public.dashboard_pengangkutan_summary(
  requested_month text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH movements AS (
    SELECT
      tanggal::date AS tanggal,
      COALESCE(infeksius, 0)::numeric
        + COALESCE(jarum_suntik, 0)::numeric
        + COALESCE(botol_obat, 0)::numeric
        + COALESCE(sitotoksik, 0)::numeric AS masuk,
      0::numeric AS diangkut
    FROM public.limbah_padat
    WHERE tanggal IS NOT NULL

    UNION ALL

    SELECT
      tanggal::date,
      COALESCE(infeksius, 0)::numeric
        + COALESCE(jarum_suntik, 0)::numeric
        + COALESCE(botol_obat, 0)::numeric
        + COALESCE(sitotoksik, 0)::numeric,
      0::numeric
    FROM public.limbah_ruangan
    WHERE tanggal IS NOT NULL

    UNION ALL

    SELECT tanggal::date, 0::numeric, COALESCE(jumlah_kg, 0)::numeric
    FROM public.pengangkutan_limbah
    WHERE tanggal IS NOT NULL
  ), daily AS (
    SELECT tanggal, SUM(masuk) AS masuk, SUM(diangkut) AS diangkut
    FROM movements
    GROUP BY tanggal
  ), balances AS (
    SELECT
      tanggal,
      masuk,
      diangkut,
      SUM(masuk - diangkut) OVER (ORDER BY tanggal) AS sisa
    FROM daily
  ), selected AS (
    SELECT COALESCE(
      NULLIF(requested_month, ''),
      (SELECT to_char(MAX(tanggal), 'YYYY-MM') FROM balances)
    ) AS selected_month
  )
  SELECT jsonb_build_object(
    'selectedMonth', (SELECT selected_month FROM selected),
    'availableMonths', COALESCE((
      SELECT jsonb_agg(month_key ORDER BY month_key)
      FROM (
        SELECT DISTINCT to_char(tanggal, 'YYYY-MM') AS month_key
        FROM balances
      ) AS months
    ), '[]'::jsonb),
    'summary', jsonb_build_object(
      'masuk', COALESCE((SELECT SUM(masuk) FROM balances), 0),
      'diangkut', COALESCE((SELECT SUM(diangkut) FROM balances), 0),
      'sisa', COALESCE((SELECT SUM(masuk - diangkut) FROM balances), 0)
    ),
    'daily', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'tanggal', tanggal,
          'masuk', masuk,
          'diangkut', diangkut,
          'sisa', sisa
        )
        ORDER BY tanggal
      )
      FROM balances
      WHERE (SELECT selected_month FROM selected) = 'semua'
        OR to_char(tanggal, 'YYYY-MM') = (SELECT selected_month FROM selected)
    ), '[]'::jsonb)
  );
$$;

-- Hapus signature lama tanpa parameter. Signature baru tetap dapat dipanggil
-- tanpa argumen karena requested_year memiliki nilai default.
DROP FUNCTION IF EXISTS public.dashboard_jenis_limbah_summary();

CREATE OR REPLACE FUNCTION public.dashboard_jenis_limbah_summary(
  requested_year integer DEFAULT NULL
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH source_rows AS (
    SELECT tanggal::date, infeksius, jarum_suntik, botol_obat, sitotoksik
    FROM public.limbah_padat
    WHERE tanggal IS NOT NULL

    UNION ALL

    SELECT tanggal::date, infeksius, jarum_suntik, botol_obat, sitotoksik
    FROM public.limbah_ruangan
    WHERE tanggal IS NOT NULL
  ), available_years AS (
    SELECT DISTINCT EXTRACT(YEAR FROM tanggal)::integer AS year
    FROM source_rows
  ), selected AS (
    SELECT COALESCE(
      (
        SELECT requested_year
        WHERE requested_year BETWEEN 2000 AND 9999
          AND EXISTS (SELECT 1 FROM available_years WHERE year = requested_year)
      ),
      (SELECT MAX(year) FROM available_years),
      EXTRACT(YEAR FROM current_date)::integer
    ) AS selected_year
  ), daily AS (
    SELECT
      tanggal,
      SUM(COALESCE(infeksius, 0)::numeric) AS infeksius,
      SUM(COALESCE(jarum_suntik, 0)::numeric) AS jarum_suntik,
      SUM(COALESCE(botol_obat, 0)::numeric) AS botol_obat,
      SUM(COALESCE(sitotoksik, 0)::numeric) AS sitotoksik
    FROM source_rows
    WHERE EXTRACT(YEAR FROM tanggal)::integer = (SELECT selected_year FROM selected)
    GROUP BY tanggal
  ), monthly AS (
    SELECT
      to_char(tanggal, 'YYYY-MM') AS bulan,
      SUM(infeksius + jarum_suntik + botol_obat + sitotoksik) AS total
    FROM daily
    GROUP BY to_char(tanggal, 'YYYY-MM')
  )
  SELECT jsonb_build_object(
    'selectedYear', (SELECT selected_year FROM selected),
    'availableYears', COALESCE((
      SELECT jsonb_agg(year ORDER BY year DESC)
      FROM available_years
    ), jsonb_build_array((SELECT selected_year FROM selected))),
    'summary', jsonb_build_object(
      'infeksius', COALESCE((SELECT SUM(infeksius) FROM daily), 0),
      'jarum_suntik', COALESCE((SELECT SUM(jarum_suntik) FROM daily), 0),
      'botol_obat', COALESCE((SELECT SUM(botol_obat) FROM daily), 0),
      'sitotoksik', COALESCE((SELECT SUM(sitotoksik) FROM daily), 0)
    ),
    'daily', COALESCE((
      SELECT jsonb_agg(to_jsonb(recent_daily) ORDER BY tanggal)
      FROM (
        SELECT tanggal, infeksius, jarum_suntik, botol_obat, sitotoksik
        FROM daily
        ORDER BY tanggal DESC
        LIMIT 30
      ) AS recent_daily
    ), '[]'::jsonb),
    'monthly', COALESCE((
      SELECT jsonb_agg(to_jsonb(recent_monthly) ORDER BY bulan)
      FROM (
        SELECT bulan, total
        FROM monthly
        ORDER BY bulan DESC
      ) AS recent_monthly
    ), '[]'::jsonb)
  );
$$;

CREATE OR REPLACE FUNCTION public.dashboard_anorganik_summary(
  requested_month text
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  month_start date;
  month_end date;
BEGIN
  IF requested_month IS NULL OR requested_month !~ '^\d{4}-(0[1-9]|1[0-2])$' THEN
    RAISE EXCEPTION 'Periode harus menggunakan format YYYY-MM.';
  END IF;

  month_start := to_date(requested_month || '-01', 'YYYY-MM-DD');
  month_end := (month_start + interval '1 month')::date;

  RETURN (
    WITH selected_rows AS (
      SELECT tanggal::date, infus, jerigen, kertas, kardus, botol_mineral, bayclin_dll
      FROM public.limbah_anorganik
      WHERE tanggal >= month_start
        AND tanggal < month_end
    ), daily AS (
      SELECT
        tanggal,
        SUM(COALESCE(infus, 0)::numeric) AS infus,
        SUM(COALESCE(jerigen, 0)::numeric) AS jerigen,
        SUM(COALESCE(kertas, 0)::numeric) AS kertas,
        SUM(COALESCE(kardus, 0)::numeric) AS kardus,
        SUM(COALESCE(botol_mineral, 0)::numeric) AS botol_mineral,
        SUM(COALESCE(bayclin_dll, 0)::numeric) AS bayclin_dll
      FROM selected_rows
      GROUP BY tanggal
    ), monthly AS (
      SELECT
        to_char(tanggal::date, 'YYYY-MM') AS bulan,
        SUM(
          COALESCE(infus, 0)::numeric
          + COALESCE(kertas, 0)::numeric
          + COALESCE(kardus, 0)::numeric
          + COALESCE(botol_mineral, 0)::numeric
          + COALESCE(bayclin_dll, 0)::numeric
        ) AS total
      FROM public.limbah_anorganik
      WHERE tanggal IS NOT NULL
        AND tanggal >= (
          SELECT date_trunc('month', MAX(latest.tanggal)::timestamp)::date - interval '11 months'
          FROM public.limbah_anorganik AS latest
        )
      GROUP BY to_char(tanggal::date, 'YYYY-MM')
      ORDER BY bulan DESC
      LIMIT 12
    )
    SELECT jsonb_build_object(
      'summary', jsonb_build_object(
        'infus', COALESCE((SELECT SUM(infus) FROM daily), 0),
        'jerigen', COALESCE((SELECT SUM(jerigen) FROM daily), 0),
        'kertas', COALESCE((SELECT SUM(kertas) FROM daily), 0),
        'kardus', COALESCE((SELECT SUM(kardus) FROM daily), 0),
        'botol_mineral', COALESCE((SELECT SUM(botol_mineral) FROM daily), 0),
        'bayclin_dll', COALESCE((SELECT SUM(bayclin_dll) FROM daily), 0)
      ),
      'daily', COALESCE((
        SELECT jsonb_agg(to_jsonb(daily) ORDER BY tanggal)
        FROM daily
      ), '[]'::jsonb),
      'monthly', COALESCE((
        SELECT jsonb_agg(to_jsonb(monthly) ORDER BY bulan)
        FROM monthly
      ), '[]'::jsonb)
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.dashboard_admin_inspeksi_summary(
  requested_month text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  month_start date;
  month_end date;
BEGIN
  IF requested_month IS NOT NULL AND requested_month <> '' THEN
    IF requested_month !~ '^\d{4}-(0[1-9]|1[0-2])$' THEN
      RAISE EXCEPTION 'Periode harus menggunakan format YYYY-MM.';
    END IF;

    month_start := to_date(requested_month || '-01', 'YYYY-MM-DD');
    month_end := (month_start + interval '1 month')::date;
  END IF;

  RETURN (
    WITH categories AS (
      SELECT 'Bangunan'::text AS label, 1 AS position,
        COUNT(*) AS jumlah, COALESCE(SUM(COALESCE(persen, 0)::numeric), 0) AS total
      FROM public.ruang_bangunan
      WHERE month_start IS NULL OR (tanggal_pemeriksaan >= month_start AND tanggal_pemeriksaan < month_end)

      UNION ALL

      SELECT 'Limbah', 2, COUNT(*), COALESCE(SUM(COALESCE(persen, 0)::numeric), 0)
      FROM public.limbah_medis
      WHERE month_start IS NULL OR (tanggal_pemeriksaan >= month_start AND tanggal_pemeriksaan < month_end)

      UNION ALL

      SELECT 'Toilet', 3, COUNT(*), COALESCE(SUM(COALESCE(persen, 0)::numeric), 0)
      FROM public.pemeriksaan_toilet
      WHERE month_start IS NULL OR (tanggal_pemeriksaan >= month_start AND tanggal_pemeriksaan < month_end)

      UNION ALL

      SELECT 'Reservoir', 4, COUNT(*), COALESCE(SUM(COALESCE(persen, 0)::numeric), 0)
      FROM public.pemeriksaan_reservoir
      WHERE month_start IS NULL OR (tanggal_pemeriksaan >= month_start AND tanggal_pemeriksaan < month_end)

      UNION ALL

      SELECT 'Gizi', 5, COUNT(*), COALESCE(SUM(COALESCE(persen, 0)::numeric), 0)
      FROM public.pemeriksaan_gizi
      WHERE month_start IS NULL OR (tanggal_pemeriksaan >= month_start AND tanggal_pemeriksaan < month_end)
    )
    SELECT jsonb_build_object(
      'totalInspeksi', COALESCE((SELECT SUM(jumlah) FROM categories), 0),
      'totalPersen', COALESCE((SELECT SUM(total) FROM categories), 0),
      'categories', COALESCE((
        SELECT jsonb_agg(
          jsonb_build_object('label', label, 'jumlah', jumlah, 'total', total)
          ORDER BY position
        )
        FROM categories
      ), '[]'::jsonb)
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.dashboard_missing_waste_dates(
  start_date date,
  end_date date
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF start_date IS NULL OR end_date IS NULL OR end_date < start_date THEN
    RETURN '[]'::jsonb;
  END IF;

  IF end_date - start_date > 31 THEN
    RAISE EXCEPTION 'Pemeriksaan tanggal maksimal 32 hari.';
  END IF;

  RETURN COALESCE((
    SELECT jsonb_agg(day::date ORDER BY day)
    FROM generate_series(start_date, end_date, interval '1 day') AS day
    WHERE NOT EXISTS (
      SELECT 1 FROM public.limbah_padat WHERE tanggal = day::date
    )
      AND NOT EXISTS (
        SELECT 1 FROM public.limbah_ruangan WHERE tanggal = day::date
      )
  ), '[]'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.rekap_limbah_monthly_summary(
  excluded_padat_ids jsonb DEFAULT '[]'::jsonb,
  excluded_ruangan_ids jsonb DEFAULT '[]'::jsonb,
  excluded_pengangkutan_ids jsonb DEFAULT '[]'::jsonb
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH padat_monthly AS (
    SELECT
      date_trunc('month', tanggal::timestamp)::date AS tanggal,
      SUM(COALESCE(infeksius, 0)::numeric) AS infeksius,
      SUM(COALESCE(jarum_suntik, 0)::numeric) AS jarum_suntik,
      SUM(COALESCE(botol_obat, 0)::numeric) AS botol_obat,
      SUM(COALESCE(sitotoksik, 0)::numeric) AS sitotoksik
    FROM public.limbah_padat
    WHERE tanggal IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM jsonb_array_elements_text(COALESCE(excluded_padat_ids, '[]'::jsonb)) AS excluded(id)
        WHERE excluded.id = limbah_padat.id::text
      )
    GROUP BY date_trunc('month', tanggal::timestamp)::date
  ), ruangan_monthly AS (
    SELECT
      date_trunc('month', tanggal::timestamp)::date AS tanggal,
      SUM(COALESCE(infeksius, 0)::numeric) AS infeksius,
      SUM(COALESCE(jarum_suntik, 0)::numeric) AS jarum_suntik,
      SUM(COALESCE(botol_obat, 0)::numeric) AS botol_obat,
      SUM(COALESCE(sitotoksik, 0)::numeric) AS sitotoksik
    FROM public.limbah_ruangan
    WHERE tanggal IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM jsonb_array_elements_text(COALESCE(excluded_ruangan_ids, '[]'::jsonb)) AS excluded(id)
        WHERE excluded.id = limbah_ruangan.id::text
      )
    GROUP BY date_trunc('month', tanggal::timestamp)::date
  ), pengangkutan_monthly AS (
    SELECT
      date_trunc('month', tanggal::timestamp)::date AS tanggal,
      SUM(COALESCE(jumlah_kg, 0)::numeric) AS jumlah_kg
    FROM public.pengangkutan_limbah
    WHERE tanggal IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM jsonb_array_elements_text(COALESCE(excluded_pengangkutan_ids, '[]'::jsonb)) AS excluded(id)
        WHERE excluded.id = pengangkutan_limbah.id::text
      )
    GROUP BY date_trunc('month', tanggal::timestamp)::date
  )
  SELECT jsonb_build_object(
    'padatRows', COALESCE((SELECT jsonb_agg(to_jsonb(padat_monthly) ORDER BY tanggal) FROM padat_monthly), '[]'::jsonb),
    'ruanganRows', COALESCE((SELECT jsonb_agg(to_jsonb(ruangan_monthly) ORDER BY tanggal) FROM ruangan_monthly), '[]'::jsonb),
    'angkutRows', COALESCE((SELECT jsonb_agg(to_jsonb(pengangkutan_monthly) ORDER BY tanggal) FROM pengangkutan_monthly), '[]'::jsonb)
  );
$$;

CREATE OR REPLACE FUNCTION public.rekap_limbah_yearly_summary(
  requested_year integer,
  excluded_padat_ids jsonb DEFAULT '[]'::jsonb,
  excluded_ruangan_ids jsonb DEFAULT '[]'::jsonb,
  excluded_pengangkutan_ids jsonb DEFAULT '[]'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  year_start date;
  next_year_start date;
  opening_date date;
BEGIN
  IF requested_year IS NULL OR requested_year < 2000 OR requested_year > 9999 THEN
    RAISE EXCEPTION 'Tahun rekap tidak valid.';
  END IF;

  year_start := make_date(requested_year, 1, 1);
  next_year_start := (year_start + interval '1 year')::date;
  opening_date := (year_start - interval '1 month')::date;

  RETURN (
    WITH padat_rows AS (
      SELECT
        CASE WHEN tanggal < year_start THEN opening_date
             ELSE date_trunc('month', tanggal::timestamp)::date END AS tanggal,
        bool_or(tanggal < year_start) AS is_opening_balance,
        SUM(COALESCE(infeksius, 0)::numeric) AS infeksius,
        SUM(COALESCE(jarum_suntik, 0)::numeric) AS jarum_suntik,
        SUM(COALESCE(botol_obat, 0)::numeric) AS botol_obat,
        SUM(COALESCE(sitotoksik, 0)::numeric) AS sitotoksik
      FROM public.limbah_padat
      WHERE tanggal IS NOT NULL AND tanggal < next_year_start
        AND NOT EXISTS (
          SELECT 1 FROM jsonb_array_elements_text(COALESCE(excluded_padat_ids, '[]'::jsonb)) AS excluded(id)
          WHERE excluded.id = limbah_padat.id::text
        )
      GROUP BY CASE WHEN tanggal < year_start THEN opening_date
                    ELSE date_trunc('month', tanggal::timestamp)::date END
    ), ruangan_rows AS (
      SELECT
        CASE WHEN tanggal < year_start THEN opening_date
             ELSE date_trunc('month', tanggal::timestamp)::date END AS tanggal,
        bool_or(tanggal < year_start) AS is_opening_balance,
        SUM(COALESCE(infeksius, 0)::numeric) AS infeksius,
        SUM(COALESCE(jarum_suntik, 0)::numeric) AS jarum_suntik,
        SUM(COALESCE(botol_obat, 0)::numeric) AS botol_obat,
        SUM(COALESCE(sitotoksik, 0)::numeric) AS sitotoksik
      FROM public.limbah_ruangan
      WHERE tanggal IS NOT NULL AND tanggal < next_year_start
        AND NOT EXISTS (
          SELECT 1 FROM jsonb_array_elements_text(COALESCE(excluded_ruangan_ids, '[]'::jsonb)) AS excluded(id)
          WHERE excluded.id = limbah_ruangan.id::text
        )
      GROUP BY CASE WHEN tanggal < year_start THEN opening_date
                    ELSE date_trunc('month', tanggal::timestamp)::date END
    ), pengangkutan_rows AS (
      SELECT
        CASE WHEN tanggal < year_start THEN opening_date
             ELSE date_trunc('month', tanggal::timestamp)::date END AS tanggal,
        bool_or(tanggal < year_start) AS is_opening_balance,
        SUM(COALESCE(jumlah_kg, 0)::numeric) AS jumlah_kg
      FROM public.pengangkutan_limbah
      WHERE tanggal IS NOT NULL AND tanggal < next_year_start
        AND NOT EXISTS (
          SELECT 1 FROM jsonb_array_elements_text(COALESCE(excluded_pengangkutan_ids, '[]'::jsonb)) AS excluded(id)
          WHERE excluded.id = pengangkutan_limbah.id::text
        )
      GROUP BY CASE WHEN tanggal < year_start THEN opening_date
                    ELSE date_trunc('month', tanggal::timestamp)::date END
    ), available_years AS (
      SELECT DISTINCT to_char(tanggal::date, 'YYYY') AS year
      FROM public.limbah_padat WHERE tanggal IS NOT NULL
      UNION
      SELECT DISTINCT to_char(tanggal::date, 'YYYY')
      FROM public.limbah_ruangan WHERE tanggal IS NOT NULL
      UNION
      SELECT DISTINCT to_char(tanggal::date, 'YYYY')
      FROM public.pengangkutan_limbah WHERE tanggal IS NOT NULL
    )
    SELECT jsonb_build_object(
      'availableYears', COALESCE((SELECT jsonb_agg(year ORDER BY year DESC) FROM available_years), '[]'::jsonb),
      'padatRows', COALESCE((SELECT jsonb_agg(to_jsonb(padat_rows) ORDER BY tanggal) FROM padat_rows), '[]'::jsonb),
      'ruanganRows', COALESCE((SELECT jsonb_agg(to_jsonb(ruangan_rows) ORDER BY tanggal) FROM ruangan_rows), '[]'::jsonb),
      'angkutRows', COALESCE((SELECT jsonb_agg(to_jsonb(pengangkutan_rows) ORDER BY tanggal) FROM pengangkutan_rows), '[]'::jsonb)
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.dashboard_pengangkutan_summary(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.dashboard_jenis_limbah_summary(integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.dashboard_anorganik_summary(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.dashboard_admin_inspeksi_summary(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.dashboard_missing_waste_dates(date, date) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.rekap_limbah_monthly_summary(jsonb, jsonb, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.rekap_limbah_yearly_summary(integer, jsonb, jsonb, jsonb) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.dashboard_pengangkutan_summary(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.dashboard_jenis_limbah_summary(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.dashboard_anorganik_summary(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.dashboard_admin_inspeksi_summary(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.dashboard_missing_waste_dates(date, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rekap_limbah_monthly_summary(jsonb, jsonb, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rekap_limbah_yearly_summary(integer, jsonb, jsonb, jsonb) TO authenticated;

COMMIT;

-- Setelah dijalankan, frontend otomatis memakai tujuh fungsi di atas.
-- Semua fungsi hanya tersedia untuk pengguna yang sudah login.
