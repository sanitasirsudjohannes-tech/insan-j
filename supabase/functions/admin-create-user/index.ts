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
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return jsonResponse({ success: false, error: 'Metode tidak diizinkan.' }, 405);
  }

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
      return jsonResponse({ success: false, error: 'Hanya administrator yang dapat membuat akun.' }, 403);
    }

    const body = await request.json();
    const nama = String(body?.nama || '').trim();
    const username = String(body?.username || '').trim().toLowerCase();
    const password = String(body?.password || '');
    const role = String(body?.role || '').trim().toLowerCase();

    if (!nama || nama.length > 100) {
      return jsonResponse({ success: false, error: 'Nama pengguna tidak valid.' }, 400);
    }

    if (!/^[a-z0-9._-]{3,32}$/.test(username)) {
      return jsonResponse({ success: false, error: 'Username tidak valid.' }, 400);
    }

    if (!['user', 'mahasiswa'].includes(role)) {
      return jsonResponse({ success: false, error: 'Role hanya boleh Petugas atau Mahasiswa Praktik.' }, 400);
    }

    if (
      password.length < 12
      || !/[A-Z]/.test(password)
      || !/[a-z]/.test(password)
      || !/[0-9]/.test(password)
      || !/[^a-zA-Z0-9]/.test(password)
    ) {
      return jsonResponse({ success: false, error: 'Password sementara belum memenuhi standar keamanan.' }, 400);
    }

    const { data: duplicateProfile } = await adminClient
      .from('profiles')
      .select('id')
      .ilike('username', username)
      .maybeSingle();

    if (duplicateProfile) {
      return jsonResponse({ success: false, error: 'Username sudah digunakan.' }, 409);
    }

    const email = `${username}@rs.com`;
    const { data: createdAuth, error: createAuthError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { nama, username, role },
    });

    if (createAuthError || !createdAuth.user) {
      return jsonResponse({ success: false, error: createAuthError?.message || 'Akun Auth gagal dibuat.' }, 400);
    }

    // Proyek lama dapat memiliki trigger auth.users yang otomatis membuat
    // profiles. Upsert menangani kedua kondisi: profil sudah dibuat trigger
    // atau belum ada sama sekali.
    const { error: profileError } = await adminClient
      .from('profiles')
      .upsert({
        id: createdAuth.user.id,
        nama,
        username,
        role,
      }, { onConflict: 'id' });

    if (profileError) {
      await adminClient.auth.admin.deleteUser(createdAuth.user.id);
      return jsonResponse({ success: false, error: `Profil gagal dibuat: ${profileError.message}` }, 400);
    }

    return jsonResponse({
      success: true,
      user: { id: createdAuth.user.id, nama, username, role },
    }, 201);
  } catch (error) {
    console.error('admin-create-user error:', error);
    return jsonResponse({ success: false, error: 'Terjadi kesalahan pada server.' }, 500);
  }
});
