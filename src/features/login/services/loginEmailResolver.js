import { supabase } from '../../../lib/supabase';
import { withTimeout } from '../../../lib/asyncTimeout';
import { buildUsernameCandidates, isEmailUsername } from '../domain/loginCredentials';

const LOOKUP_TIMEOUT_MS = 8000;

// Cache in-memory per sesi halaman. Tidak disimpan ke storage agar data akun
// tidak tertinggal di perangkat setelah tab ditutup.
const resolvedEmails = new Map();

function asEmail(value) {
  if (typeof value !== 'string') return '';
  const email = value.trim();
  return email.includes('@') ? email : '';
}

const isMissingFunctionError = error => {
  const code = String(error?.code || '').toUpperCase();
  const message = String(error?.message || '').toLowerCase();
  return code === 'PGRST202'
    || code === '42883'
    || message.includes('could not find the function')
    || (message.includes('function') && message.includes('does not exist'));
};

const toLookupError = cause => Object.assign(
  new Error('Tidak dapat memeriksa akun. Periksa koneksi internet lalu coba lagi.'),
  {
    code: cause?.code === 'login_lookup_timeout' ? 'login_lookup_timeout' : 'login_lookup_failed',
    cause,
  },
);

async function lookupEmail(functionName, username) {
  let response;
  try {
    response = await withTimeout(
      supabase.rpc(functionName, { p_username: username }),
      LOOKUP_TIMEOUT_MS,
      {
        code: 'login_lookup_timeout',
        message: 'Pemeriksaan akun terlalu lama.',
      },
    );
  } catch (error) {
    if (isMissingFunctionError(error)) throw error;
    throw toLookupError(error);
  }

  if (response.error) {
    if (isMissingFunctionError(response.error)) throw response.error;
    throw toLookupError(response.error);
  }

  return asEmail(response.data);
}

async function resolveWithLegacyRpc(username) {
  const candidates = [username, ...buildUsernameCandidates(username)];
  const seen = new Set();

  for (const candidate of candidates) {
    if (!candidate || seen.has(candidate)) continue;
    seen.add(candidate);

    try {
      const email = await lookupEmail('get_user_email_by_username', candidate);
      if (email) return email;
    } catch (error) {
      // Fungsi legacy tidak tersedia: lanjut ke tebakan email default.
      if (isMissingFunctionError(error)) return '';
      throw error;
    }
  }

  return '';
}

export async function resolveLoginEmail(rawUsername) {
  const trimmed = String(rawUsername || '').trim();
  if (!trimmed) return '';
  if (isEmailUsername(trimmed)) return trimmed;

  const cacheKey = trimmed.toLowerCase();
  const cached = resolvedEmails.get(cacheKey);
  if (cached) return cached;

  try {
    // Jalur utama: satu RPC yang sudah menangani trim + case-insensitive.
    const email = await lookupEmail('resolve_login_email', trimmed);
    if (email) {
      resolvedEmails.set(cacheKey, email);
      return email;
    }

    // Fungsi tersedia tetapi tidak menemukan profil. Kembalikan tebakan lama
    // agar akun tanpa profil tetap mendapat pesan "Profil Tidak Ditemukan".
    return `${trimmed.toLowerCase()}@rs.com`;
  } catch (error) {
    if (!isMissingFunctionError(error)) throw error;
  }

  // Hanya dipakai ketika migrasi resolve_login_email belum tersedia.
  const legacyEmail = await resolveWithLegacyRpc(trimmed);
  if (legacyEmail) {
    resolvedEmails.set(cacheKey, legacyEmail);
    return legacyEmail;
  }

  return `${trimmed.toLowerCase()}@rs.com`;
}
