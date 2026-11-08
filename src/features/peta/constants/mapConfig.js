export const MAP_DEFAULT_CENTER = [-10.1679128, 123.5857121];
export const MAP_DEFAULT_ZOOM = 18;
export const MAP_MIN_ZOOM = 15;
export const MAP_MAX_ZOOM = 19;
export const MAP_TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
export const MAP_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
export const MAP_BASE_LAYERS = Object.freeze([
  {
    id: 'street',
    label: 'Peta',
    url: MAP_TILE_URL,
    attribution: MAP_ATTRIBUTION,
    maxZoom: MAP_MAX_ZOOM,
  },
  {
    id: 'satellite',
    label: 'Satelit',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community',
    maxZoom: MAP_MAX_ZOOM,
  },
]);
export const DEFAULT_MAP_BASE_LAYER = 'street';

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
