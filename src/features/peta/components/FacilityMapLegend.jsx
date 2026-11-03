import { FACILITY_CATEGORIES, FACILITY_CATEGORY } from '../constants/facilityCategories';
import { HOSPITAL_BOUNDARY_COLOR, HOSPITAL_BOUNDARY_LABEL } from '../constants/mapConfig';

export default function FacilityMapLegend() {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[11px] font-semibold text-slate-600 shadow-sm">
      {[FACILITY_CATEGORY.ROOM, FACILITY_CATEGORY.CLEAN_WATER].map(category => (
        <span key={category} className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: FACILITY_CATEGORIES[category].color }} />
          {FACILITY_CATEGORIES[category].label}
        </span>
      ))}
      <span className="inline-flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-full border-2 border-white bg-slate-400 ring-1 ring-slate-300" />
        Titik terpilih
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-full bg-blue-600 ring-2 ring-blue-200" />
        Lokasi Anda
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span
          className="h-2.5 w-3 rounded-sm border-2"
          style={{ borderColor: HOSPITAL_BOUNDARY_COLOR, backgroundColor: 'rgba(99, 102, 241, 0.15)' }}
        />
        {HOSPITAL_BOUNDARY_LABEL}
      </span>
    </div>
  );
}
