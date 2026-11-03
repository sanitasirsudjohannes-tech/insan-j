export function buildUsernameCandidates(rawUsername) {
  const trimmed = String(rawUsername || '').trim();
  if (!trimmed) return [];

  const lower = trimmed.toLowerCase();
  const title = lower.charAt(0).toUpperCase() + lower.slice(1);
  const upper = trimmed.toUpperCase();
  return [...new Set([trimmed, lower, title, upper])];
}

export function isEmailUsername(rawUsername) {
  return String(rawUsername || '').trim().includes('@');
}

const isNetworkError = error => {
  const code = String(error?.code || '');
  if (['login_lookup_failed', 'login_lookup_timeout', 'login_timeout', 'session_timeout'].includes(code)) {
    return true;
  }
  if (error?.name === 'AuthRetryableFetchError' || error?.name === 'TimeoutError') return true;

  const message = String(error?.message || '').toLowerCase();
  return message.includes('failed to fetch')
    || message.includes('network')
    || message.includes('timeout')
    || message.includes('terlalu lama');
};

export function getLoginErrorMessage(error) {
  if (isNetworkError(error)) {
    return 'Tidak dapat menghubungi server. Periksa koneksi internet, lalu coba lagi.';
  }

  switch (error?.code) {
    case 'invalid_credentials':
      return 'Username atau password salah!';
    case 'email_not_confirmed':
      return 'Email akun belum dikonfirmasi. Hubungi administrator.';
    case 'user_banned':
      return 'Akun ini sedang diblokir. Hubungi administrator.';
    case 'over_request_rate_limit':
    case 'too_many_requests':
      return 'Terlalu banyak percobaan login. Tunggu beberapa saat lalu coba lagi.';
    default:
      return 'Login gagal. Periksa username dan password, lalu coba lagi.';
  }
}
