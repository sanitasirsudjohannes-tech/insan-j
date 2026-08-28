import { supabase } from './supabase';

const unavailableFunctions = new Set();
const aggregationCache = new Map();
const CACHE_TTL_MS = 90_000;
let offlineSyncActive = false;

const FUNCTION_TABLES = {
  dashboard_pengangkutan_summary: ['limbah_padat', 'limbah_ruangan', 'pengangkutan_limbah'],
  dashboard_jenis_limbah_summary: ['limbah_padat', 'limbah_ruangan'],
  dashboard_anorganik_summary: ['limbah_anorganik'],
  dashboard_admin_inspeksi_summary: [
    'ruang_bangunan',
    'limbah_medis',
    'pemeriksaan_toilet',
    'pemeriksaan_reservoir',
    'pemeriksaan_gizi',
  ],
  dashboard_missing_waste_dates: ['limbah_padat', 'limbah_ruangan'],
  rekap_limbah_monthly_summary: ['limbah_padat', 'limbah_ruangan', 'pengangkutan_limbah'],
  rekap_limbah_yearly_summary: ['limbah_padat', 'limbah_ruangan', 'pengangkutan_limbah'],
};

const getCacheOwner = () => {
  try {
    const raw = localStorage.getItem('currentUser') || sessionStorage.getItem('currentUser');
    return raw ? JSON.parse(raw)?.id || 'anonymous' : 'anonymous';
  } catch {
    return 'anonymous';
  }
};

export function invalidateAggregationCache(changedTables = []) {
  const affectedTables = new Set(changedTables.filter(Boolean));

  for (const [key, entry] of aggregationCache) {
    if (affectedTables.size === 0 || entry.tables.some(table => affectedTables.has(table))) {
      aggregationCache.delete(key);
    }
  }
}

export async function fetchSharedCachedResource(resourceName, loader, {
  parameters = {},
  tables = [],
  ttlMs = CACHE_TTL_MS,
} = {}) {
  const key = `${getCacheOwner()}:${resourceName}:${JSON.stringify(parameters)}`;
  const cached = aggregationCache.get(key);

  if (cached?.promise) return cached.promise;
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  const entry = { tables, expiresAt: 0, value: undefined, promise: null };
  entry.promise = Promise.resolve()
    .then(loader)
    .then(value => {
      if (aggregationCache.get(key) === entry) {
        entry.value = value;
        entry.expiresAt = Date.now() + ttlMs;
        entry.promise = null;
      }
      return value;
    })
    .catch(error => {
      if (aggregationCache.get(key) === entry) aggregationCache.delete(key);
      throw error;
    });

  aggregationCache.set(key, entry);
  return entry.promise;
}

export function notifyDatabaseTablesChanged(tables) {
  const changedTables = [...new Set((Array.isArray(tables) ? tables : [tables]).filter(Boolean))];
  if (offlineSyncActive) return;
  invalidateAggregationCache(changedTables);

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('insan-j-data-changed', {
      detail: { changedTables },
    }));
  }
}

const isMissingDatabaseFunction = (error) => (
  error?.code === 'PGRST202' ||
  error?.code === '42883' ||
  /could not find the function|function .* does not exist/i.test(error?.message || '')
);

/**
 * Jalankan agregasi Supabase tanpa memutus aplikasi sebelum SQL dipasang.
 * Error jaringan, akses, dan perhitungan tidak ditelan agar tetap terlihat.
 */
export async function fetchDatabaseAggregation(functionName, parameters = {}) {
  if (unavailableFunctions.has(functionName)) return null;

  return fetchSharedCachedResource(`rpc:${functionName}`, async () => {
    const { data, error } = await supabase.rpc(functionName, parameters);

    if (error) {
      if (isMissingDatabaseFunction(error)) {
        unavailableFunctions.add(functionName);
        console.info(`Fungsi ${functionName} belum dipasang, menggunakan query lama.`);
        return null;
      }

      throw error;
    }

    return data;
  }, {
    parameters,
    tables: FUNCTION_TABLES[functionName] || [],
  });
}

if (typeof window !== 'undefined') {
  window.addEventListener('offline-sync-start', () => {
    offlineSyncActive = true;
  });

  window.addEventListener('offline-queue-changed', event => {
    if (event.syncInProgress) return;
    invalidateAggregationCache(event.changedTables || []);
  });

  window.addEventListener('offline-sync-complete', event => {
    offlineSyncActive = false;
    invalidateAggregationCache(event.detail?.changedTables || []);
  });

  window.addEventListener('offline-sync-finished', () => {
    offlineSyncActive = false;
  });
}
