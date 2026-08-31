import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

export const operationalTables = {
  limbah_padat: { label: 'Limbah Padat', dateColumn: 'tanggal' },
  limbah_ruangan: { label: 'Limbah Per Ruangan', dateColumn: 'tanggal' },
  limbah_anorganik: { label: 'Limbah Anorganik', dateColumn: 'tanggal' },
  pengangkutan_limbah: { label: 'Pengangkutan Limbah', dateColumn: 'tanggal' },
  ruang_bangunan: { label: 'Pemeriksaan Ruang Bangunan', dateColumn: 'tanggal_pemeriksaan' },
  limbah_medis: { label: 'Pemeriksaan Pengolahan Limbah', dateColumn: 'tanggal_pemeriksaan' },
  pemeriksaan_toilet: { label: 'Pemeriksaan Toilet', dateColumn: 'tanggal_pemeriksaan' },
  pemeriksaan_reservoir: { label: 'Pemeriksaan Reservoir', dateColumn: 'tanggal_pemeriksaan' },
  pemeriksaan_gizi: { label: 'Pemeriksaan Gizi', dateColumn: 'tanggal_pemeriksaan' },
} as const;

export type OperationalTableName = keyof typeof operationalTables;

export const jsonResponse = (body: Record<string, unknown>, status = 200) => new Response(
  JSON.stringify(body),
  { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
);

export const getErrorMessage = (error: unknown) => (
  error instanceof Error && error.message
    ? error.message
    : 'Terjadi kesalahan pada server.'
);

export interface AdminContext {
  adminClient: SupabaseClient;
  userId: string;
}

export const getAdminContext = async (request: Request): Promise<AdminContext> => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const authorization = request.headers.get('Authorization');

  if (!supabaseUrl || !serviceRoleKey) {
    throw Object.assign(new Error('Konfigurasi server belum lengkap.'), { status: 500 });
  }
  if (!authorization?.startsWith('Bearer ')) {
    throw Object.assign(new Error('Sesi administrator tidak ditemukan.'), { status: 401 });
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const token = authorization.slice('Bearer '.length);
  const { data: authData, error: authError } = await adminClient.auth.getUser(token);

  if (authError || !authData.user) {
    throw Object.assign(new Error('Sesi administrator tidak valid.'), { status: 401 });
  }

  const { data: callerProfile, error: callerError } = await adminClient
    .from('profiles')
    .select('id, role')
    .eq('id', authData.user.id)
    .single();

  if (callerError || callerProfile?.role?.toLowerCase() !== 'admin') {
    throw Object.assign(new Error('Hanya administrator yang dapat mengakses Backup & Arsip.'), { status: 403 });
  }

  return { adminClient, userId: authData.user.id };
};

const normalizeDate = (value: unknown) => String(value || '').trim();

const isValidIsoDate = (value: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
};

export const validatePeriod = (startValue: unknown, endValue: unknown) => {
  const start = normalizeDate(startValue);
  const end = normalizeDate(endValue);
  if (!isValidIsoDate(start) || !isValidIsoDate(end)) {
    throw Object.assign(new Error('Periode backup tidak valid.'), { status: 400 });
  }
  if (end < start) {
    throw Object.assign(new Error('Tanggal akhir tidak boleh lebih awal dari tanggal mulai.'), { status: 400 });
  }
  return { start, end };
};

export const validateTables = (value: unknown): OperationalTableName[] => {
  if (!Array.isArray(value) || value.length === 0) {
    throw Object.assign(new Error('Pilih minimal satu jenis data.'), { status: 400 });
  }

  const uniqueTables = [...new Set(value.map(item => String(item)))] as OperationalTableName[];
  if (uniqueTables.some(table => !(table in operationalTables))) {
    throw Object.assign(new Error('Terdapat jenis data yang tidak diizinkan.'), { status: 400 });
  }
  return uniqueTables;
};

export const fetchAllRows = async (
  adminClient: SupabaseClient,
  table: OperationalTableName,
  start: string,
  end: string,
) => {
  const rows: Record<string, unknown>[] = [];
  const pageSize = 500;
  let from = 0;
  const dateColumn = operationalTables[table].dateColumn;

  while (true) {
    const { data, error } = await adminClient
      .from(table)
      .select('*')
      .gte(dateColumn, start)
      .lte(dateColumn, end)
      .order(dateColumn, { ascending: true })
      .order('id', { ascending: true })
      .range(from, from + pageSize - 1);

    if (error) throw new Error(`Data ${operationalTables[table].label} gagal dimuat: ${error.message}`);
    const batch = Array.isArray(data) ? data as Record<string, unknown>[] : [];
    rows.push(...batch);
    if (batch.length < pageSize) return rows;
    from += batch.length;
  }
};

export const sha256 = async (value: string) => {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('');
};

export const getMaintenanceMode = async (adminClient: SupabaseClient) => {
  const { data, error } = await adminClient
    .from('app_settings')
    .select('value')
    .eq('key', 'operational_maintenance_mode')
    .maybeSingle();
  if (error) throw new Error(`Mode pemeliharaan gagal dibaca: ${error.message}`);
  return data?.value === true;
};

export const insertAuditLog = async (
  adminClient: SupabaseClient,
  action: string,
  actorId: string,
  details: Record<string, unknown> = {},
  archiveId: string | null = null,
  restoreSessionId: string | null = null,
) => {
  const { error } = await adminClient.from('admin_audit_logs').insert({
    action,
    actor_id: actorId,
    archive_id: archiveId,
    restore_session_id: restoreSessionId,
    details,
  });
  if (error) throw new Error(`Audit aktivitas gagal disimpan: ${error.message}`);
};

export const expectedDeleteConfirmation = (start: string, end: string) => {
  const startYear = start.slice(0, 4);
  const isFullYear = start === `${startYear}-01-01` && end === `${startYear}-12-31`;
  return isFullYear
    ? `HAPUS DATA ${startYear}`
    : `HAPUS DATA ${start} ${end}`;
};

export const isUuid = (value: unknown) => (
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    .test(String(value || '').trim())
);

export const getStatusCode = (error: unknown) => {
  const value = Number((error as { status?: unknown })?.status);
  return Number.isInteger(value) && value >= 400 && value <= 599 ? value : 500;
};
