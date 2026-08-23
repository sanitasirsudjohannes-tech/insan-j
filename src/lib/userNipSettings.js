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

export const buildUserNipState = (users, settingsRows = []) => {
  const settingsByKey = new Map(settingsRows.map((setting) => [setting.key, setting.value]));
  const legacyValue = settingsByKey.get(USER_NIP_SETTING_KEY);
  const legacyNips = legacyValue && typeof legacyValue === 'object' && !Array.isArray(legacyValue)
    ? legacyValue
    : {};
  const nips = {};
  const migrationSettings = [];

  users.forEach((user) => {
    const settingKey = getUserNipSettingKey(user.id);

    if (settingsByKey.has(settingKey)) {
      nips[user.id] = normalizeNip(settingsByKey.get(settingKey));
      return;
    }

    if (Object.prototype.hasOwnProperty.call(legacyNips, user.id)) {
      const nip = normalizeNip(legacyNips[user.id]);
      nips[user.id] = nip;
      migrationSettings.push({ key: settingKey, value: nip || '' });
      return;
    }

    nips[user.id] = null;
  });

  return {
    nips,
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

export const getUpdatedKepalaUnit = (kepalaUnit, userNips) => {
  if (!kepalaUnit?.userId) return kepalaUnit;

  return {
    ...kepalaUnit,
    nip: userNips[kepalaUnit.userId] || '',
  };
};
