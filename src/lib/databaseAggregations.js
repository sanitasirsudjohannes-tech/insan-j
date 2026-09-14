import { supabase } from './supabase';
import { isNetworkError } from './networkErrors';

const unavailableFunctions = new Set();
const aggregationCache = new Map();
const CACHE_TTL_MS = 90_000;
const DASHBOARD_CACHE_KEY = 'insan_j_dashboard_cache_v1';
const MAX_SNAPSHOTS_PER_RESOURCE = 12;
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

const persistentCacheKey = (resourceName, parameters) =>
  `${resourceName}:${JSON.stringify(parameters || {})}`;

const readPersistentDashboardCache = () => {
  try {
    return JSON.parse(localStorage.getItem(DASHBOARD_CACHE_KEY) || '{}');
  } catch {
    return {};
  }
};

const getPersistentDashboardSnapshot = (resourceName, parameters) => {
  const ownerId = getCacheOwner();
  return readPersistentDashboardCache()[ownerId]?.[persistentCacheKey(resourceName, parameters)] || null;
};

const savePersistentDashboardSnapshot = (resourceName, parameters, value) => {
  if (value === null || value === undefined) return;
  try {
    const ownerId = getCacheOwner();
    const cache = readPersistentDashboardCache();
    const ownerCache = cache[ownerId] || {};
    const key = persistentCacheKey(resourceName, parameters);
    ownerCache[key] = { value, updatedAt: new Date().toISOString(), resourceName };

    const sameResourceEntries = Object.entries(ownerCache)
      .filter(([, entry]) => entry?.resourceName === resourceName)
      .sort(([, a], [, b]) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
    sameResourceEntries.slice(MAX_SNAPSHOTS_PER_RESOURCE).forEach(([oldKey]) => {
      delete ownerCache[oldKey];
    });

    cache[ownerId] = ownerCache;
    localStorage.setItem(DASHBOARD_CACHE_KEY, JSON.stringify(cache));
    window.dispatchEvent(new CustomEvent('offline-storage-health-request'));
  } catch (error) {
    console.warn('Cache offline dashboard tidak dapat disimpan:', error);
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

/**
 * Memakai respons agregasi kecil dari server dan menyimpan maksimal 12 periode
 * per jenis dashboard. Saat jaringan gagal, hasil terakhir periode yang sama
 * dikembalikan tanpa melakukan query data mentah.
 */
export async function fetchDashboardAggregation(functionName, parameters = {}) {
  const cached = getPersistentDashboardSnapshot(functionName, parameters);

  if (!navigator.onLine) {
    if (cached) return { data: cached.value, source: 'offline', updatedAt: cached.updatedAt };
    throw Object.assign(
      new Error('Data periode ini belum tersedia secara offline. Hubungkan internet lalu buka periode tersebut sekali.'),
      { code: 'offline_cache_missing' },
    );
  }

  try {
    const data = await fetchDatabaseAggregation(functionName, parameters);
    if (data !== null && data !== undefined) {
      savePersistentDashboardSnapshot(functionName, parameters, data);
      const saved = getPersistentDashboardSnapshot(functionName, parameters);
      return { data, source: 'server', updatedAt: saved?.updatedAt || new Date().toISOString() };
    }
    return { data, source: 'server', updatedAt: null };
  } catch (error) {
    if (isNetworkError(error) && cached) {
      return { data: cached.value, source: 'offline', updatedAt: cached.updatedAt };
    }
    if (isNetworkError(error)) {
      throw Object.assign(
        new Error('Data periode ini belum tersedia secara offline. Periksa internet, lalu coba kembali.'),
        { code: 'offline_cache_missing', cause: error },
      );
    }
    throw error;
  }
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
