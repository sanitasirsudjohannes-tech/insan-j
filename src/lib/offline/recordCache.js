import { MAX_CACHED_ROWS_PER_TABLE, MAX_SYNCED_IDS_PER_USER, RECORD_CACHE_KEY, SYNCED_IDS_KEY } from './constants';
import { notifyStorageHealth } from './storageHealth';

export const getCurrentQueueOwnerId = () => {
  try {
    const raw = localStorage.getItem('currentUser') || sessionStorage.getItem('currentUser');
    return raw ? JSON.parse(raw)?.id || null : null;
  } catch {
    return null;
  }
};

const readRecordCache = () => {
  try {
    const raw = localStorage.getItem(RECORD_CACHE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (error) {
    console.warn('Gagal membaca cadangan data offline:', error);
    return {};
  }
};

export const getCachedServerRows = (tableName) => {
  const ownerId = getCurrentQueueOwnerId();
  if (!ownerId || !tableName) return [];

  const rows = readRecordCache()[ownerId]?.[tableName];
  return Array.isArray(rows) ? rows : [];
};

export const cacheServerRows = (tableName, rows) => {
  const ownerId = getCurrentQueueOwnerId();
  if (!ownerId || !tableName || !Array.isArray(rows) || rows.length === 0) return;

  try {
    const cache = readRecordCache();
    const ownerCache = cache[ownerId] || {};
    const existingRows = Array.isArray(ownerCache[tableName]) ? ownerCache[tableName] : [];
    const mergedRows = new Map(existingRows.map(row => [String(row.id), row]));

    rows.forEach(row => {
      if (!row?.id || String(row.id).startsWith('off_')) return;
      const { isOffline: _isOffline, offlineId: _offlineId, offlineAction: _offlineAction, ...serverRow } = row;
      mergedRows.set(String(row.id), { ...mergedRows.get(String(row.id)), ...serverRow });
    });

    const sortedRows = Array.from(mergedRows.values()).sort((a, b) => {
      const dateComparison = String(b.tanggal || b.tanggal_pemeriksaan || '')
        .localeCompare(String(a.tanggal || a.tanggal_pemeriksaan || ''));
      return dateComparison || String(b.waktu_input || '').localeCompare(String(a.waktu_input || ''));
    });

    cache[ownerId] = {
      ...ownerCache,
      [tableName]: sortedRows.slice(0, MAX_CACHED_ROWS_PER_TABLE),
    };
    localStorage.setItem(RECORD_CACHE_KEY, JSON.stringify(cache));
    notifyStorageHealth();
  } catch (error) {
    console.warn('Gagal menyimpan cadangan data offline:', error);
  }
};

export const reconcileCachedServerRows = (tableName, validServerIds, scope = {}) => {
  const ownerId = getCurrentQueueOwnerId();
  if (!ownerId || !tableName || !Array.isArray(validServerIds)) return;
  const validIds = new Set(validServerIds.map(String));
  try {
    const cache = readRecordCache();
    const ownerCache = cache[ownerId];
    if (!ownerCache || !Array.isArray(ownerCache[tableName])) return;
    const { dateField = 'tanggal', date, month, room } = scope;
    const isInScope = row => {
      if (date && row?.[dateField] !== date) return false;
      if (month && !row?.[dateField]?.startsWith(month)) return false;
      if (room && row?.ruangan !== room) return false;
      return true;
    };
    cache[ownerId] = {
      ...ownerCache,
      [tableName]: ownerCache[tableName].filter(row => !isInScope(row) || validIds.has(String(row.id))),
    };
    localStorage.setItem(RECORD_CACHE_KEY, JSON.stringify(cache));
  } catch (error) {
    console.warn('Gagal merekonsiliasi cache data server:', error);
  }
};

export const removeCachedServerRow = (tableName, id) => {
  const ownerId = getCurrentQueueOwnerId();
  if (!ownerId || !tableName || id == null) return;

  try {
    const cache = readRecordCache();
    const ownerCache = cache[ownerId];
    if (!ownerCache || !Array.isArray(ownerCache[tableName])) return;

    cache[ownerId] = {
      ...ownerCache,
      [tableName]: ownerCache[tableName].filter(row => String(row.id) !== String(id)),
    };
    localStorage.setItem(RECORD_CACHE_KEY, JSON.stringify(cache));
  } catch (error) {
    console.warn('Gagal memperbarui cadangan data offline:', error);
  }
};

export const clearCachedServerRows = (tableNames = []) => {
  const ownerId = getCurrentQueueOwnerId();
  if (!ownerId) return;

  try {
    const cache = readRecordCache();
    const ownerCache = cache[ownerId];
    if (!ownerCache) return;

    const names = Array.isArray(tableNames) ? tableNames : [tableNames];
    const updatedOwnerCache = { ...ownerCache };
    names.filter(Boolean).forEach(tableName => {
      delete updatedOwnerCache[tableName];
    });
    cache[ownerId] = updatedOwnerCache;
    localStorage.setItem(RECORD_CACHE_KEY, JSON.stringify(cache));
  } catch (error) {
    console.warn('Gagal membersihkan cache data arsip:', error);
  }
};

export const getSyncedServerId = (localId) => {
  const ownerId = getCurrentQueueOwnerId();
  if (!ownerId || !localId || !String(localId).startsWith('off_')) return null;

  try {
    const raw = localStorage.getItem(SYNCED_IDS_KEY);
    const savedIds = raw ? JSON.parse(raw) : {};
    return savedIds[ownerId]?.[String(localId)] || null;
  } catch (error) {
    console.warn('Gagal membaca pemetaan ID draft tersinkron:', error);
    return null;
  }
};

export const rememberSyncedServerId = (localId, serverId) => {
  const ownerId = getCurrentQueueOwnerId();
  if (!ownerId || !localId || !serverId) return;

  try {
    const raw = localStorage.getItem(SYNCED_IDS_KEY);
    const savedIds = raw ? JSON.parse(raw) : {};
    const ownerEntries = Object.entries(savedIds[ownerId] || {})
      .filter(([existingLocalId]) => existingLocalId !== String(localId))
      .slice(-(MAX_SYNCED_IDS_PER_USER - 1));

    savedIds[ownerId] = Object.fromEntries([
      ...ownerEntries,
      [String(localId), serverId],
    ]);
    localStorage.setItem(SYNCED_IDS_KEY, JSON.stringify(savedIds));
  } catch (error) {
    console.warn('Gagal menyimpan pemetaan ID draft tersinkron:', error);
  }
};
