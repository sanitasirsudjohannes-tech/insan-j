/**
 * Utilitas timeout untuk operasi async yang tidak mendukung AbortSignal
 * (misalnya method Supabase Auth). Promise asli tetap berjalan di belakang
 * layar, tetapi hasilnya diabaikan setelah batas waktu tercapai.
 */
export class TimeoutError extends Error {
  constructor(message = 'Operasi terlalu lama.', code = 'timeout') {
    super(message);
    this.name = 'TimeoutError';
    this.code = code;
  }
}

export function withTimeout(promise, timeoutMs, { code = 'timeout', message = 'Operasi terlalu lama.' } = {}) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new TimeoutError(message, code)), timeoutMs);
  });

  return Promise.race([Promise.resolve(promise), timeout]).finally(() => {
    clearTimeout(timer);
  });
}
