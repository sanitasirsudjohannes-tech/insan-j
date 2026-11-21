import { FACILITY_CATEGORIES } from '../constants/facilityCategories';
import { formatCoordinate } from '../domain/mapCoordinates';

export default function FacilityListItem({
  facility,
  selected,
  isAdmin,
  busy = false,
  onSelect,
  onEdit,
  onDelete,
}) {
  const category = FACILITY_CATEGORIES[facility.category];

  return (
    <div className={`rounded-xl border p-2.5 transition ${selected ? 'border-blue-300 bg-blue-50 ring-1 ring-blue-200' : 'border-slate-200 bg-white hover:border-slate-300'}`}>
      <div className="flex items-start gap-2">
        <button type="button" onClick={() => onSelect(facility)} className="min-w-0 flex-1 text-left">
          <span className="flex items-center gap-2">
            <span
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[11px] text-white"
              style={{ backgroundColor: category?.color || '#334155' }}
            >
              <i className={category?.icon || 'fas fa-location-dot'} aria-hidden="true" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-bold text-slate-800">{facility.name}</span>
              <span className="flex flex-wrap items-center gap-1 text-[10px] font-semibold text-slate-500">
                <span>{category?.label || 'Fasilitas'}</span>
                {!facility.isActive && <span className="rounded-full bg-slate-200 px-1.5 py-0.5 text-slate-600">Nonaktif</span>}
              </span>
            </span>
          </span>
          <span className={`mt-1.5 flex items-center gap-1.5 text-[11px] ${facility.hasCoordinates ? 'text-emerald-700' : 'text-amber-700'}`}>
            <i className={`fas ${facility.hasCoordinates ? 'fa-location-dot' : 'fa-circle-exclamation'} text-[9px]`} aria-hidden="true" />
            {facility.hasCoordinates
              ? `${formatCoordinate(facility.latitude, 5)}, ${formatCoordinate(facility.longitude, 5)}`
              : 'Belum dipetakan'}
          </span>
        </button>

        {isAdmin && (
          <div className="flex shrink-0 flex-col items-stretch gap-1">
            <button
              type="button"
              onClick={() => onEdit(facility)}
              disabled={busy}
              className="rounded-lg border border-blue-200 bg-white px-2.5 py-1.5 text-[11px] font-bold text-blue-700 transition hover:bg-blue-50 disabled:opacity-50"
            >
              {facility.hasCoordinates ? 'Edit' : 'Tambah'}
            </button>
            {facility.hasCoordinates && (
              <button
                type="button"
                onClick={() => onDelete?.(facility)}
                disabled={busy}
                className="rounded-lg border border-rose-200 bg-white px-2.5 py-1.5 text-[11px] font-bold text-rose-600 transition hover:bg-rose-50 disabled:opacity-50"
              >
                Hapus
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
