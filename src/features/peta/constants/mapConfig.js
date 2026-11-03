export const MAP_DEFAULT_CENTER = [-10.1679128, 123.5857121];
export const MAP_DEFAULT_ZOOM = 18;
export const MAP_MIN_ZOOM = 15;
export const MAP_MAX_ZOOM = 19;
export const MAP_TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
export const MAP_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

export const HOSPITAL_BOUNDARY_LABEL = 'Batas Rumah Sakit';
export const HOSPITAL_BOUNDARY_COLOR = '#4f46e5';
export const HOSPITAL_BOUNDARY_FILL_COLOR = '#6366f1';
export const HOSPITAL_BOUNDARY_STYLE = Object.freeze({
  color: HOSPITAL_BOUNDARY_COLOR,
  weight: 2.5,
  fillColor: HOSPITAL_BOUNDARY_FILL_COLOR,
  fillOpacity: 0.12,
});
export const HOSPITAL_BOUNDARY_EDIT_STYLE = Object.freeze({
  color: '#d97706',
  weight: 2,
  dashArray: '7 6',
  fillColor: '#f59e0b',
  fillOpacity: 0.1,
});
