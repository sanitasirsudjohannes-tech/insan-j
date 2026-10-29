const ROMAN_NUMBERS = new Map([['i', '1'], ['ii', '2'], ['iii', '3'], ['iv', '4'], ['v', '5'], ['vi', '6'], ['vii', '7'], ['viii', '8'], ['ix', '9'], ['x', '10']]);
const GENERIC_ROOM_WORDS = /^(?:mana|apa|yang|bulan|tahun|ini|tersebut|itu)$/i;

export function normalizeRoomName(value) {
  return String(value || '').toLocaleLowerCase('id-ID')
    .normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\b(?:ruang|ruangan|unit|bangsal)\b/g, ' ')
    .replace(/[.,?;:()]/g, ' ')
    .split(/\s+/).filter(Boolean)
    .map(word => ROMAN_NUMBERS.get(word) || word)
    .join(' ');
}

export function cleanRoomCandidate(value) {
  const candidate = String(value || '').trim();
  return !candidate || GENERIC_ROOM_WORDS.test(candidate) ? null : candidate;
}

export function findRoomCandidates(question, roomNames = []) {
  const normalizedQuestion = ` ${normalizeRoomName(question)} `;
  const exact = roomNames.filter(name => normalizedQuestion.includes(` ${normalizeRoomName(name)} `));
  if (exact.length) return exact;
  return roomNames.filter(name => {
    const firstDistinctiveWord = normalizeRoomName(name).split(' ').find(word => word.length >= 4);
    return firstDistinctiveWord && normalizedQuestion.includes(` ${firstDistinctiveWord} `);
  });
}

function editDistance(left, right) {
  const row = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    let diagonal = row[0];
    row[0] = leftIndex;
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      const previous = row[rightIndex];
      row[rightIndex] = Math.min(row[rightIndex] + 1, row[rightIndex - 1] + 1, diagonal + (left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1));
      diagonal = previous;
    }
  }
  return row[right.length];
}

export function findFuzzyRoomCandidates(question, roomNames = []) {
  const tokens = normalizeRoomName(question).split(/\s+/).filter(Boolean);
  const scored = roomNames.filter(Boolean).map(name => {
    const normalizedName = normalizeRoomName(name);
    if (normalizedName.length < 5) return { name, distance: Infinity };
    const nameTokens = normalizedName.split(' ');
    const variants = [normalizedName];
    if (!tokens.some(token => /^\d+$/.test(token)) && /^\d+$/.test(nameTokens.at(-1))) variants.push(nameTokens.slice(0, -1).join(' '));
    let distance = Infinity;
    variants.forEach(variant => {
      const count = variant.split(' ').length;
      for (let index = 0; index < tokens.length; index += 1) {
        const candidate = tokens.slice(index, index + count).join(' ');
        if (candidate.length >= 4) distance = Math.min(distance, editDistance(candidate, variant));
      }
    });
    return { name, distance };
  });
  const best = Math.min(...scored.map(item => item.distance));
  if (!Number.isFinite(best)) return [];
  return scored
    .filter(item => item.distance === best && item.distance <= (normalizeRoomName(item.name).length >= 8 ? 2 : 1))
    .map(item => item.name);
}

export function resolveKnownRoom(question, roomNames = []) {
  const normalizedQuestion = ` ${normalizeRoomName(question)} `;
  const sortedRooms = [...roomNames]
    .filter(Boolean)
    .sort((left, right) => normalizeRoomName(right).length - normalizeRoomName(left).length);
  const exact = sortedRooms.find(name => normalizedQuestion.includes(` ${normalizeRoomName(name)} `));
  if (exact) return exact;
  const namedCandidates = findRoomCandidates(question, sortedRooms);
  if (namedCandidates.length === 1) return namedCandidates[0];
  if (namedCandidates.length > 1) return null;
  const fuzzy = findFuzzyRoomCandidates(question, sortedRooms);
  return fuzzy.length === 1 ? fuzzy[0] : null;
}
