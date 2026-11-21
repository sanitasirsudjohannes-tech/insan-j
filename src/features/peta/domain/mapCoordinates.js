export function parseCoordinate(value) {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  if (!text) return null;
  const number = Number(text.replace(',', '.'));
  return Number.isFinite(number) ? number : null;
}

export function isValidCoordinate(latitude, longitude) {
  const lat = parseCoordinate(latitude);
  const lng = parseCoordinate(longitude);
  return lat !== null
    && lng !== null
    && lat >= -90
    && lat <= 90
    && lng >= -180
    && lng <= 180;
}

export function formatCoordinate(value, digits = 6) {
  const number = parseCoordinate(value);
  return number === null ? '-' : number.toFixed(digits);
}

export function buildGoogleMapsUrl(latitude, longitude) {
  const lat = parseCoordinate(latitude);
  const lng = parseCoordinate(longitude);
  if (!isValidCoordinate(lat, lng)) return null;
  return `https://www.google.com/maps?q=${lat},${lng}`;
}

export function formatCoordinateInput(value) {
  const number = parseCoordinate(value);
  return number === null ? '' : String(number);
}

export function validateCoordinateDraft({ latitude, longitude } = {}) {
  const latitudeText = latitude === null || latitude === undefined ? '' : String(latitude).trim();
  const longitudeText = longitude === null || longitude === undefined ? '' : String(longitude).trim();

  if (!latitudeText && !longitudeText) {
    return 'Isi latitude dan longitude, atau tentukan titik lewat peta.';
  }
  if (!latitudeText || !longitudeText) {
    return 'Latitude dan longitude harus diisi bersamaan.';
  }

  const lat = parseCoordinate(latitudeText);
  const lng = parseCoordinate(longitudeText);

  if (lat === null) return 'Latitude harus berupa angka.';
  if (lng === null) return 'Longitude harus berupa angka.';
  if (lat < -90 || lat > 90) return 'Latitude harus berada di antara -90 dan 90.';
  if (lng < -180 || lng > 180) return 'Longitude harus berada di antara -180 dan 180.';
  return '';
}
