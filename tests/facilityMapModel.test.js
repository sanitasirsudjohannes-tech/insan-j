import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeFacilityStats,
  coordinateInputsFromDraft,
  coordinatesEqual,
  draftFromFacility,
  filterFacilities,
  filterVisibleFacilities,
  getMappedCoordinates,
  groupFacilitiesByCategory,
  mergeFacilities,
  normalizeCleanWaterLocation,
  normalizeRoom,
} from '../src/features/peta/domain/facilityMapModel.js';
import {
  buildGoogleMapsUrl,
  formatCoordinate,
  isValidCoordinate,
  parseCoordinate,
  validateCoordinateDraft,
} from '../src/features/peta/domain/mapCoordinates.js';
import { FACILITY_CATEGORY } from '../src/features/peta/constants/facilityCategories.js';

test('ruangan dan lokasi air bersih dinormalisasi ke model fasilitas yang sama', () => {
  const room = normalizeRoom({ id: 'r1', nama_ruangan: ' ICU ', latitude: '-10.1', longitude: 123.5 });
  const water = normalizeCleanWaterLocation({
    id: 'w1', name: 'Bak Utama', description: ' Bawah tangga ', is_active: false,
    latitude: null, longitude: null,
  });

  assert.equal(room.key, `${FACILITY_CATEGORY.ROOM}:r1`);
  assert.equal(room.name, 'ICU');
  assert.equal(room.hasCoordinates, true);
  assert.equal(room.isActive, true);
  assert.equal(water.category, FACILITY_CATEGORY.CLEAN_WATER);
  assert.equal(water.hasCoordinates, false);
  assert.equal(water.isActive, false);
  assert.equal(water.description, 'Bawah tangga');
});

test('merge fasilitas mengurutkan nama dan menggabungkan dua kategori', () => {
  const merged = mergeFacilities(
    [{ id: 'r1', nama_ruangan: 'Zona B' }],
    [{ id: 'w1', name: 'Air Bersih', is_active: true }],
  );
  assert.deepEqual(merged.map(item => item.name), ['Air Bersih', 'Zona B']);
  assert.equal(merged.length, 2);
});

test('filter mendukung kata kunci, deskripsi, dan kategori', () => {
  const facilities = mergeFacilities(
    [{ id: 'r1', nama_ruangan: 'ICU', latitude: 1, longitude: 1 }],
    [{ id: 'w1', name: 'Bak Utama', description: 'Dekat IGD', is_active: true, latitude: 2, longitude: 2 }],
  );

  assert.equal(filterFacilities(facilities, { query: 'icu' }).length, 1);
  assert.equal(filterFacilities(facilities, { query: 'dekat' }).length, 1);
  assert.equal(filterFacilities(facilities, { category: FACILITY_CATEGORY.ROOM }).length, 1);
  assert.equal(filterFacilities(facilities, { category: 'all', query: '' }).length, 2);
});

test('statistik menghitung total, terpetakan, belum terpetakan, dan kategori', () => {
  const facilities = mergeFacilities(
    [
      { id: 'r1', nama_ruangan: 'ICU', latitude: 1, longitude: 1 },
      { id: 'r2', nama_ruangan: 'IGD' },
    ],
    [{ id: 'w1', name: 'Bak', is_active: true }],
  );
  assert.deepEqual(computeFacilityStats(facilities), {
    total: 3,
    mapped: 1,
    unmapped: 2,
    byCategory: {
      [FACILITY_CATEGORY.ROOM]: 2,
      [FACILITY_CATEGORY.CLEAN_WATER]: 1,
    },
  });
});

test('koordinat hanya dianggap terpetakan bila berada dalam rentang valid', () => {
  assert.equal(isValidCoordinate(-10.16, 123.58), true);
  assert.equal(isValidCoordinate(91, 123), false);
  assert.equal(isValidCoordinate(null, 123), false);
  assert.equal(parseCoordinate(''), null);
  assert.equal(parseCoordinate('123.5'), 123.5);
  assert.equal(formatCoordinate(123.456789, 4), '123.4568');
  assert.equal(buildGoogleMapsUrl(-10.16, 123.58), 'https://www.google.com/maps?q=-10.16,123.58');
  assert.equal(buildGoogleMapsUrl('-10,5', '123,5'), 'https://www.google.com/maps?q=-10.5,123.5');
  assert.equal(buildGoogleMapsUrl(120, 200), null);
});

test('draft koordinat dan perbandingan perubahan konsisten', () => {
  const mapped = normalizeRoom({ id: 'r1', nama_ruangan: 'ICU', latitude: 1, longitude: 2 });
  const unmapped = normalizeRoom({ id: 'r2', nama_ruangan: 'IGD' });
  assert.deepEqual(draftFromFacility(mapped), { latitude: 1, longitude: 2 });
  assert.equal(draftFromFacility(unmapped), null);
  assert.equal(coordinatesEqual({ latitude: 1, longitude: 2 }, { latitude: 1, longitude: 2 }), true);
  assert.equal(coordinatesEqual(null, null), true);
  assert.equal(coordinatesEqual({ latitude: 1, longitude: 2 }, null), false);
  assert.deepEqual(getMappedCoordinates([mapped, unmapped]), [[1, 2]]);
});

test('input koordinat manual dinormalisasi dan divalidasi', () => {
  assert.equal(parseCoordinate(' -10,5 '), -10.5);
  assert.equal(parseCoordinate('bukan angka'), null);
  assert.equal(validateCoordinateDraft({ latitude: '-10,5', longitude: '123,5' }), '');
  assert.match(validateCoordinateDraft({ latitude: '', longitude: '' }), /Isi latitude/);
  assert.match(validateCoordinateDraft({ latitude: '-10', longitude: '' }), /bersamaan/);
  assert.match(validateCoordinateDraft({ latitude: 'abc', longitude: '123' }), /Latitude/);
  assert.match(validateCoordinateDraft({ latitude: '91', longitude: '123' }), /Latitude/);
  assert.match(validateCoordinateDraft({ latitude: '-10', longitude: '181' }), /Longitude/);
  assert.deepEqual(coordinateInputsFromDraft({ latitude: -10.5, longitude: 123.25 }), {
    latitude: '-10.5',
    longitude: '123.25',
  });
  assert.deepEqual(coordinateInputsFromDraft(null), { latitude: '', longitude: '' });
});

test('daftar fasilitas dipisahkan per kategori tanpa mengubah urutan', () => {
  const facilities = mergeFacilities(
    [
      { id: 'r1', nama_ruangan: 'ICU', latitude: 1, longitude: 1 },
      { id: 'r2', nama_ruangan: 'IGD', latitude: 2, longitude: 2 },
    ],
    [{ id: 'w1', name: 'Bak Utama', is_active: true, latitude: 3, longitude: 3 }],
  );

  const groups = groupFacilitiesByCategory(facilities);
  assert.deepEqual(groups.room.map(item => item.name), ['ICU', 'IGD']);
  assert.deepEqual(groups.clean_water.map(item => item.name), ['Bak Utama']);
  assert.deepEqual(groupFacilitiesByCategory(), { room: [], clean_water: [] });
});

test('filter penanda hanya menampilkan kategori yang aktif atau fasilitas terpilih', () => {
  const facilities = mergeFacilities(
    [
      { id: 'r1', nama_ruangan: 'ICU', latitude: 1, longitude: 1 },
      { id: 'r2', nama_ruangan: 'IGD', latitude: 2, longitude: 2 },
    ],
    [{ id: 'w1', name: 'Bak Utama', is_active: true, latitude: 3, longitude: 3 }],
  );
  const selected = facilities[1];

  assert.deepEqual(filterVisibleFacilities(facilities, { room: false, clean_water: false }, selected.key).map(item => item.name), ['ICU']);
  assert.deepEqual(filterVisibleFacilities(facilities, { room: true, clean_water: false }).map(item => item.name), ['ICU', 'IGD']);
  assert.deepEqual(filterVisibleFacilities(facilities, { room: false, clean_water: true }).map(item => item.name), ['Bak Utama']);
});
