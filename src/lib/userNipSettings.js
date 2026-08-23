export const USER_NIP_SETTING_KEY = 'nip_pengguna';
export const KEPALA_UNIT_SETTING_KEY = 'kepala_unit_sanitasi';

const randomInteger = (min, max) => {
  if (globalThis.crypto?.getRandomValues) {
    const values = new Uint32Array(1);
    globalThis.crypto.getRandomValues(values);
    return min + (values[0] % (max - min + 1));
  }

  return min + Math.floor(Math.random() * (max - min + 1));
};

export const generateTemporaryNip = (existingNips = new Set()) => {
  let nip = '';

  do {
    const birthYear = randomInteger(1975, 2001);
    const birthMonth = String(randomInteger(1, 12)).padStart(2, '0');
    const birthDay = String(randomInteger(1, 28)).padStart(2, '0');
    const appointmentYear = Math.min(birthYear + randomInteger(20, 28), new Date().getFullYear());
    const appointmentMonth = String(randomInteger(1, 12)).padStart(2, '0');
    const gender = randomInteger(1, 2);
    const sequence = String(randomInteger(1, 999)).padStart(3, '0');

    nip = `${birthYear}${birthMonth}${birthDay}${appointmentYear}${appointmentMonth}${gender}${sequence}`;
  } while (existingNips.has(nip));

  return nip;
};

export const createInitialUserNipMap = (users, storedNips) => {
  const nips = storedNips && typeof storedNips === 'object' && !Array.isArray(storedNips)
    ? { ...storedNips }
    : {};
  const existingNips = new Set(Object.values(nips).filter(Boolean));
  let hasNewNips = false;

  users.forEach((user) => {
    if (Object.prototype.hasOwnProperty.call(nips, user.id)) return;

    const temporaryNip = generateTemporaryNip(existingNips);
    nips[user.id] = temporaryNip;
    existingNips.add(temporaryNip);
    hasNewNips = true;
  });

  return { nips, hasNewNips };
};

export const getUpdatedKepalaUnit = (kepalaUnit, userNips) => {
  if (!kepalaUnit?.userId) return kepalaUnit;

  return {
    ...kepalaUnit,
    nip: userNips[kepalaUnit.userId] || '',
  };
};
