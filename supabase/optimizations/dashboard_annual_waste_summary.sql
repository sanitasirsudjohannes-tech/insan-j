-- Jalankan di Supabase SQL Editor untuk mengaktifkan empat kartu tahunan.
-- Tidak mengubah data limbah atau kebijakan RLS.
BEGIN;

CREATE OR REPLACE FUNCTION public.dashboard_pengangkutan_summary(
  requested_month text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH period AS (
    SELECT (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Makassar')::date AS as_of_date,
      date_trunc('year', CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Makassar')::date AS year_start
  ), movements AS (
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
    'annualSummary', (
      SELECT jsonb_build_object(
        'year', EXTRACT(YEAR FROM p.year_start)::integer,
        'asOfDate', p.as_of_date,
        'opening', COALESCE(SUM(b.masuk - b.diangkut) FILTER (WHERE b.tanggal < p.year_start), 0),
        'masuk', COALESCE(SUM(b.masuk) FILTER (WHERE b.tanggal >= p.year_start), 0),
        'diangkut', COALESCE(SUM(b.diangkut) FILTER (WHERE b.tanggal >= p.year_start), 0),
        'sisa', COALESCE(SUM(b.masuk - b.diangkut), 0)
      )
      FROM period p LEFT JOIN balances b ON b.tanggal <= p.as_of_date
      GROUP BY p.year_start, p.as_of_date
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


COMMIT;
