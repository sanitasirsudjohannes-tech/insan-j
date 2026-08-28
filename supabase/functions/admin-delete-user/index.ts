import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const jsonResponse = (body: Record<string, unknown>, status = 200) => new Response(
  JSON.stringify(body),
  { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
);

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return jsonResponse({ success: false, error: 'Metode tidak diizinkan.' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const authorization = request.headers.get('Authorization');

  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ success: false, error: 'Konfigurasi server belum lengkap.' }, 500);
  }
  if (!authorization?.startsWith('Bearer ')) {
    return jsonResponse({ success: false, error: 'Sesi administrator tidak ditemukan.' }, 401);
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    const token = authorization.slice('Bearer '.length);
    const { data: authData, error: authError } = await adminClient.auth.getUser(token);
    if (authError || !authData.user) {
      return jsonResponse({ success: false, error: 'Sesi administrator tidak valid.' }, 401);
    }

    const { data: callerProfile, error: callerError } = await adminClient
      .from('profiles')
      .select('id, role')
      .eq('id', authData.user.id)
      .single();
    if (callerError || callerProfile?.role?.toLowerCase() !== 'admin') {
      return jsonResponse({ success: false, error: 'Hanya administrator yang dapat menghapus akun.' }, 403);
    }

    const body = await request.json();
    const targetUserId = String(body?.userId || '').trim();
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(targetUserId)) {
      return jsonResponse({ success: false, error: 'ID pengguna tidak valid.' }, 400);
    }
    if (targetUserId === authData.user.id) {
      return jsonResponse({ success: false, error: 'Administrator tidak dapat menghapus akunnya sendiri.' }, 400);
    }

    const { data: targetProfile, error: targetError } = await adminClient
      .from('profiles')
      .select('id, nama, role')
      .eq('id', targetUserId)
      .maybeSingle();
    if (targetError) return jsonResponse({ success: false, error: targetError.message }, 400);
    if (!targetProfile) return jsonResponse({ success: false, error: 'Pengguna tidak ditemukan.' }, 404);
    if (targetProfile.role?.toLowerCase() === 'admin') {
      return jsonResponse({ success: false, error: 'Akun administrator tidak dapat dihapus melalui fitur ini.' }, 400);
    }

    const { data: kepalaSetting } = await adminClient
      .from('app_settings')
      .select('value')
      .eq('key', 'kepala_unit_sanitasi')
      .maybeSingle();
    if (String(kepalaSetting?.value?.userId || '') === targetUserId) {
      return jsonResponse({ success: false, error: 'Pengguna masih menjadi Kepala Unit Sanitasi. Pilih Kepala Unit lain terlebih dahulu.' }, 409);
    }

    const { error: deleteAuthError } = await adminClient.auth.admin.deleteUser(targetUserId);
    if (deleteAuthError) {
      return jsonResponse({ success: false, error: `Akun Auth gagal dihapus: ${deleteAuthError.message}` }, 400);
    }

    // Aman jika profiles sudah terhapus otomatis oleh cascade/trigger.
    await adminClient.from('profiles').delete().eq('id', targetUserId);
    await adminClient.from('app_settings').delete().eq('key', `nip_pengguna_${targetUserId}`);

    return jsonResponse({ success: true, deletedUser: { id: targetUserId, nama: targetProfile.nama } });
  } catch (error) {
    console.error('admin-delete-user error:', error);
    return jsonResponse({ success: false, error: 'Terjadi kesalahan pada server.' }, 500);
  }
});
