import { useEffect, useRef } from 'react';
import L from 'leaflet';
import {
  HOSPITAL_BOUNDARY_EDIT_STYLE,
  HOSPITAL_BOUNDARY_LABEL,
  HOSPITAL_BOUNDARY_STYLE,
} from '../constants/mapConfig';
import { createBoundaryVertexIcon } from '../utils/markerIcon';

export default function useHospitalBoundaryPolygon({
  map,
  boundary,
  draftPoints,
  editing,
  onMapClick,
  onVertexDragEnd,
}) {
  const callbacksRef = useRef({});
  callbacksRef.current = { onMapClick, onVertexDragEnd };

  useEffect(() => {
    if (!map) return undefined;

    const group = L.layerGroup().addTo(map);
    const points = editing ? draftPoints : (boundary?.points || []);
    const latLngs = points.map(point => [point.latitude, point.longitude]);

    if (latLngs.length >= 3) {
      const polygon = L.polygon(latLngs, {
        ...(editing ? HOSPITAL_BOUNDARY_EDIT_STYLE : HOSPITAL_BOUNDARY_STYLE),
        interactive: !editing,
      }).addTo(group);

      if (!editing) {
        polygon.bindTooltip(HOSPITAL_BOUNDARY_LABEL, {
          sticky: true,
          direction: 'top',
          opacity: 0.95,
        });
      }
    } else if (editing && latLngs.length >= 2) {
      L.polyline(latLngs, {
        ...HOSPITAL_BOUNDARY_EDIT_STYLE,
        fill: false,
        interactive: false,
      }).addTo(group);
    }

    if (editing) {
      points.forEach((point, index) => {
        const marker = L.marker([point.latitude, point.longitude], {
          icon: createBoundaryVertexIcon(index),
          draggable: true,
          keyboard: true,
          title: `Titik batas ${index + 1}`,
          bubblingMouseEvents: false,
          zIndexOffset: 900,
        }).addTo(group);

        marker.bindTooltip(`Titik ${index + 1}`, {
          direction: 'top',
          offset: [0, -10],
          opacity: 0.95,
        });
        marker.on('dragend', () => {
          const position = marker.getLatLng();
          callbacksRef.current.onVertexDragEnd?.(index, position.lat, position.lng);
        });
      });
    }

    return () => {
      group.remove();
    };
  }, [boundary, draftPoints, editing, map]);

  useEffect(() => {
    if (!map || !editing) return undefined;
    const handleClick = event => {
      callbacksRef.current.onMapClick?.(event.latlng.lat, event.latlng.lng);
    };
    map.on('click', handleClick);
    return () => {
      map.off('click', handleClick);
    };
  }, [editing, map]);

  useEffect(() => {
    if (!map) return undefined;
    const container = map.getContainer();
    container.classList.toggle('facility-map--drawing-boundary', editing);
    return () => {
      container.classList.remove('facility-map--drawing-boundary');
    };
  }, [editing, map]);
}
