import { FACILITY_CATEGORIES, FACILITY_CATEGORY } from '../constants/facilityCategories';

export default function FacilityMapStats({ stats }) {
  const cards = [
    { label: 'Total fasilitas', value: stats.total, icon: 'fas fa-map-location-dot', color: 'bg-blue-50 text-blue-700' },
    { label: 'Sudah dipetakan', value: stats.mapped, icon: 'fas fa-location-dot', color: 'bg-emerald-50 text-emerald-700' },
    { label: 'Belum dipetakan', value: stats.unmapped, icon: 'fas fa-circle-question', color: 'bg-amber-50 text-amber-700' },
    {
      label: FACILITY_CATEGORIES[FACILITY_CATEGORY.ROOM].label,
      value: stats.byCategory[FACILITY_CATEGORY.ROOM],
      icon: FACILITY_CATEGORIES[FACILITY_CATEGORY.ROOM].icon,
      color: 'bg-teal-50 text-teal-700',
    },
    {
      label: FACILITY_CATEGORIES[FACILITY_CATEGORY.CLEAN_WATER].label,
      value: stats.byCategory[FACILITY_CATEGORY.CLEAN_WATER],
      icon: FACILITY_CATEGORIES[FACILITY_CATEGORY.CLEAN_WATER].icon,
      color: 'bg-cyan-50 text-cyan-700',
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
      {cards.map(card => (
        <div key={card.label} className="flex items-center gap-2.5 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
          <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${card.color}`}>
            <i className={`${card.icon} text-sm`} aria-hidden="true" />
          </span>
          <span className="min-w-0">
            <span className="block text-lg font-black leading-none text-slate-800">{card.value}</span>
            <span className="mt-1 block truncate text-[10px] font-semibold uppercase tracking-wide text-slate-500">{card.label}</span>
          </span>
        </div>
      ))}
    </div>
  );
}
