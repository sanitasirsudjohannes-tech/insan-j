const MONTHS = ['januari', 'februari', 'maret', 'april', 'mei', 'juni', 'juli', 'agustus', 'september', 'oktober', 'november', 'desember'];
export const WASTE_TYPES = [
  { pattern: /infeksius/i, key: 'infectiousKg', label: 'limbah infeksius' },
  { pattern: /jarum|benda tajam/i, key: 'sharpsKg', label: 'limbah jarum suntik' },
  { pattern: /botol(?: obat)?/i, key: 'bottleKg', label: 'limbah botol obat' },
  { pattern: /sitotoksik/i, key: 'cytotoxicKg', label: 'limbah sitotoksik' },
];

const ALLOWED_INTENTS = new Set(['remaining', 'generated', 'transported', 'average', 'dominant_type', 'top_rooms', 'comparison', 'type_total']);

const currentWita = () => {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en', { timeZone: 'Asia/Makassar', year: 'numeric', month: '2-digit' }).formatToParts(new Date()).map(part => [part.type, part.value]));
  return { year: Number(parts.year), month: Number(parts.month) };
};

function extractPeriod(question) {
  const lower = question.toLowerCase();
  const now = currentWita();
  const numericDate = lower.match(/\b([0-2]?\d|3[01])[/-](0?\d|1[0-2])[/-](20\d{2})\b/);
  const namedMonth = MONTHS.findIndex(name => lower.includes(name));
  const numericMonth = lower.match(/bulan\s+(1[0-2]|0?[1-9])\b/i);
  const yearMatch = numericDate || lower.match(/\b(20\d{2})\b/);
  const mentionedDay = numericDate ? Number(numericDate[1]) : Number(lower.match(/(?:per\s+)?tanggal\s+([0-2]?\d|3[01])\b/i)?.[1] || 0);
  const mentionsCurrentMonth = /bulan\s+ini/i.test(lower);
  const mentionsCurrentYear = /tahun\s+(?:ini|berjalan)/i.test(lower);
  const hasExplicitMonth = Boolean(numericDate) || namedMonth >= 0 || Boolean(numericMonth) || mentionsCurrentMonth;
  const year = numericDate ? Number(numericDate[3]) : yearMatch ? Number(yearMatch[1]) : now.year;

  if ((yearMatch || mentionsCurrentYear) && !hasExplicitMonth) {
    return {
      year,
      month: null,
      start: `${year}-01-01`,
      end: `${year}-12-31`,
      label: `tahun ${year}`,
      scope: 'year',
      inferredYear: false,
    };
  }

  const month = numericDate ? Number(numericDate[2]) : namedMonth >= 0 ? namedMonth + 1 : numericMonth ? Number(numericMonth[1]) : now.month;
  if (mentionedDay) {
    const exactDate = new Date(Date.UTC(year, month - 1, mentionedDay));
    const validDay = exactDate.getUTCFullYear() === year && exactDate.getUTCMonth() === month - 1 && exactDate.getUTCDate() === mentionedDay;
    if (validDay) {
      const date = `${year}-${String(month).padStart(2, '0')}-${String(mentionedDay).padStart(2, '0')}`;
      return { year, month, day: mentionedDay, start: date, end: date, label: `${mentionedDay} ${MONTHS[month - 1][0].toUpperCase()}${MONTHS[month - 1].slice(1)} ${year}`, scope: 'day', inferredYear: !yearMatch };
    }
  }
  const start = `${year}-${String(month).padStart(2, '0')}-01`;
  const end = new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
  return { year, month, start, end, label: `${MONTHS[month - 1][0].toUpperCase()}${MONTHS[month - 1].slice(1)} ${year}`, scope: 'month', inferredYear: !yearMatch };
}

export function normalizeAiWasteQuestion(question, interpretation) {
  const intent = ALLOWED_INTENTS.has(interpretation?.intent) ? interpretation.intent : 'unknown';
  if (intent === 'unknown') return parseWasteQuestion(question);

  const year = Number(interpretation.year);
  const monthValue = interpretation.month === null ? null : Number(interpretation.month);
  const dayValue = interpretation.day === null || interpretation.day === undefined ? null : Number(interpretation.day);
  if (!Number.isInteger(year) || year < 2000 || year > 2100) return parseWasteQuestion(question);
  if (monthValue !== null && (!Number.isInteger(monthValue) || monthValue < 1 || monthValue > 12)) return parseWasteQuestion(question);
  if (dayValue !== null && (monthValue === null || !Number.isInteger(dayValue) || dayValue < 1 || dayValue > 31)) return parseWasteQuestion(question);

  const exactDate = dayValue === null ? null : new Date(Date.UTC(year, monthValue - 1, dayValue));
  if (exactDate && (exactDate.getUTCMonth() !== monthValue - 1 || exactDate.getUTCDate() !== dayValue)) return parseWasteQuestion(question);
  const dayDate = dayValue === null ? null : `${year}-${String(monthValue).padStart(2, '0')}-${String(dayValue).padStart(2, '0')}`;
  const start = dayDate || (monthValue === null ? `${year}-01-01` : `${year}-${String(monthValue).padStart(2, '0')}-01`);
  const end = dayDate || (monthValue === null ? `${year}-12-31` : new Date(Date.UTC(year, monthValue, 0)).toISOString().slice(0, 10));
  const type = WASTE_TYPES.find(item => item.key === interpretation.typeKey);
  if (intent === 'type_total' && !type) return parseWasteQuestion(question);

  return {
    intent,
    type,
    question: String(question || '').trim(),
    assistedByAi: true,
    period: {
      year,
      month: monthValue,
      day: dayValue,
      start,
      end,
      label: dayValue !== null ? `${dayValue} ${MONTHS[monthValue - 1][0].toUpperCase()}${MONTHS[monthValue - 1].slice(1)} ${year}` : monthValue === null ? `tahun ${year}` : `${MONTHS[monthValue - 1][0].toUpperCase()}${MONTHS[monthValue - 1].slice(1)} ${year}`,
      scope: dayValue !== null ? 'day' : monthValue === null ? 'year' : 'month',
      inferredYear: Boolean(interpretation.inferredYear),
    },
  };
}

export function parseWasteQuestion(question) {
  const text = String(question || '').trim();
  const period = extractPeriod(text);
  const type = WASTE_TYPES.find(item => item.pattern.test(text));
  let intent = 'unknown';
  if (/banding|perbandingan|naik|turun|perubahan/i.test(text)) intent = 'comparison';
  else if (/ruang|unit.*(?:besar|tinggi|banyak)|penghasil.*(?:besar|tinggi|banyak)/i.test(text)) intent = 'top_rooms';
  else if (type) intent = 'type_total';
  else if (/jenis.*(?:dominan|besar|tinggi|banyak)|dominan/i.test(text)) intent = 'dominant_type';
  else if (/rata[ -]?rata|rerata/i.test(text)) intent = 'average';
  else if (/diangkut|pengangkutan|angkut/i.test(text)) intent = 'transported';
  else if (/timbulan|dihasilkan|menghasilkan|total limbah/i.test(text)) intent = 'generated';
  else if (/sisa|tersimpan|penumpukan/i.test(text)) intent = 'remaining';
  return { intent, period, type, question: text };
}

export const QUESTION_SUGGESTIONS = [
  'Berapa sisa limbah bulan ini?',
  'Berapa timbulan limbah bulan ini?',
  'Berapa timbulan limbah tahun ini?',
  'Jenis limbah apa yang paling banyak?',
  'Ruangan mana penghasil limbah terbesar?',
  'Bandingkan timbulan bulan ini dengan periode sebelumnya',
];
