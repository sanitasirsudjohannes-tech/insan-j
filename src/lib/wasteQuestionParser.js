import { ALLOWED_INTENTS, MONTH_PATTERN, MONTHS, QUESTION_SUGGESTIONS, WASTE_TYPES } from '../features/waste-chat/constants/wasteQuestionConstants.js';
import { detectWasteIntent } from '../features/waste-chat/parsers/intentParser.js';
import { cleanRoomCandidate, findRoomCandidates, resolveKnownRoom } from '../features/waste-chat/parsers/roomNameResolver.js';

export { QUESTION_SUGGESTIONS, WASTE_TYPES };
const iso = (year, month, day) => `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
const capitalize = value => `${value[0].toUpperCase()}${value.slice(1)}`;

const currentWita = () => {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en', { timeZone: 'Asia/Makassar', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date()).map(part => [part.type, part.value]));
  return { year: Number(parts.year), month: Number(parts.month), day: Number(parts.day) };
};

function validDate(year, month, day) {
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function dateLabel(value) {
  const [year, month, day] = value.split('-').map(Number);
  return `${day} ${capitalize(MONTHS[month - 1])} ${year}`;
}

function makeRange(start, end, inferredYear = false) {
  if (!/^20\d{2}-\d{2}-\d{2}$/.test(start) || !/^20\d{2}-\d{2}-\d{2}$/.test(end) || start > end) return null;
  if (start === end) {
    const [year, month, day] = start.split('-').map(Number);
    return { year, month, day, start, end, label: dateLabel(start), scope: 'day', inferredYear };
  }
  return { year: Number(start.slice(0, 4)), month: null, day: null, start, end, label: `${dateLabel(start)} sampai ${dateLabel(end)}`, scope: 'range', inferredYear };
}

function makeMonthPeriod(year, month, inferredYear) {
  return {
    year,
    month,
    day: null,
    start: iso(year, month, 1),
    end: iso(year, month, new Date(Date.UTC(year, month, 0)).getUTCDate()),
    label: `${capitalize(MONTHS[month - 1])} ${year}`,
    scope: 'month',
    inferredYear,
  };
}

function extractExplicitComparisonPeriods(question) {
  if (!/banding|perbandingan|dibanding|selisih|\bvs\.?\b/i.test(question)) return null;
  const now = currentWita();
  const sharedYear = Number(question.match(/\b(20\d{2})\b/)?.[1] || now.year);
  const comparisonParts = question.split(/\s+(?:dengan|dan|versus|vs\.?)\s+/i);
  if (comparisonParts.length === 2) {
    const dates = comparisonParts.map(part => parsePointDate(part, now, sharedYear));
    if (dates.every(Boolean)) return { comparisonPeriod: makeRange(dates[0], dates[0], !/\b20\d{2}\b/.test(comparisonParts[0])), period: makeRange(dates[1], dates[1], !/\b20\d{2}\b/.test(comparisonParts[1])) };
  }
  const matches = [...question.matchAll(new RegExp(`\\b(${MONTH_PATTERN})(?:\\s+(20\\d{2}))?\\b`, 'gi'))];
  if (matches.length >= 2) {
    const periods = matches.map(match => {
      const month = MONTHS.indexOf(match[1].toLowerCase()) + 1;
      const explicitYear = match[2] ? Number(match[2]) : null;
      return makeMonthPeriod(explicitYear || sharedYear, month, !explicitYear && !/\b20\d{2}\b/.test(question));
    }).filter((period, index, all) => all.findIndex(item => item.start === period.start) === index);
    return {
      comparisonPeriod: periods[0],
      period: periods.at(-1),
      comparisonPeriods: periods,
      requestedComparisonCount: periods.length,
      tooManyComparisonMonths: periods.length > 3,
    };
  }
  const yearMatches = [...question.matchAll(/\b(20\d{2})\b/g)].map(match => Number(match[1]));
  if (!matches.length && yearMatches.length >= 2) {
    const periods = yearMatches.slice(0, 2).map(year => ({ year, month: null, day: null, start: `${year}-01-01`, end: `${year}-12-31`, label: `tahun ${year}`, scope: 'year', inferredYear: false }));
    return { comparisonPeriod: periods[0], period: periods[1] };
  }
  const parts = question.split(/\s+(?:dengan|dan|versus|vs\.?)\s+/i);
  if (parts.length === 2) {
    const dates = parts.map(part => parsePointDate(part, now, sharedYear));
    if (dates.every(Boolean)) return { comparisonPeriod: makeRange(dates[0], dates[0], !/\b20\d{2}\b/.test(parts[0])), period: makeRange(dates[1], dates[1], !/\b20\d{2}\b/.test(parts[1])) };
  }
  return null;
}

function parsePointDate(text, now, fallbackYear) {
  if (/hari\s+ini|sekarang/i.test(text)) return iso(now.year, now.month, now.day);
  if (/\bkemarin\b/i.test(text) && !/(?:\bbulan|\btahun)\s+kemarin/i.test(text)) return new Date(Date.UTC(now.year, now.month - 1, now.day - 1)).toISOString().slice(0, 10);
  const numeric = text.match(/\b([0-2]?\d|3[01])[/-](0?\d|1[0-2])(?:[/-](20\d{2}))?\b/);
  if (numeric) {
    const year = Number(numeric[3] || fallbackYear || now.year);
    const month = Number(numeric[2]);
    const day = Number(numeric[1]);
    return validDate(year, month, day) ? iso(year, month, day) : null;
  }
  const named = text.match(new RegExp(`\\b([0-2]?\\d|3[01])\\s+(${MONTH_PATTERN})(?:\\s+(20\\d{2}))?\\b`, 'i'));
  if (named) {
    const year = Number(named[3] || fallbackYear || now.year);
    const month = MONTHS.indexOf(named[2].toLowerCase()) + 1;
    const day = Number(named[1]);
    return validDate(year, month, day) ? iso(year, month, day) : null;
  }
  const tagged = text.match(/(?:per\s*tanggal|pertanggal|tanggal|tgl\.?)\s*([0-2]?\d|3[01])\b/i);
  if (tagged) {
    const year = Number(fallbackYear || now.year);
    const day = Number(tagged[1]);
    return validDate(year, now.month, day) ? iso(year, now.month, day) : null;
  }
  return null;
}

function extractPeriod(question) {
  const lower = question.toLowerCase();
  const now = currentWita();
  const globalYear = Number(lower.match(/\b(20\d{2})\b/)?.[1] || now.year);
  const today = iso(now.year, now.month, now.day);
  if (/banding|dibanding|perbandingan/i.test(lower) && /bulan\s+(?:lalu|kemarin|sebelumnya)/i.test(lower) && !/bulan\s+ini/i.test(lower)) {
    return makeMonthPeriod(now.year, now.month, true);
  }
  if (/bulan\s+(?:mana|apa).*(?:terbesar|terbanyak|tertinggi|paling)|(?:terbesar|terbanyak|tertinggi|paling).*(?:bulan\s+(?:mana|apa))/i.test(lower)) {
    return { year: globalYear, month: null, day: null, start: `${globalYear}-01-01`, end: `${globalYear}-12-31`, label: `tahun ${globalYear}`, scope: 'year', inferredYear: !/\b20\d{2}\b/.test(lower) };
  }
  const lastDays = lower.match(/(?:dalam\s+)?(\d{1,3})\s+hari\s+terakhir/i);
  if (lastDays) {
    const days = Math.min(Math.max(Number(lastDays[1]), 1), 366);
    const start = new Date(Date.UTC(now.year, now.month - 1, now.day - days + 1)).toISOString().slice(0, 10);
    return makeRange(start, today, true);
  }
  if (/minggu\s+ini|pekan\s+ini/i.test(lower)) {
    const todayDate = new Date(`${today}T00:00:00Z`);
    const daysSinceMonday = (todayDate.getUTCDay() + 6) % 7;
    const start = new Date(todayDate.getTime() - daysSinceMonday * 86400000).toISOString().slice(0, 10);
    return makeRange(start, today, true);
  }
  if (/(?:\bbulan\s+(?:lalu|kemarin)|\bbulan\s+sebelumnya)/i.test(lower)) {
    const previous = new Date(Date.UTC(now.year, now.month - 2, 1));
    const year = previous.getUTCFullYear();
    const month = previous.getUTCMonth() + 1;
    return { year, month, day: null, start: iso(year, month, 1), end: iso(year, month, new Date(Date.UTC(year, month, 0)).getUTCDate()), label: `${capitalize(MONTHS[month - 1])} ${year}`, scope: 'month', inferredYear: true };
  }
  if (/(?:\btahun\s+(?:lalu|kemarin)|\btahun\s+sebelumnya)/i.test(lower)) {
    const year = now.year - 1;
    return { year, month: null, day: null, start: `${year}-01-01`, end: `${year}-12-31`, label: `tahun ${year}`, scope: 'year', inferredYear: true };
  }
  const sharedMonthRange = lower.match(new RegExp(`(?:tanggal|tgl\\.?)?\\s*([0-2]?\\d|3[01])\\s*(?:-|sampai(?:\\s+dengan)?|hingga|s\\.?d\\.?)\\s*([0-2]?\\d|3[01])\\s+(${MONTH_PATTERN})(?:\\s+(20\\d{2}))?\\b`, 'i'));
  if (sharedMonthRange) {
    const year = Number(sharedMonthRange[4] || globalYear);
    const month = MONTHS.indexOf(sharedMonthRange[3].toLowerCase()) + 1;
    const startDay = Number(sharedMonthRange[1]);
    const endDay = Number(sharedMonthRange[2]);
    if (validDate(year, month, startDay) && validDate(year, month, endDay)) {
      const range = makeRange(iso(year, month, startDay), iso(year, month, endDay), !sharedMonthRange[4]);
      if (range) return range;
    }
  }
  const rangeParts = lower.split(/\s+(?:sampai(?:\s+dengan)?|hingga|s\.?d\.?)\s+|\s+-\s+/i);
  if (rangeParts.length === 2) {
    const start = parsePointDate(rangeParts[0], now, globalYear);
    const end = parsePointDate(rangeParts[1], now, globalYear);
    const range = start && end ? makeRange(start, end, !/\b20\d{2}\b/.test(lower)) : null;
    if (range) return range;
  }
  const pointDate = parsePointDate(lower, now, globalYear);
  if (pointDate) return makeRange(pointDate, pointDate, !/\b20\d{2}\b/.test(lower));

  const namedMonth = MONTHS.findIndex(name => lower.includes(name));
  const numericMonth = lower.match(/bulan\s+(1[0-2]|0?[1-9])\b/i);
  const yearMatch = lower.match(/\b(20\d{2})\b/);
  const hasExplicitMonth = namedMonth >= 0 || Boolean(numericMonth) || /bulan\s+ini/i.test(lower);
  const year = yearMatch ? Number(yearMatch[1]) : now.year;
  if ((yearMatch || /tahun\s+(?:ini|berjalan)/i.test(lower)) && !hasExplicitMonth) return { year, month: null, day: null, start: `${year}-01-01`, end: `${year}-12-31`, label: `tahun ${year}`, scope: 'year', inferredYear: false };
  const month = namedMonth >= 0 ? namedMonth + 1 : numericMonth ? Number(numericMonth[1]) : now.month;
  return { year, month, day: null, start: iso(year, month, 1), end: iso(year, month, new Date(Date.UTC(year, month, 0)).getUTCDate()), label: `${capitalize(MONTHS[month - 1])} ${year}`, scope: 'month', inferredYear: !yearMatch };
}

function aiPeriod(interpretation) {
  if (interpretation?.startDate && interpretation?.endDate) return makeRange(String(interpretation.startDate), String(interpretation.endDate), Boolean(interpretation.inferredYear));
  const year = Number(interpretation?.year);
  const month = interpretation?.month === null ? null : Number(interpretation?.month);
  const day = interpretation?.day === null || interpretation?.day === undefined ? null : Number(interpretation.day);
  if (!Number.isInteger(year) || year < 2000 || year > 2100) return null;
  if (month === null) return { year, month: null, day: null, start: `${year}-01-01`, end: `${year}-12-31`, label: `tahun ${year}`, scope: 'year', inferredYear: Boolean(interpretation.inferredYear) };
  if (!Number.isInteger(month) || month < 1 || month > 12) return null;
  if (day !== null) return validDate(year, month, day) ? makeRange(iso(year, month, day), iso(year, month, day), Boolean(interpretation.inferredYear)) : null;
  return { year, month, day: null, start: iso(year, month, 1), end: iso(year, month, new Date(Date.UTC(year, month, 0)).getUTCDate()), label: `${capitalize(MONTHS[month - 1])} ${year}`, scope: 'month', inferredYear: Boolean(interpretation.inferredYear) };
}

export function normalizeAiWasteQuestion(question, interpretation) {
  const intent = ALLOWED_INTENTS.has(interpretation?.intent) ? interpretation.intent : 'unknown';
  if (intent === 'unknown') return parseWasteQuestion(question);
  const period = aiPeriod(interpretation);
  if (!period) return parseWasteQuestion(question);
  const requestedKeys = interpretation.typeKeys || [interpretation.typeKey];
  const types = WASTE_TYPES.filter(item => requestedKeys.includes(item.key));
  if (intent === 'type_total' && types.length !== 1) return parseWasteQuestion(question);
  const roomName = String(interpretation.roomName || '').trim() || null;
  if (['room_total', 'room_contribution', 'room_type_total', 'room_type_dates'].includes(intent) && !roomName) return parseWasteQuestion(question);
  if (['room_type_total', 'room_type_dates', 'type_dates', 'type_rooms', 'never_type_rooms'].includes(intent) && types.length !== 1) return parseWasteQuestion(question);
  return { intent, type: types[0], types, roomName, question: String(question || '').trim(), assistedByAi: true, period };
}

export function parseWasteQuestion(question, context = null, knownRooms = []) {
  const text = String(question || '').trim();
  const contextPeriod = context?.period || context;
  const explicitComparison = extractExplicitComparisonPeriods(text);
  const referencesPreviousPeriod = /(?:tanggal|tgl|periode|waktu)\s+(?:itu|tersebut|lainnya)|di\s+sana/i.test(text);
  const period = explicitComparison?.period || (referencesPreviousPeriod && contextPeriod ? { ...contextPeriod } : extractPeriod(text));
  let types = WASTE_TYPES.filter(item => item.pattern.test(text));
  const referencesPreviousType = /(?:jenis|limbah)\s+(?:itu|tersebut)|jenis\s+yang\s+sama/i.test(text);
  if (!types.length && referencesPreviousType && context?.type) types = [context.type];
  const type = types[0];
  const explicitRoom = cleanRoomCandidate(text.match(/(?:ruang(?:an)?|unit|bangsal)\s+(.+?)(?=\s+(?:tanggal|tgl\.?|pertanggal|bulan|tahun|dari|pada|berapa|yang|ada|januari|februari|maret|april|mei|juni|juli|agustus|september|oktober|november|desember)\b|[?.,]|$)/i)?.[1]);
  const referencesPreviousRoom = /(?:ruang|ruangan|unit|bangsal)\s+(?:itu|tersebut|yang sama)/i.test(text);
  const matchedRooms = findRoomCandidates(text, knownRooms);
  let roomName = resolveKnownRoom(text, knownRooms) || (referencesPreviousRoom ? context?.roomName : null) || explicitRoom;
  let intent = detectWasteIntent(text, { type, types, roomName });
  if (['type_rooms', 'never_type_rooms', 'missing_rooms'].includes(intent) && matchedRooms.length === 0) roomName = null;
  if (/tanggal.*(?:lain|itu|tersebut)/i.test(text) && context?.intent) {
    if (context.roomName && type) intent = 'room_type_dates';
    else if (type) intent = 'type_dates';
    else if (/transport|angkut/i.test(context.intent)) intent = 'transport_dates';
  }
  return {
    intent,
    period,
    comparisonPeriod: explicitComparison?.comparisonPeriod || null,
    comparisonPeriods: explicitComparison?.comparisonPeriods || null,
    requestedComparisonCount: explicitComparison?.requestedComparisonCount || null,
    tooManyComparisonMonths: Boolean(explicitComparison?.tooManyComparisonMonths),
    type,
    types,
    roomName,
    roomNames: matchedRooms,
    question: text,
  };
}
