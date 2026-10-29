export function serializePayload(payload) {
  return JSON.stringify(payload).slice(0, 12000);
}

export function detectSensitiveData(payload) {
  const text = serializePayload(payload);
  const patterns = [
    /\bNIK\b\s*[:=-]?\s*\d{12,16}/i,
    /\b(no\.?\s*)?(rekam\s*medis|RM)\b\s*[:=-]?\s*[a-z0-9-]{4,}/i,
    /\b(diagnosis|nama\s+pasien|nomor\s+telepon|no\.?\s*hp)\b\s*[:=-]\s*\S+/i,
  ];
  return patterns.some(pattern => pattern.test(text));
}

