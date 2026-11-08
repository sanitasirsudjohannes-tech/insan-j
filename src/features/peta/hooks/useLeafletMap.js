import { useEffect, useState } from 'react';
import L from 'leaflet';
import {
  DEFAULT_MAP_BASE_LAYER,
  MAP_BASE_LAYERS,
  MAP_DEFAULT_CENTER,
  MAP_DEFAULT_ZOOM,
  MAP_MAX_ZOOM,
  MAP_MIN_ZOOM,
} from '../constants/mapConfig';

export default function useLeafletMap(containerRef, initialLayerId = DEFAULT_MAP_BASE_LAYER) {
  const [map, setMap] = useState(null);
  const [layerId, setLayerId] = useState(initialLayerId);

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

  useEffect(() => {
    if (!map) return undefined;
    const layer = MAP_BASE_LAYERS.find(item => item.id === layerId) || MAP_BASE_LAYERS[0];
    const tileLayer = L.tileLayer(layer.url, {
      maxZoom: layer.maxZoom,
      attribution: layer.attribution,
    }).addTo(map);
    return () => tileLayer.remove();
  }, [layerId, map]);

  return { map, layerId, setLayerId };
}