export const USER_NIP_SETTING_KEY = 'nip_pengguna';
export const KEPALA_UNIT_SETTING_KEY = 'kepala_unit_sanitasi';

export const getUserNipSettingKey = (userId) => `${USER_NIP_SETTING_KEY}_${userId}`;

export const getUserNipSettingKeys = (users) => [
  USER_NIP_SETTING_KEY,
  KEPALA_UNIT_SETTING_KEY,
  ...users.map((user) => getUserNipSettingKey(user.id)),
];

const normalizeNip = (value) => typeof value === 'string' && value.trim()
  ? value.trim()
  : null;

export const parseUserNipSetting = (value) => {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const nip = normalizeNip(value.nip);

    return {
      nip,
      verified: Boolean(nip && value.verified === true),
    };
  }

  return {
    nip: normalizeNip(value),
    verified: false,
  };
};

export const createUserNipSettingValue = (nip, verified = false) => ({
  nip: normalizeNip(nip) || '',
  verified: Boolean(normalizeNip(nip) && verified),
});

export const buildUserNipState = (users, settingsRows = []) => {
  const settingsByKey = new Map(settingsRows.map((setting) => [setting.key, setting.value]));
  const legacyValue = settingsByKey.get(USER_NIP_SETTING_KEY);
  const legacyNips = legacyValue && typeof legacyValue === 'object' && !Array.isArray(legacyValue)
    ? legacyValue
    : {};
  const nips = {};
  const verifiedNips = {};
  const migrationSettings = [];

  users.forEach((user) => {
    const settingKey = getUserNipSettingKey(user.id);

    if (settingsByKey.has(settingKey)) {
      const setting = parseUserNipSetting(settingsByKey.get(settingKey));
      nips[user.id] = setting.nip;
      verifiedNips[user.id] = setting.verified;
      return;
    }

    if (Object.prototype.hasOwnProperty.call(legacyNips, user.id)) {
      const nip = normalizeNip(legacyNips[user.id]);
      nips[user.id] = nip;
      verifiedNips[user.id] = false;
      migrationSettings.push({ key: settingKey, value: createUserNipSettingValue(nip) });
      return;
    }

    nips[user.id] = null;
    verifiedNips[user.id] = false;
  });

  return {
    nips,
    verifiedNips,
    migrationSettings,
    kepalaUnit: settingsByKey.get(KEPALA_UNIT_SETTING_KEY) || null,
  };
};

export const findDuplicateNipUserId = (userNips, currentUserId, nip) => {
  const normalizedNip = normalizeNip(nip);
  if (!normalizedNip) return null;

  const duplicate = Object.entries(userNips).find(([userId, storedNip]) => (
    userId !== String(currentUserId) && normalizeNip(storedNip) === normalizedNip
  ));

  return duplicate?.[0] || null;
};

export const getUpdatedKepalaUnit = (kepalaUnit, userNips, verifiedNips = {}) => {
  if (!kepalaUnit?.userId) return kepalaUnit;

  return {
    ...kepalaUnit,
    nip: userNips[kepalaUnit.userId] || '',
    nipVerified: Boolean(userNips[kepalaUnit.userId] && verifiedNips[kepalaUnit.userId]),
  };
};

export const findActiveKepalaUnit = (kepalaUnit, users) => {
  if (!kepalaUnit?.userId) return null;

  return users.find((user) => String(user.id) === String(kepalaUnit.userId)) || null;
};
