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
  const questionTokens = normalizedQuestion.trim().split(/\s+/);
  return sortedRooms.find(name => {
    const normalizedName = normalizeRoomName(name);
    if (normalizedName.length < 5) return false;
    const tokenCount = normalizedName.split(' ').length;
    return questionTokens.some((_, index) => {
      const candidate = questionTokens.slice(index, index + tokenCount).join(' ');
      return candidate.length >= 4 && editDistance(candidate, normalizedName) <= (normalizedName.length >= 8 ? 2 : 1);
    });
  }) || null;
}
