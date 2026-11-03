import { useEffect, useState } from 'react';
import { EmptyState } from '../../../components/ui/DataStates';
import { FACILITY_CATEGORY } from '../constants/facilityCategories';
import { groupFacilitiesByCategory } from '../domain/facilityMapModel';
import FacilityCategorySection from './FacilityCategorySection';

export default function FacilityMapSidebar({
  facilities,
  category = 'all',
  selectedKey,
  isAdmin,
  busy,
  onSelect,
  onEdit,
  onDelete,
}) {
  const [openCategories, setOpenCategories] = useState(() => ({
    [FACILITY_CATEGORY.ROOM]: category === FACILITY_CATEGORY.ROOM,
    [FACILITY_CATEGORY.CLEAN_WATER]: category === FACILITY_CATEGORY.CLEAN_WATER,
  }));

  useEffect(() => {
    if (category !== FACILITY_CATEGORY.ROOM && category !== FACILITY_CATEGORY.CLEAN_WATER) return;
    setOpenCategories(current => (
      current[category] ? current : { ...current, [category]: true }
    ));
  }, [category]);

  const toggleCategory = categoryItem => {
    setOpenCategories(current => ({ ...current, [categoryItem]: !current[categoryItem] }));
  };

  const groups = groupFacilitiesByCategory(facilities);
  const visibleCategories = category === FACILITY_CATEGORY.ROOM || category === FACILITY_CATEGORY.CLEAN_WATER
    ? [category]
    : [FACILITY_CATEGORY.ROOM, FACILITY_CATEGORY.CLEAN_WATER];

  return (
    <aside className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
        <div>
          <h2 className="text-sm font-black text-slate-800">Daftar Fasilitas</h2>
          <p className="mt-0.5 text-[11px] text-slate-500">{isAdmin ? 'Klik kategori untuk menambah, mengedit, atau menghapus titik.' : 'Klik kategori untuk melihat fasilitas dan menyorot titik.'}</p>
        </div>
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-600">
          {facilities.length}
        </span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3 max-h-[26rem] lg:max-h-[calc(100vh-25rem)]">
        {facilities.length === 0
          ? <EmptyState compact icon="fas fa-map-location-dot" title="Tidak ada fasilitas" description="Ubah kata kunci atau filter kategori untuk melihat fasilitas lain." />
          : (
            <div className="space-y-3">
              {visibleCategories.map(categoryItem => (
                <FacilityCategorySection
                  key={categoryItem}
                  category={categoryItem}
                  facilities={groups[categoryItem]}
                  open={Boolean(openCategories[categoryItem])}
                  onToggle={() => toggleCategory(categoryItem)}
                  selectedKey={selectedKey}
                  isAdmin={isAdmin}
                  busy={busy}
                  onSelect={onSelect}
                  onEdit={onEdit}
                  onDelete={onDelete}
                />
              ))}
            </div>
          )}
      </div>
    </aside>
  );
}
