const ABBREVIATIONS = { brp: 'berapa', kmrn: 'kemarin', kmren: 'kemarin', tgl: 'tanggal', yg: 'yang', bnyk: 'banyak', bln: 'bulan', thn: 'tahun', tdk: 'tidak', blm: 'belum', dgn: 'dengan', skrg: 'sekarang' };

export function normalizeConversationQuestion(question) {
  let text = String(question || '').trim().replace(/\b(brp|kmrn|kmren|tgl|yg|bnyk|bln|thn|tdk|blm|dgn|skrg)\b/gi, word => ABBREVIATIONS[word.toLowerCase()]);
  const correction = text.match(/^(?:bukan\s+.+?[,;]?\s+)?(?:maksud\s+saya|maksudnya|koreksi(?:\s+ke)?|ganti\s+(?:ke|menjadi))\s+(.+)[.!?]*$/i)
    || text.match(/^bukan\s+.+?[,;]\s*(?:tapi\s+)?(.+)$/i);
  if (correction) text = correction[1].trim().replace(/[.!?]+$/, '');
  const rejected = String(question || '').match(/^bukan\s+(.+?)(?:[,;]|\s+maksud)/i)?.[1] || null;
  return { text, correction: Boolean(correction), rejected };
}

export function rememberPeriods(context, period, { roomName, type, correction = false } = {}) {
  const sameSubject = (context?.roomName || null) === (roomName || null) && (context?.type?.key || null) === (type?.key || null);
  const previous = sameSubject || correction ? [...(context?.periodHistory || []), context?.period].filter(Boolean) : [];
  const unique = [];
  for (const item of [...previous, period]) {
    if (!item?.start || !item?.end) continue;
    const index = unique.findIndex(p => p.start === item.start && p.end === item.end);
    if (index >= 0) unique.splice(index, 1);
    unique.push(item);
  }
  return unique.slice(-2);
}
