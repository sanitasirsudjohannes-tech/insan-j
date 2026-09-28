const MONTHS = ['januari', 'februari', 'maret', 'april', 'mei', 'juni', 'juli', 'agustus', 'september', 'oktober', 'november', 'desember'];
const MONTH_PATTERN = MONTHS.join('|');

const witaToday = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Makassar' });
const iso = (year, month, day) => `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

const validDate = (year, month, day) => {
  const value = new Date(Date.UTC(year, month - 1, day));
  return value.getUTCFullYear() === year && value.getUTCMonth() === month - 1 && value.getUTCDate() === day;
};

function extractDate(question) {
  if (/hari\s+ini|sekarang/i.test(question)) return witaToday();
  const fallbackYear = Number(question.match(/\b(20\d{2})\b/)?.[1] || witaToday().slice(0, 4));
  const numeric = question.match(/\b([0-2]?\d|3[01])[/-](0?\d|1[0-2])(?:[/-](20\d{2}))?\b/);
  if (numeric) {
    const [day, month, year] = [Number(numeric[1]), Number(numeric[2]), Number(numeric[3] || fallbackYear)];
    return validDate(year, month, day) ? iso(year, month, day) : null;
  }
  const named = question.match(new RegExp(`\\b([0-2]?\\d|3[01])\\s+(${MONTH_PATTERN})(?:\\s+(20\\d{2}))?\\b`, 'i'));
  if (!named) return null;
  const [day, month, year] = [Number(named[1]), MONTHS.indexOf(named[2].toLowerCase()) + 1, Number(named[3] || fallbackYear)];
  return validDate(year, month, day) ? iso(year, month, day) : null;
}

export const isWaterQuestion = (question, context = null) => {
  const text = String(question || '');
  const explicitWater = /air\s+bersih|air\s+limbah|\bipal\b|\binlet\b|\boutlet\b|total\s+coliform|e\.?\s*coli/i.test(text);
  const explicitMedicalWaste = /timbulan|pengangkutan|sisa\s+limbah|limbah\s+(?:medis|infeksius|sitotoksik)|\bjarum\b|botol\s+obat|\bruangan\b/i.test(text);
  return explicitWater || (context?.domain === 'water' && !explicitMedicalWaste);
};

export function parseWaterQuestion(question, context = null) {
  const text = String(question || '').trim();
  const waterType = /air\s+bersih|total\s+coliform|e\.?\s*coli|\bbak\b/i.test(text)
    ? 'clean'
    : /air\s+limbah|\bipal\b|\binlet\b|\boutlet\b/i.test(text)
      ? 'wastewater'
      : context?.waterType || null;
  const sampledAt = extractDate(text);
  const parameter = text.match(/total\s+coliform|e\.?\s*coli|\b(?:bod|cod|tss|ph|amonia|ammonia|debit)\b/i)?.[0] || null;
  let intent = 'results';
  if (/tanggal\s+berapa|tgl\s+berapa|daftar\s+tanggal|kapan\s+saja/i.test(text)) intent = 'dates';
  else if (/lengkap|kelengkapan|inlet.*outlet.*(?:ada|tersedia)|(?:ada|tersedia).*inlet.*outlet/i.test(text)) intent = 'completeness';
  else if (/tidak\s+memenuhi|bermasalah|melampaui|di\s+atas\s+baku/i.test(text)) intent = 'non_compliant';
  else if (waterType === 'wastewater' && /banding|perbandingan|selisih|inlet.*outlet|outlet.*inlet/i.test(text)) intent = 'inlet_outlet';
  else if (parameter) intent = 'parameter';
  else if (/terakhir|terbaru/i.test(text)) intent = 'latest';
  const detailed = /rincian\s+lengkap|detail\s+lengkap|tampilkan\s+semua|seluruh\s+(?:lokasi|hasil)/i.test(text);
  return { domain: 'water', question: text, waterType, sampledAt, parameter, intent, detailed };
}
