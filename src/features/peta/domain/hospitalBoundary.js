import { formatCoordinate, isValidCoordinate, parseCoordinate } from './mapCoordinates.js';

export const MIN_BOUNDARY_POINTS = 3;
export const MAX_BOUNDARY_POINTS = 200;

const EPSILON = 1e-9;

function pointFromValue(value) {
  const latitudeValue = Array.isArray(value) ? value[0] : value?.latitude;
  const longitudeValue = Array.isArray(value) ? value[1] : value?.longitude;
  const latitude = parseCoordinate(latitudeValue);
  const longitude = parseCoordinate(longitudeValue);
  return isValidCoordinate(latitude, longitude) ? { latitude, longitude } : null;
}

export function boundaryPointFromValue(value) {
  return pointFromValue(value);
}

export function normalizeBoundaryPoints(values = []) {
  return values.map(pointFromValue).filter(Boolean);
}

export function normalizeHospitalBoundary(row) {
  if (!row) return null;
  const points = normalizeBoundaryPoints(row.points);
  return {
    points,
    hasBoundary: points.length >= MIN_BOUNDARY_POINTS,
    updatedAt: row.updated_at || null,
  };
}

export function toBoundaryPayload(points = []) {
  return points.map(point => {
    const normalized = pointFromValue(point);
    return normalized ? [normalized.latitude, normalized.longitude] : null;
  }).filter(Boolean);
}

export function pointsEqual(left, right) {
  if (!Array.isArray(left) || !Array.isArray(right)) return false;
  if (left.length !== right.length) return false;
  return left.every((point, index) => {
    const other = right[index];
    return Math.abs(point.latitude - other.latitude) < EPSILON
      && Math.abs(point.longitude - other.longitude) < EPSILON;
  });
}

export function boundaryHasChanges(draftPoints, savedPoints) {
  if (!Array.isArray(savedPoints) || savedPoints.length === 0) {
    return Array.isArray(draftPoints) && draftPoints.length > 0;
  }
  return !pointsEqual(draftPoints, savedPoints);
}

function orientation(a, b, c) {
  const value = (b.latitude - a.latitude) * (c.longitude - a.longitude)
    - (b.longitude - a.longitude) * (c.latitude - a.latitude);
  if (Math.abs(value) < EPSILON) return 0;
  return value > 0 ? 1 : 2;
}

function onSegment(a, b, c) {
  return b.latitude <= Math.max(a.latitude, c.latitude) + EPSILON
    && b.latitude >= Math.min(a.latitude, c.latitude) - EPSILON
    && b.longitude <= Math.max(a.longitude, c.longitude) + EPSILON
    && b.longitude >= Math.min(a.longitude, c.longitude) - EPSILON;
}

function segmentsIntersect(p1, q1, p2, q2) {
  const o1 = orientation(p1, q1, p2);
  const o2 = orientation(p1, q1, q2);
  const o3 = orientation(p2, q2, p1);
  const o4 = orientation(p2, q2, q1);

  if (o1 !== o2 && o3 !== o4) return true;
  if (o1 === 0 && onSegment(p1, p2, q1)) return true;
  if (o2 === 0 && onSegment(p1, q2, q1)) return true;
  if (o3 === 0 && onSegment(p2, p1, q2)) return true;
  if (o4 === 0 && onSegment(p2, q1, q2)) return true;
  return false;
}

function hasSelfIntersection(points) {
  const total = points.length;
  for (let first = 0; first < total; first += 1) {
    const firstNext = (first + 1) % total;
    for (let second = first + 1; second < total; second += 1) {
      const secondNext = (second + 1) % total;
      const adjacent = second === first + 1 || (first === 0 && second === total - 1);
      if (adjacent) continue;
      if (segmentsIntersect(points[first], points[firstNext], points[second], points[secondNext])) {
        return true;
      }
    }
  }
  return false;
}

function polygonArea(points) {
  return points.reduce((total, point, index) => {
    const next = points[(index + 1) % points.length];
    return total + (point.longitude * next.latitude - next.longitude * point.latitude);
  }, 0) / 2;
}

export function validateBoundaryPoints(points = []) {
  if (!Array.isArray(points)) return 'Titik batas tidak valid.';
  if (points.length < MIN_BOUNDARY_POINTS) {
    return `Tambahkan minimal ${MIN_BOUNDARY_POINTS} titik untuk membentuk batas.`;
  }
  if (points.length > MAX_BOUNDARY_POINTS) {
    return `Batas rumah sakit maksimal ${MAX_BOUNDARY_POINTS} titik.`;
  }

  const normalized = points.map(pointFromValue);
  if (normalized.some(point => !point)) {
    return 'Semua titik harus memiliki latitude dan longitude yang valid.';
  }

  const seen = new Set();
  for (const point of normalized) {
    const key = `${point.latitude.toFixed(9)},${point.longitude.toFixed(9)}`;
    if (seen.has(key)) return 'Titik batas tidak boleh duplikat.';
    seen.add(key);
  }

  if (Math.abs(polygonArea(normalized)) < 1e-12) {
    return 'Batas rumah sakit harus membentuk area yang tidak kosong.';
  }
  if (hasSelfIntersection(normalized)) {
    return 'Garis batas tidak boleh saling menyilang.';
  }
  return '';
}

export function parseBoundaryCoordinateLines(text) {
  const lines = String(text || '')
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean);

  if (!lines.length) {
    return { points: [], error: 'Tempel minimal satu baris koordinat.' };
  }

  const points = [];
  for (const [index, line] of lines.entries()) {
    const candidates = [];
    if (/[;\t]/.test(line)) candidates.push(line.split(/[;\t]+/).filter(Boolean));
    if (/\s+/.test(line)) candidates.push(line.split(/\s+/).filter(Boolean));
    if (line.includes(',')) {
      const separator = line.indexOf(',');
      candidates.push([line.slice(0, separator), line.slice(separator + 1)]);
    }

    const point = candidates
      .map(parts => (parts.length === 2 ? pointFromValue(parts) : null))
      .find(Boolean);

    if (!point) {
      return { points: [], error: `Baris ${index + 1}: gunakan format latitude, longitude yang valid.` };
    }
    points.push(point);
  }

  return { points, error: '' };
}

export function formatBoundaryPoint(point, digits = 6) {
  return `${formatCoordinate(point?.latitude, digits)}, ${formatCoordinate(point?.longitude, digits)}`;
}

export function boundaryBounds(points = []) {
  if (!points.length) return null;
  return points.reduce((bounds, point) => [
    [Math.min(bounds[0][0], point.latitude), Math.min(bounds[0][1], point.longitude)],
    [Math.max(bounds[1][0], point.latitude), Math.max(bounds[1][1], point.longitude)],
  ], [
    [points[0].latitude, points[0].longitude],
    [points[0].latitude, points[0].longitude],
  ]);
}
