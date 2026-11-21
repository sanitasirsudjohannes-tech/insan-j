import { useRef } from 'react';
import 'leaflet/dist/leaflet.css';
import '../facilityMap.css';
import useCurrentLocation from '../hooks/useCurrentLocation';
import useFacilityMarkers from '../hooks/useFacilityMarkers';
import useHospitalBoundaryPolygon from '../hooks/useHospitalBoundaryPolygon';
import { MAP_BASE_LAYERS } from '../constants/mapConfig';
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
  showEmptyMarkerHint = false,
  className = '',
}) {
  const containerRef = useRef(null);
  const { map, layerId, setLayerId } = useLeafletMap(containerRef);
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
      <div className="absolute left-3 top-3 z-20 flex gap-1 rounded-xl border border-white/80 bg-white/95 p-1 shadow-lg backdrop-blur">
        {MAP_BASE_LAYERS.map(layer => (
          <button
            key={layer.id}
            type="button"
            onClick={() => setLayerId(layer.id)}
            aria-pressed={layerId === layer.id}
            className={`rounded-lg px-2.5 py-1.5 text-xs font-bold transition ${layerId === layer.id ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
          >
            {layer.label}
          </button>
        ))}
      </div>
      {showEmptyMarkerHint && (
        <div className="pointer-events-none absolute left-1/2 top-4 z-10 -translate-x-1/2 rounded-full bg-slate-900/80 px-4 py-2 text-xs font-bold text-white shadow-lg">
          Aktifkan ikon mata pada kategori untuk menampilkan penanda
        </div>
      )}
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
