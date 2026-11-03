import { useEffect, useRef } from 'react';
import L from 'leaflet';
import { FACILITY_CATEGORIES } from '../constants/facilityCategories';
import { MAP_DEFAULT_ZOOM } from '../constants/mapConfig';
import { buildGoogleMapsUrl, formatCoordinate } from '../domain/mapCoordinates';
import { createFacilityMarkerIcon } from '../utils/markerIcon';

function createPopupContent(facility, coordinates) {
  const wrapper = document.createElement('div');
  wrapper.className = 'min-w-44 space-y-1.5';

  const title = document.createElement('p');
  title.className = 'text-sm font-bold text-slate-800';
  title.textContent = facility.name;

  const category = document.createElement('p');
  category.className = 'text-[11px] font-semibold uppercase tracking-wide text-slate-500';
  category.textContent = FACILITY_CATEGORIES[facility.category]?.label || 'Fasilitas';

  const coordinate = document.createElement('p');
  coordinate.className = 'text-xs text-slate-500';
  coordinate.textContent = `${formatCoordinate(coordinates[0])}, ${formatCoordinate(coordinates[1])}`;

  wrapper.append(title, category, coordinate);

  const mapsUrl = buildGoogleMapsUrl(coordinates[0], coordinates[1]);
  if (mapsUrl) {
    const link = document.createElement('a');
    link.href = mapsUrl;
    link.target = '_blank';
    link.rel = 'noreferrer noopener';
    link.className = 'inline-flex items-center gap-1 text-xs font-bold text-blue-700 hover:underline';
    link.textContent = 'Buka di Google Maps';
    wrapper.append(link);
  }

  return wrapper;
}

export default function useFacilityMarkers({
  map,
  facilities,
  boundaryPoints = [],
  selectedKey,
  draft,
  editing,
  onSelect,
  onMapClick,
  onMarkerDragEnd,
}) {
  const callbacksRef = useRef({});
  callbacksRef.current = { onSelect, onMapClick, onMarkerDragEnd, editing, selectedKey };
  const facilitiesRef = useRef(facilities);
  facilitiesRef.current = facilities;
  const boundaryPointsRef = useRef(boundaryPoints);
  boundaryPointsRef.current = boundaryPoints;
  const hasFittedRef = useRef(false);
  const boundaryKey = boundaryPoints
    .map(point => `${point.latitude},${point.longitude}`)
    .join('|');

  useEffect(() => {
    hasFittedRef.current = false;
  }, [boundaryKey, map]);

  useEffect(() => {
    if (!map || hasFittedRef.current) return;
    const boundary = boundaryPointsRef.current;
    const points = boundary.length >= 3
      ? boundary.map(point => [point.latitude, point.longitude])
      : facilities
        .filter(facility => facility.hasCoordinates)
        .map(facility => [facility.latitude, facility.longitude]);
    if (!points.length) return;
    map.fitBounds(L.latLngBounds(points).pad(boundary.length >= 3 ? 0.08 : 0.18), {
      maxZoom: MAP_DEFAULT_ZOOM,
    });
    hasFittedRef.current = true;
  }, [boundaryKey, facilities, map]);

  useEffect(() => {
    if (!map) return undefined;
    const group = L.layerGroup().addTo(map);

    facilities.forEach(facility => {
      const isSelected = facility.key === selectedKey;
      const draftCoordinates = isSelected && editing ? draft : null;
      const coordinates = draftCoordinates
        ? [draftCoordinates.latitude, draftCoordinates.longitude]
        : facility.hasCoordinates
          ? [facility.latitude, facility.longitude]
          : null;
      if (!coordinates) return;

      const category = FACILITY_CATEGORIES[facility.category];
      const marker = L.marker(coordinates, {
        icon: createFacilityMarkerIcon({
          color: category?.color || '#334155',
          icon: category?.icon || 'fas fa-location-dot',
          selected: isSelected,
        }),
        draggable: editing && isSelected,
        keyboard: true,
        title: facility.name,
        bubblingMouseEvents: false,
      });

      marker.on('click', () => callbacksRef.current.onSelect?.(facility));
      marker.on('dragend', () => {
        const position = marker.getLatLng();
        callbacksRef.current.onMarkerDragEnd?.(facility, position.lat, position.lng);
      });
      marker.bindPopup(createPopupContent(facility, coordinates), { offset: [0, -4] });
      marker.bindTooltip(facility.name, { direction: 'top', offset: [0, -16], opacity: 0.95 });
      group.addLayer(marker);

      if (isSelected && !editing) marker.openPopup();
    });

    return () => {
      group.remove();
    };
  }, [draft, editing, facilities, map, selectedKey]);

  useEffect(() => {
    if (!map) return undefined;
    const handleClick = event => {
      const current = callbacksRef.current;
      if (!current.editing || !current.selectedKey) return;
      current.onMapClick?.(event.latlng.lat, event.latlng.lng);
    };
    map.on('click', handleClick);
    return () => {
      map.off('click', handleClick);
    };
  }, [map]);

  useEffect(() => {
    if (!map) return undefined;
    const container = map.getContainer();
    const placing = editing && Boolean(selectedKey);
    container.classList.toggle('facility-map--placing', placing);
    return () => {
      container.classList.remove('facility-map--placing');
    };
  }, [editing, map, selectedKey]);

  useEffect(() => {
    if (!map || !selectedKey) return;
    const facility = facilitiesRef.current.find(item => item.key === selectedKey);
    if (!facility?.hasCoordinates) return;
    map.panTo([facility.latitude, facility.longitude]);
  }, [map, selectedKey]);
}
