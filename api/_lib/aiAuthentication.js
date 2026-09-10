import { createClient } from '@supabase/supabase-js';

const ALLOWED_ROLES = new Set(['admin', 'petugas', 'user']);

export async function authenticateAiUser(req) {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');
  if (!token) return { error: 'AUTH_REQUIRED' };
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) return { error: 'SERVER_CONFIG_ERROR' };
  const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false }, global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return { error: 'AUTH_REQUIRED' };
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', data.user.id).maybeSingle();
  const role = String(profile?.role || data.user.user_metadata?.role || '').trim().toLowerCase();
  if (!ALLOWED_ROLES.has(role)) return { error: 'FORBIDDEN_ROLE' };
  return { user: data.user };
}
