const LEGAL_TERMS = /\b(?:peraturan|aturan|regulasi|dasar\s+hukum|ketentuan|persyaratan|pasal|jdih|undang(?:-undang)?|uu|pp|perpres|permen(?:kes|lhk)?|kepmen|baku\s+mutu)\b/i;
const HEALTH_TERMS = /\b(?:limbah|sampah|b3|medis|rumah\s+sakit|fasyankes|kesehatan\s+lingkungan|sanitasi|ipal|air\s+(?:limbah|bersih)|kualitas\s+udara|pencahayaan|kebisingan|kelembapan|suhu|higiene|pangan|laundry|linen|vektor)\b/i;

export function isHealthRegulationQuestion(question) {
  const text = String(question || '').trim();
  return LEGAL_TERMS.test(text) && HEALTH_TERMS.test(text);
}
