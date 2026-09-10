const MONTHS = ['januari', 'februari', 'maret', 'april', 'mei', 'juni', 'juli', 'agustus', 'september', 'oktober', 'november', 'desember'];
const MONTH_PATTERN = MONTHS.join('|');

export const WASTE_TYPES = [
  { pattern: /infeksius|infectious/i, key: 'infectiousKg', label: 'limbah infeksius' },
  { pattern: /jarum(?: suntik)?|benda tajam|spuit|syringe|safety\s*box/i, key: 'sharpsKg', label: 'limbah jarum suntik' },
  { pattern: /botol(?: obat)?|vial|ampul/i, key: 'bottleKg', label: 'limbah botol obat' },
  { pattern: /sitotoksik|cytotoxic|sitostatika/i, key: 'cytotoxicKg', label: 'limbah sitotoksik' },
];

const ALLOWED_INTENTS = new Set(['waste_summary', 'remaining', 'opening_balance', 'available_total', 'generated', 'transported', 'transport_coverage', 'average', 'dominant_type', 'type_breakdown', 'top_rooms', 'bottom_room', 'room_total', 'room_type_total', 'peak_day', 'active_days', 'comparison', 'type_total']);
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
  if ((intent === 'room_total' || intent === 'room_type_total') && !roomName) return parseWasteQuestion(question);
  if (intent === 'room_type_total' && types.length !== 1) return parseWasteQuestion(question);
  return { intent, type: types[0], types, roomName, question: String(question || '').trim(), assistedByAi: true, period };
}

export function parseWasteQuestion(question, contextPeriod = null) {
  const text = String(question || '').trim();
  const referencesPreviousPeriod = /(?:tanggal|tgl|periode|waktu)\s+(?:itu|tersebut)|di\s+sana/i.test(text);
  const period = referencesPreviousPeriod && contextPeriod ? { ...contextPeriod } : extractPeriod(text);
  const types = WASTE_TYPES.filter(item => item.pattern.test(text));
  const type = types[0];
  const roomName = text.match(/(?:ruang(?:an)?|unit|bangsal)\s+(.+?)(?=\s+(?:tanggal|tgl\.?|pertanggal|bulan|tahun|dari|pada|berapa)\b|[?.,]|$)/i)?.[1]?.trim() || null;
  let intent = 'unknown';
  if (/banding|perbandingan|dibanding|naik|turun|perubahan|selisih|\bvs\.?\b/i.test(text)) intent = 'comparison';
  else if (/(?:ruang|unit|penghasil).*(?:terkecil|terendah|tersedikit|paling sedikit)|(?:terkecil|terendah|tersedikit|paling sedikit).*(?:ruang|unit|penghasil)/i.test(text)) intent = 'bottom_room';
  else if (/(?:ruang|unit|penghasil).*(?:terbesar|terbanyak|tertinggi|paling|ranking|urutan)|(?:terbesar|terbanyak|tertinggi|paling).*(?:ruang|unit|penghasil)/i.test(text)) intent = 'top_rooms';
  else if (roomName && type) intent = 'room_type_total';
  else if (roomName && /berapa|jumlah|total|timbulan|dihasilkan/i.test(text)) intent = 'room_total';
  else if (/(?:tanggal|hari).*(?:timbulan|limbah).*(?:terbesar|terbanyak|tertinggi|paling banyak)|(?:timbulan|limbah).*(?:terbesar|terbanyak|tertinggi|paling banyak).*(?:tanggal|hari)/i.test(text)) intent = 'peak_day';
  else if (/berapa\s+hari|jumlah\s+hari|hari.*(?:tercatat|ada data|ada timbulan)/i.test(text)) intent = 'active_days';
  else if (/jenis.*(?:dominan|terbesar|tertinggi|terbanyak|paling)|dominan/i.test(text)) intent = 'dominant_type';
  else if (types.length > 1 || /(?:rincian.*jenis)|(?:rincian|jumlah|timbulan|data).*(?:berdasarkan|per|masing[ -]?masing)\s+jenis|semua jenis|komposisi|jenis\s+limbah/i.test(text)) intent = 'type_breakdown';
  else if (type) intent = 'type_total';
  else if (/(?:rincian|ringkasan|rekap|ikhtisar|gambaran|detail|data)\s+(?:data\s+)?limbah|limbah\s+secara\s+keseluruhan/i.test(text)) intent = 'waste_summary';
  else if (/sisa\s+awal|awal\s+periode/i.test(text)) intent = 'opening_balance';
  else if (/limbah.*(?:tersedia|dikelola)|total.*(?:tersedia|dikelola)/i.test(text)) intent = 'available_total';
  else if (/persen.*(?:angkut|pengangkutan)|cakupan.*(?:angkut|pengangkutan)/i.test(text)) intent = 'transport_coverage';
  else if (/rata[ -]?rata|rerata|rataan|per\s*hari/i.test(text)) intent = 'average';
  else if (/sisa|tersisa|tersimpan|penumpukan|menumpuk|belum.*(?:angkut|dibawa|dikirim|keluar)/i.test(text)) intent = 'remaining';
  else if (/diangkut|terangkut|pengangkutan|angkut|dibawa|dikirim|pengiriman|keluar/i.test(text)) intent = 'transported';
  else if (/timbulan|dihasilkan|menghasilkan|produksi|terkumpul|hasil\s+timbang|berat\s+limbah|total limbah|limbah masuk/i.test(text)) intent = 'generated';
  return { intent, period, type, types, roomName, question: text };
}

export const QUESTION_SUGGESTIONS = [
  'Rincian data limbah bulan ini',
  'Timbulan limbah tanggal 8',
  'Ruangan dengan timbulan terbesar tanggal 8',
  'Rincian limbah berdasarkan jenis tanggal 8',
  'Timbulan 7 Juli sampai hari ini',
  'Berapa sisa limbah bulan ini?',
  'Bandingkan timbulan bulan ini dengan sebelumnya',
];
