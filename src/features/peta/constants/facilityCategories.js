export const FACILITY_CATEGORY = Object.freeze({
  ROOM: 'room',
  CLEAN_WATER: 'clean_water',
});

export const FACILITY_CATEGORIES = Object.freeze({
  [FACILITY_CATEGORY.ROOM]: Object.freeze({
    label: 'Ruangan',
    icon: 'fas fa-door-open',
    color: '#059669',
  }),
  [FACILITY_CATEGORY.CLEAN_WATER]: Object.freeze({
    label: 'Lokasi Air Bersih',
    icon: 'fas fa-droplet',
    color: '#0891b2',
  }),
});

export const FACILITY_CATEGORY_OPTIONS = Object.freeze([
  { value: 'all', label: 'Semua kategori' },
  { value: FACILITY_CATEGORY.ROOM, label: FACILITY_CATEGORIES[FACILITY_CATEGORY.ROOM].label },
  { value: FACILITY_CATEGORY.CLEAN_WATER, label: FACILITY_CATEGORIES[FACILITY_CATEGORY.CLEAN_WATER].label },
]);
