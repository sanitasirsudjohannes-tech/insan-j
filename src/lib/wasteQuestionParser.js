const MONTHS = ['januari', 'februari', 'maret', 'april', 'mei', 'juni', 'juli', 'agustus', 'september', 'oktober', 'november', 'desember'];
const TYPES = [
  { pattern: /infeksius/i, key: 'infectiousKg', label: 'limbah infeksius' },
  { pattern: /jarum|benda tajam/i, key: 'sharpsKg', label: 'limbah jarum suntik' },
  { pattern: /botol(?: obat)?/i, key: 'bottleKg', label: 'limbah botol obat' },
  { pattern: /sitotoksik/i, key: 'cytotoxicKg', label: 'limbah sitotoksik' },
];

const currentWita = () => {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en', { timeZone: 'Asia/Makassar', year: 'numeric', month: '2-digit' }).formatToParts(new Date()).map(part => [part.type, part.value]));
  return { year: Number(parts.year), month: Number(parts.month) };
};

function extractPeriod(question) {
  const lower = question.toLowerCase();
  const now = currentWita();
  const namedMonth = MONTHS.findIndex(name => lower.includes(name));
  const numericMonth = lower.match(/bulan\s+(1[0-2]|0?[1-9])\b/i);
  const yearMatch = lower.match(/\b(20\d{2})\b/);
  const month = namedMonth >= 0 ? namedMonth + 1 : numericMonth ? Number(numericMonth[1]) : now.month;
  const year = yearMatch ? Number(yearMatch[1]) : now.year;
  const start = `${year}-${String(month).padStart(2, '0')}-01`;
  const end = new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
  return { year, month, start, end, label: `${MONTHS[month - 1][0].toUpperCase()}${MONTHS[month - 1].slice(1)} ${year}`, inferredYear: !yearMatch };
}

export function parseWasteQuestion(question) {
  const text = String(question || '').trim();
  const period = extractPeriod(text);
  const type = TYPES.find(item => item.pattern.test(text));
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
  'Jenis limbah apa yang paling banyak?',
  'Ruangan mana penghasil limbah terbesar?',
  'Bandingkan timbulan bulan ini dengan periode sebelumnya',
];
