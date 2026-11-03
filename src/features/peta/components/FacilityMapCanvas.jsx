import { useRef } from 'react';
import 'leaflet/dist/leaflet.css';
import '../facilityMap.css';
import useCurrentLocation from '../hooks/useCurrentLocation';
import useFacilityMarkers from '../hooks/useFacilityMarkers';
import useHospitalBoundaryPolygon from '../hooks/useHospitalBoundaryPolygon';
import useLeafletMap from '../hooks/useLeafletMap';

export default function FacilityMapCanvas({
  facilities,
  selectedKey,
  draft,
  editing,
  onSelect,
  onMapClick,
  onMarkerDragEnd,
  boundary = null,
  boundaryDraftPoints = [],
  boundaryEditing = false,
  onBoundaryMapClick,
  onBoundaryVertexDragEnd,
  className = '',
}) {
  const containerRef = useRef(null);
  const map = useLeafletMap(containerRef);
  const { locating, position, locate } = useCurrentLocation(map);

  useFacilityMarkers({
    map,
    facilities,
    boundaryPoints: boundary?.points || [],
    selectedKey,
    draft,
    editing: editing && !boundaryEditing,
    onSelect: boundaryEditing ? undefined : onSelect,
    onMapClick,
    onMarkerDragEnd,
  });

  useHospitalBoundaryPolygon({
    map,
    boundary,
    draftPoints: boundaryDraftPoints,
    editing: boundaryEditing,
    onMapClick: onBoundaryMapClick,
    onVertexDragEnd: onBoundaryVertexDragEnd,
  });

  const locationLabel = position ? 'Perbarui Lokasi' : 'Lokasi Saya';

  return (
    <>
      <div
        ref={containerRef}
        className={`relative isolate z-0 min-h-[360px] w-full overflow-hidden rounded-2xl bg-slate-200 ${className}`}
        role="application"
        aria-label="Peta interaktif fasilitas RSUD"
      />
      <button
        type="button"
        onClick={locate}
        disabled={!map || locating}
        title="Tampilkan lokasi saya"
        aria-label={locating ? 'Sedang mengambil lokasi' : locationLabel}
        className="absolute right-3 top-3 z-20 inline-flex items-center gap-2 rounded-xl border border-white/80 bg-white/95 px-3 py-2 text-xs font-bold text-blue-700 shadow-lg backdrop-blur transition hover:bg-blue-50 disabled:cursor-wait disabled:opacity-70"
      >
        <i className={`fas ${locating ? 'fa-spinner fa-spin' : 'fa-location-crosshairs'}`} aria-hidden="true" />
        <span className="hidden sm:inline">{locating ? 'Mencari...' : locationLabel}</span>
      </button>
    </>
  );
}
