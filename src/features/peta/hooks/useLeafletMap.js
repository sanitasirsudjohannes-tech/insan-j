import { useEffect, useState } from 'react';
import L from 'leaflet';
import {
  MAP_ATTRIBUTION,
  MAP_DEFAULT_CENTER,
  MAP_DEFAULT_ZOOM,
  MAP_MAX_ZOOM,
  MAP_MIN_ZOOM,
  MAP_TILE_URL,
} from '../constants/mapConfig';

export default function useLeafletMap(containerRef) {
  const [map, setMap] = useState(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;

    const instance = L.map(container, {
      center: MAP_DEFAULT_CENTER,
      zoom: MAP_DEFAULT_ZOOM,
      minZoom: MAP_MIN_ZOOM,
      maxZoom: MAP_MAX_ZOOM,
      zoomControl: true,
    });

    instance.zoomControl.setPosition('bottomright');
    L.tileLayer(MAP_TILE_URL, {
      maxZoom: MAP_MAX_ZOOM,
      attribution: MAP_ATTRIBUTION,
    }).addTo(instance);

    const invalidateSize = () => instance.invalidateSize();
    const animationFrame = window.requestAnimationFrame(invalidateSize);
    window.addEventListener('resize', invalidateSize);
    const resizeObserver = typeof ResizeObserver === 'undefined'
      ? null
      : new ResizeObserver(invalidateSize);
    resizeObserver?.observe(container);

    setMap(instance);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      window.removeEventListener('resize', invalidateSize);
      resizeObserver?.disconnect();
      instance.remove();
      setMap(null);
    };
  }, [containerRef]);

  return map;
}
