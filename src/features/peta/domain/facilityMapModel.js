import { FACILITY_CATEGORY } from '../constants/facilityCategories.js';
import { formatCoordinateInput, isValidCoordinate, parseCoordinate } from './mapCoordinates.js';

const normalizeName = value => String(value || '').trim();

export function normalizeRoom(row) {
  const latitude = parseCoordinate(row?.latitude);
  const longitude = parseCoordinate(row?.longitude);
  return {
    key: `${FACILITY_CATEGORY.ROOM}:${row.id}`,
    id: row.id,
    name: normalizeName(row.nama_ruangan),
    category: FACILITY_CATEGORY.ROOM,
    latitude,
    longitude,
    hasCoordinates: isValidCoordinate(latitude, longitude),
    isActive: true,
    description: '',
  };
}

export function normalizeCleanWaterLocation(row) {
  const latitude = parseCoordinate(row?.latitude);
  const longitude = parseCoordinate(row?.longitude);
  return {
    key: `${FACILITY_CATEGORY.CLEAN_WATER}:${row.id}`,
    id: row.id,
    name: normalizeName(row.name),
    category: FACILITY_CATEGORY.CLEAN_WATER,
    latitude,
    longitude,
    hasCoordinates: isValidCoordinate(latitude, longitude),
    isActive: row.is_active !== false,
    description: normalizeName(row.description),
  };
}

export function mergeFacilities(rooms = [], cleanWaterLocations = []) {
  return [
    ...rooms.map(normalizeRoom),
    ...cleanWaterLocations.map(normalizeCleanWaterLocation),
  ].sort((left, right) => left.name.localeCompare(right.name, 'id'));
}

export function groupFacilitiesByCategory(facilities = []) {
  const groups = {
    [FACILITY_CATEGORY.ROOM]: [],
    [FACILITY_CATEGORY.CLEAN_WATER]: [],
  };
  facilities.forEach(facility => {
    if (groups[facility.category]) groups[facility.category].push(facility);
  });
  return groups;
}

export function filterFacilities(facilities, { query = '', category = 'all' } = {}) {
  const needle = query.trim().toLowerCase();
  return facilities.filter(facility => {
    const matchesCategory = category === 'all' || facility.category === category;
    const matchesQuery = !needle
      || facility.name.toLowerCase().includes(needle)
      || facility.description.toLowerCase().includes(needle);
    return matchesCategory && matchesQuery;
  });
}

export function computeFacilityStats(facilities = []) {
  return facilities.reduce((stats, facility) => {
    stats.total += 1;
    stats.byCategory[facility.category] += 1;
    if (facility.hasCoordinates) stats.mapped += 1;
    else stats.unmapped += 1;
    return stats;
  }, {
    total: 0,
    mapped: 0,
    unmapped: 0,
    byCategory: {
      [FACILITY_CATEGORY.ROOM]: 0,
      [FACILITY_CATEGORY.CLEAN_WATER]: 0,
    },
  });
}

export function getMappedCoordinates(facilities = []) {
  return facilities
    .filter(facility => facility.hasCoordinates)
    .map(facility => [facility.latitude, facility.longitude]);
}

export function coordinatesEqual(left, right) {
  if (!left && !right) return true;
  if (!left || !right) return false;
  return Math.abs(left.latitude - right.latitude) < 1e-9
    && Math.abs(left.longitude - right.longitude) < 1e-9;
}

export function draftFromFacility(facility) {
  return facility?.hasCoordinates
    ? { latitude: facility.latitude, longitude: facility.longitude }
    : null;
}

export function coordinateInputsFromDraft(draft) {
  return {
    latitude: draft ? formatCoordinateInput(draft.latitude) : '',
    longitude: draft ? formatCoordinateInput(draft.longitude) : '',
  };
}
