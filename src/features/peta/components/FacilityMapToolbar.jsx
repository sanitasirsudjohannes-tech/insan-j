import { FACILITY_CATEGORY_OPTIONS } from '../constants/facilityCategories';

export default function FacilityMapToolbar({
  query,
  onQueryChange,
  category,
  onCategoryChange,
  onRefresh,
  loading,
  isAdmin,
  editing,
  onToggleEditing,
  boundaryEditing,
  onToggleBoundaryEditing,
  boundaryDisabled = false,
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <label className="relative min-w-0 flex-1">
          <span className="sr-only">Cari fasilitas</span>
          <i className="fas fa-search absolute left-3.5 top-1/2 -translate-y-1/2 text-xs text-slate-400" aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={event => onQueryChange(event.target.value)}
            placeholder="Cari ruangan atau lokasi air bersih..."
            className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
          />
        </label>

        <label className="sm:w-52">
          <span className="sr-only">Filter kategori fasilitas</span>
          <select
            value={category}
            onChange={event => onCategoryChange(event.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500"
          >
            {FACILITY_CATEGORY_OPTIONS.map(option => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm font-bold text-slate-600 transition hover:bg-slate-50 disabled:cursor-wait disabled:opacity-50"
          >
            <i className={`fas ${loading ? 'fa-spinner fa-spin' : 'fa-sync-alt'} text-xs`} aria-hidden="true" />
            Segarkan
          </button>

          {isAdmin && (
            <>
              <button
                type="button"
                onClick={onToggleEditing}
                className={`inline-flex items-center justify-center gap-2 rounded-xl px-3.5 py-2.5 text-sm font-bold text-white transition ${editing ? 'bg-amber-600 hover:bg-amber-700' : 'bg-blue-600 hover:bg-blue-700'}`}
              >
                <i className={`fas ${editing ? 'fa-check' : 'fa-pen-to-square'} text-xs`} aria-hidden="true" />
                {editing ? 'Selesai Atur Titik' : 'Atur Titik'}
              </button>
              <button
                type="button"
                onClick={onToggleBoundaryEditing}
                disabled={boundaryDisabled}
                title={boundaryDisabled ? 'Batas rumah sakit belum dapat dimuat.' : undefined}
                className={`inline-flex items-center justify-center gap-2 rounded-xl px-3.5 py-2.5 text-sm font-bold text-white transition disabled:cursor-not-allowed disabled:opacity-50 ${boundaryEditing ? 'bg-amber-600 hover:bg-amber-700' : 'bg-violet-600 hover:bg-violet-700'}`}
              >
                <i className={`fas ${boundaryEditing ? 'fa-check' : 'fa-draw-polygon'} text-xs`} aria-hidden="true" />
                {boundaryEditing ? 'Selesai Atur Batas' : 'Atur Batas'}
              </button>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
