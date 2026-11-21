import { useCallback, useEffect, useState } from 'react';
import L from 'leaflet';
import Swal from 'sweetalert2';
import { MAP_DEFAULT_ZOOM } from '../constants/mapConfig';
import { formatCoordinate } from '../domain/mapCoordinates';
import { createUserLocationIcon } from '../utils/markerIcon';

const LOCATION_OPTIONS = {
  enableHighAccuracy: true,
  timeout: 15000,
  maximumAge: 0,
};

function locationErrorMessage(error) {
  switch (error?.code) {
    case 1:
      return 'Izin lokasi ditolak. Aktifkan izin lokasi situs ini di pengaturan browser, lalu coba lagi.';
    case 2:
      return 'Lokasi tidak tersedia. Pastikan GPS atau layanan lokasi aktif dan koneksi stabil.';
    case 3:
      return 'Permintaan lokasi melebihi batas waktu. Coba lagi di area dengan sinyal yang lebih baik.';
    default:
      return error?.message || 'Lokasi saat ini tidak dapat diambil.';
  }
}

function createLocationPopup(position) {
  const wrapper = document.createElement('div');
  wrapper.className = 'min-w-44 space-y-1';

  const title = document.createElement('p');
  title.className = 'text-sm font-bold text-slate-800';
  title.textContent = 'Lokasi Anda';

  const accuracy = document.createElement('p');
  accuracy.className = 'text-xs text-slate-500';
  accuracy.textContent = `Akurasi ±${Math.round(position.accuracy || 0)} meter`;

  const coordinate = document.createElement('p');
  coordinate.className = 'text-[11px] text-slate-400';
  coordinate.textContent = `${formatCoordinate(position.latitude)}, ${formatCoordinate(position.longitude)}`;

  wrapper.append(title, accuracy, coordinate);
  return wrapper;
}

export default function useCurrentLocation(map) {
  const [locating, setLocating] = useState(false);
  const [position, setPosition] = useState(null);

  const locate = useCallback(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      Swal.fire('Fitur Tidak Didukung', 'Browser ini tidak mendukung fitur lokasi.', 'error');
      return;
    }
    if (window.isSecureContext === false) {
      Swal.fire(
        'Lokasi Membutuhkan HTTPS',
        'Fitur lokasi hanya dapat digunakan melalui HTTPS atau localhost. Buka aplikasi melalui alamat yang aman.',
        'warning',
      );
      return;
    }
    if (locating) return;

    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      result => {
        const nextPosition = {
          latitude: result.coords.latitude,
          longitude: result.coords.longitude,
          accuracy: result.coords.accuracy,
        };
        setLocating(false);
        setPosition(nextPosition);
        if (map) {
          map.flyTo(
            [nextPosition.latitude, nextPosition.longitude],
            Math.max(map.getZoom(), MAP_DEFAULT_ZOOM),
            { duration: 0.8 },
          );
        }
      },
      error => {
        setLocating(false);
        Swal.fire('Lokasi Tidak Tersedia', locationErrorMessage(error), 'error');
      },
      LOCATION_OPTIONS,
    );
  }, [locating, map]);

  useEffect(() => {
    if (!map || !position) return undefined;

    const group = L.layerGroup().addTo(map);
    const latlng = L.latLng(position.latitude, position.longitude);
    const accuracy = Number(position.accuracy);

    if (Number.isFinite(accuracy) && accuracy > 0) {
      L.circle(latlng, {
        radius: accuracy,
        color: '#2563eb',
        weight: 1,
        fillColor: '#3b82f6',
        fillOpacity: 0.12,
      }).addTo(group);
    }

    const marker = L.marker(latlng, {
      icon: createUserLocationIcon(),
      title: 'Lokasi Anda',
      keyboard: true,
      zIndexOffset: 1000,
      bubblingMouseEvents: false,
    }).addTo(group);

    marker.bindPopup(createLocationPopup(position), { offset: [0, -4] }).openPopup();

    return () => {
      group.remove();
    };
  }, [map, position]);

  return { locating, position, locate };
}
