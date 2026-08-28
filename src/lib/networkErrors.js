const TRANSIENT_NETWORK_STATUSES = new Set([0, 408, 502, 503, 504, 522, 524]);

const NETWORK_ERROR_PATTERNS = [
  /failed to fetch/i,
  /fetch failed/i,
  /network(?:error|\s|_|-)/i,
  /load failed/i,
  /(?:request|operation|connection).*(?:timed?\s*out|timeout)/i,
  /(?:timed?\s*out|timeout)/i,
  /(?:connection|internet).*(?:lost|failed|closed|reset|refused|disconnected)/i,
  /err_(?:network|internet_disconnected|connection|name_not_resolved)/i,
  /e(?:connreset|connrefused|timedout|hostunreach|netunreach)/i,
  /aborterror/i,
];

/**
 * navigator.onLine hanya menunjukkan status sambungan perangkat. Wi-Fi yang
 * masih terhubung dapat tetap gagal menjangkau Supabase, sehingga error browser
 * dan status gateway juga perlu dikenali sebelum menyimpan draft lokal.
 */
export const isNetworkError = (error) => {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true;
  if (!error) return false;

  const rawStatus = error.status ?? error.statusCode ?? error.cause?.status;
  if (rawStatus !== undefined && rawStatus !== null && rawStatus !== '') {
    const status = Number(rawStatus);
    if (Number.isFinite(status) && TRANSIENT_NETWORK_STATUSES.has(status)) return true;
  }

  const description = [
    error.name,
    error.message,
    error.details,
    error.code,
    error.cause?.name,
    error.cause?.message,
    typeof error === 'string' ? error : '',
  ].filter(Boolean).join(' ');

  return NETWORK_ERROR_PATTERNS.some(pattern => pattern.test(description));
};
