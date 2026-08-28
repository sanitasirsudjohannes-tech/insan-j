const PASSWORD_GROUPS = [
  'ABCDEFGHJKLMNPQRSTUVWXYZ',
  'abcdefghijkmnopqrstuvwxyz',
  '23456789',
  '!@#$%&*?',
];

const getSecureIndex = (max) => {
  if (!globalThis.crypto?.getRandomValues) {
    throw new Error('Browser tidak mendukung pembuatan password sementara yang aman.');
  }

  const values = new Uint32Array(1);
  globalThis.crypto.getRandomValues(values);
  return values[0] % max;
};

export const generateSecureTemporaryPassword = (length = 16) => {
  if (length < 12) {
    throw new Error('Password sementara harus memiliki minimal 12 karakter.');
  }

  const alphabet = PASSWORD_GROUPS.join('');
  const password = PASSWORD_GROUPS.map((group) => group[getSecureIndex(group.length)]);

  while (password.length < length) {
    password.push(alphabet[getSecureIndex(alphabet.length)]);
  }

  for (let index = password.length - 1; index > 0; index -= 1) {
    const randomIndex = getSecureIndex(index + 1);
    [password[index], password[randomIndex]] = [password[randomIndex], password[index]];
  }

  return password.join('');
};

export const escapeAdminHTML = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#039;');

export const isVerifiedAdminProfile = (profile, authenticatedUserId, cachedUserId) => (
  Boolean(authenticatedUserId)
  && String(profile?.id) === String(authenticatedUserId)
  && String(cachedUserId) === String(authenticatedUserId)
  && profile?.role?.toLowerCase() === 'admin'
);
