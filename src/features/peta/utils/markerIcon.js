import L from 'leaflet';

export function createFacilityMarkerIcon({ color, icon, selected = false }) {
  const size = selected ? 30 : 24;
  return L.divIcon({
    className: 'facility-map-marker',
    html: `<span style="display:flex;width:${size}px;height:${size}px;align-items:center;justify-content:center;border-radius:9999px;background:${color};border:2px solid #fff;box-shadow:0 2px 7px rgba(15,23,42,.35);color:#fff;font-size:${selected ? 12 : 10}px;line-height:1;"><i class="${icon}" aria-hidden="true"></i></span>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
    tooltipAnchor: [0, -size / 2],
  });
}

export function createUserLocationIcon() {
  return L.divIcon({
    className: 'facility-map-user-location',
    html: '<span class="facility-map-user-location__pulse"></span><span class="facility-map-user-location__dot"></span>',
    iconSize: [30, 30],
    iconAnchor: [15, 15],
    popupAnchor: [0, -16],
  });
}

export function createBoundaryVertexIcon(index) {
  return L.divIcon({
    className: 'facility-map-boundary-vertex',
    html: `<span>${index + 1}</span>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
    tooltipAnchor: [0, -14],
  });
}
