import test from 'node:test';
import assert from 'node:assert/strict';
import {
  boundaryBounds,
  boundaryHasChanges,
  boundaryPointFromValue,
  formatBoundaryPoint,
  normalizeHospitalBoundary,
  parseBoundaryCoordinateLines,
  toBoundaryPayload,
  validateBoundaryPoints,
} from '../src/features/peta/domain/hospitalBoundary.js';

const rectangle = [
  { latitude: -10.1, longitude: 123.5 },
  { latitude: -10.1, longitude: 123.6 },
  { latitude: -10.2, longitude: 123.6 },
  { latitude: -10.2, longitude: 123.5 },
];

test('batas rumah sakit dinormalisasi dari baris database', () => {
  const boundary = normalizeHospitalBoundary({
    id: 1,
    points: [[-10.1, 123.5], [-10.1, 123.6], [-10.2, 123.6]],
    updated_at: '2026-11-02T10:00:00Z',
  });

  assert.equal(boundary.hasBoundary, true);
  assert.equal(boundary.points.length, 3);
  assert.deepEqual(boundary.points[0], { latitude: -10.1, longitude: 123.5 });
  assert.equal(boundary.updatedAt, '2026-11-02T10:00:00Z');
  assert.equal(normalizeHospitalBoundary(null), null);
});

test('titik tidak valid dibuang saat normalisasi dan payload', () => {
  const boundary = normalizeHospitalBoundary({
    points: [[-10.1, 123.5], [91, 123.6], ['bukan angka', 123.7]],
  });
  assert.equal(boundary.points.length, 1);
  assert.equal(boundary.hasBoundary, false);

  assert.deepEqual(toBoundaryPayload(rectangle), [
    [-10.1, 123.5],
    [-10.1, 123.6],
    [-10.2, 123.6],
    [-10.2, 123.5],
  ]);
  assert.deepEqual(toBoundaryPayload([{ latitude: 91, longitude: 123 }]), []);
});

test('validasi batas menerima poligon sederhana dan menolak poligon bermasalah', () => {
  assert.equal(validateBoundaryPoints(rectangle), '');
  assert.match(validateBoundaryPoints(rectangle.slice(0, 2)), /minimal 3 titik/i);
  assert.match(validateBoundaryPoints([...rectangle, rectangle[0]]), /duplikat/i);
  assert.match(validateBoundaryPoints([...rectangle, { latitude: 91, longitude: 123 }]), /valid/i);

  const selfIntersecting = [
    { latitude: 0, longitude: 0 },
    { latitude: 2, longitude: 2 },
    { latitude: 2, longitude: 0 },
    { latitude: 0, longitude: 1.5 },
  ];
  assert.match(validateBoundaryPoints(selfIntersecting), /menyilang/i);
});

test('format input koordinat massal mendukung koma, titik koma, dan spasi', () => {
  const parsed = parseBoundaryCoordinateLines('-10.1, 123.5\n-10.2;123.6\n-10,5 123,5');
  assert.equal(parsed.error, '');
  assert.deepEqual(parsed.points, [
    { latitude: -10.1, longitude: 123.5 },
    { latitude: -10.2, longitude: 123.6 },
    { latitude: -10.5, longitude: 123.5 },
  ]);

  assert.match(parseBoundaryCoordinateLines('bukan koordinat').error, /Baris 1/i);
  assert.match(parseBoundaryCoordinateLines('').error, /minimal satu baris/i);
});

test('perubahan draft dan bounds batas dihitung konsisten', () => {
  assert.equal(boundaryHasChanges([], []), false);
  assert.equal(boundaryHasChanges(rectangle, []), true);
  assert.equal(boundaryHasChanges(rectangle, rectangle.map(point => ({ ...point }))), false);
  assert.equal(boundaryHasChanges(rectangle.slice(0, 3), rectangle), true);

  assert.deepEqual(boundaryBounds(rectangle), [
    [-10.2, 123.5],
    [-10.1, 123.6],
  ]);
  assert.equal(boundaryBounds([]), null);
});

test('helper titik dan format koordinat berfungsi untuk input manual', () => {
  assert.deepEqual(boundaryPointFromValue({ latitude: '-10,5', longitude: '123,5' }), {
    latitude: -10.5,
    longitude: 123.5,
  });
  assert.equal(boundaryPointFromValue({ latitude: 'abc', longitude: 123 }), null);
  assert.equal(formatBoundaryPoint({ latitude: -10.167912, longitude: 123.585712 }, 4), '-10.1679, 123.5857');
});
