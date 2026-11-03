import { FACILITY_CATEGORIES, FACILITY_CATEGORY } from '../constants/facilityCategories';
import FacilityListItem from './FacilityListItem';

export default function FacilityCategorySection({
  category,
  facilities,
  open,
  onToggle,
  selectedKey,
  isAdmin,
  busy,
  onSelect,
  onEdit,
  onDelete,
}) {
  const meta = FACILITY_CATEGORIES[category];
  const headingId = `facility-category-${category}`;
  const contentId = `facility-category-content-${category}`;
  const emptyText = category === FACILITY_CATEGORY.CLEAN_WATER
    ? 'Tidak ada lokasi air bersih yang cocok.'
    : 'Tidak ada ruangan yang cocok.';

  return (
    <section aria-labelledby={headingId}>
      <h3 id={headingId}>
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          aria-controls={contentId}
          className="flex w-full items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-2 text-left transition hover:border-slate-300 hover:bg-slate-100"
        >
          <span
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[11px] text-white"
            style={{ backgroundColor: meta?.color || '#334155' }}
          >
            <i className={meta?.icon || 'fas fa-location-dot'} aria-hidden="true" />
          </span>
          <span className="min-w-0 flex-1 truncate text-xs font-black text-slate-700">
            {meta?.label || 'Fasilitas'}
          </span>
          <span className="shrink-0 rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-slate-600 ring-1 ring-slate-200">
            {facilities.length}
          </span>
          <i
            className={`fas fa-chevron-down shrink-0 text-[10px] text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}
            aria-hidden="true"
          />
        </button>
      </h3>

      <div id={contentId} hidden={!open} className="mt-2 space-y-2">
        {facilities.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-center text-[11px] font-semibold text-slate-400">
            {emptyText}
          </p>
        ) : (
          facilities.map(facility => (
            <FacilityListItem
              key={facility.key}
              facility={facility}
              selected={facility.key === selectedKey}
              isAdmin={isAdmin}
              busy={busy}
              onSelect={onSelect}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))
        )}
      </div>
    </section>
  );
}
