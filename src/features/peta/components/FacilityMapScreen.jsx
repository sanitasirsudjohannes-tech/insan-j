import { useCallback, useMemo, useState } from 'react';
import Swal from 'sweetalert2';
import { useSession } from '../../session/SessionContext';
import { DEFAULT_VISIBLE_CATEGORIES } from '../constants/facilityCategories';
import { computeFacilityStats, filterFacilities, filterVisibleFacilities } from '../domain/facilityMapModel';
import useFacilityMapData from '../hooks/useFacilityMapData';
import useFacilityMapEditor from '../hooks/useFacilityMapEditor';
import useHospitalBoundary from '../hooks/useHospitalBoundary';
import useHospitalBoundaryEditor from '../hooks/useHospitalBoundaryEditor';
import FacilityEditorPanel from './FacilityEditorPanel';
import FacilityMapCanvas from './FacilityMapCanvas';
import FacilityMapLegend from './FacilityMapLegend';
import FacilityMapSidebar from './FacilityMapSidebar';
import FacilityMapStats from './FacilityMapStats';
import FacilityMapToolbar from './FacilityMapToolbar';
import HospitalBoundaryPanel from './HospitalBoundaryPanel';
import { FacilityMapErrorState, FacilityMapLoadingState, FacilityMapOfflineNotice } from './FacilityMapStates';

export default function FacilityMapScreen() {
  const { user } = useSession() || {};
  const isAdmin = user?.role?.trim().toLowerCase() === 'admin';
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [visibleCategories, setVisibleCategories] = useState(() => ({ ...DEFAULT_VISIBLE_CATEGORIES }));

  const data = useFacilityMapData();
  const editor = useFacilityMapEditor({
    facilities: data.facilities,
    onSaved: data.refresh,
  });
  const boundaryData = useHospitalBoundary();
  const boundaryEditor = useHospitalBoundaryEditor({
    boundary: boundaryData.boundary,
    onSaved: boundaryData.refresh,
  });

  const toggleCategoryVisibility = useCallback(categoryItem => {
    setVisibleCategories(current => ({ ...current, [categoryItem]: !current[categoryItem] }));
  }, []);

  const visibleFacilities = useMemo(
    () => data.facilities.filter(facility => isAdmin || (facility.isActive && facility.hasCoordinates)),
    [data.facilities, isAdmin],
  );

  const stats = useMemo(() => computeFacilityStats(visibleFacilities), [visibleFacilities]);
  const filteredFacilities = useMemo(
    () => filterFacilities(visibleFacilities, { query, category }),
    [category, query, visibleFacilities],
  );

  const mapFacilities = useMemo(() => {
    const selected = editor.selectedFacility;
    const visible = filterVisibleFacilities(filteredFacilities, visibleCategories, selected?.key);
    if (!selected || visible.some(facility => facility.key === selected.key)) {
      return visible;
    }
    return [...visible, selected];
  }, [editor.selectedFacility, filteredFacilities, visibleCategories]);

  const confirmDiscardDraft = useCallback(async () => {
    if (!editor.editing || !editor.hasChanges) return true;
    const { isConfirmed } = await Swal.fire({
      icon: 'warning',
      title: 'Perubahan titik belum disimpan',
      text: 'Lanjutkan tanpa menyimpan perubahan titik ini?',
      showCancelButton: true,
      confirmButtonText: 'Lanjutkan',
      cancelButtonText: 'Tetap di Sini',
      confirmButtonColor: '#dc2626',
    });
    return isConfirmed;
  }, [editor]);

  const confirmDiscardBoundaryDraft = useCallback(async () => {
    if (!boundaryEditor.editing || !boundaryEditor.hasChanges) return true;
    const { isConfirmed } = await Swal.fire({
      icon: 'warning',
      title: 'Perubahan batas belum disimpan',
      text: 'Lanjutkan tanpa menyimpan perubahan batas rumah sakit?',
      showCancelButton: true,
      confirmButtonText: 'Lanjutkan',
      cancelButtonText: 'Tetap di Sini',
      confirmButtonColor: '#dc2626',
    });
    return isConfirmed;
  }, [boundaryEditor]);

  const handleSelectFacility = useCallback(async facility => {
    if (boundaryEditor.editing) return;
    if (editor.selectedKey === facility?.key) return;
    if (!(await confirmDiscardDraft())) return;
    editor.selectFacility(facility);
  }, [boundaryEditor.editing, confirmDiscardDraft, editor]);

  const handleEditFacility = useCallback(async facility => {
    if (boundaryEditor.editing) {
      if (!(await confirmDiscardBoundaryDraft())) return;
      boundaryEditor.stopEditing();
    }
    if (editor.editing && editor.selectedKey === facility?.key) return;
    if (!(await confirmDiscardDraft())) return;
    if (!editor.editing) editor.beginEditing();
    editor.selectFacility(facility);
  }, [boundaryEditor, confirmDiscardBoundaryDraft, confirmDiscardDraft, editor]);

  const handleDeleteFacilityCoordinates = useCallback(async facility => {
    if (!facility?.hasCoordinates) return;
    const deletingSelected = editor.selectedKey === facility.key;
    const { isConfirmed } = await Swal.fire({
      icon: 'warning',
      title: 'Hapus titik dari peta?',
      text: `Titik ${facility.name} akan dihapus, tetapi data master tetap tersimpan.${deletingSelected && editor.editing && editor.hasChanges ? ' Perubahan yang belum disimpan pada titik ini juga akan dibatalkan.' : ''}`,
      showCancelButton: true,
      confirmButtonText: 'Hapus Titik',
      cancelButtonText: 'Batal',
      confirmButtonColor: '#dc2626',
    });
    if (!isConfirmed) return;
    await editor.removeFacilityCoordinates(facility);
  }, [editor]);

  const finishEditing = useCallback(async () => {
    if (!editor.editing) return;
    if (!(await confirmDiscardDraft())) return;
    editor.stopEditing();
  }, [confirmDiscardDraft, editor]);

  const finishBoundaryEditing = useCallback(async () => {
    if (!boundaryEditor.editing) return;
    if (!(await confirmDiscardBoundaryDraft())) return;
    boundaryEditor.stopEditing();
  }, [boundaryEditor, confirmDiscardBoundaryDraft]);

  const handleRefresh = useCallback(async () => {
    if (editor.editing && editor.hasChanges) {
      if (!(await confirmDiscardDraft())) return;
      editor.resetDraft();
    }
    if (boundaryEditor.editing && boundaryEditor.hasChanges) {
      if (!(await confirmDiscardBoundaryDraft())) return;
      boundaryEditor.resetDraft();
    }
    await Promise.all([data.refresh(), boundaryData.refresh()]);
  }, [boundaryData, boundaryEditor, confirmDiscardBoundaryDraft, confirmDiscardDraft, data, editor]);

  const handleToggleEditing = useCallback(async () => {
    if (editor.editing) {
      await finishEditing();
      return;
    }
    if (boundaryEditor.editing) {
      if (!(await confirmDiscardBoundaryDraft())) return;
      boundaryEditor.stopEditing();
    }
    editor.beginEditing();
  }, [boundaryEditor, confirmDiscardBoundaryDraft, editor, finishEditing]);

  const handleToggleBoundaryEditing = useCallback(async () => {
    if (boundaryEditor.editing) {
      await finishBoundaryEditing();
      return;
    }
    if (editor.editing) {
      if (!(await confirmDiscardDraft())) return;
      editor.stopEditing();
    }
    boundaryEditor.beginEditing();
  }, [boundaryEditor, confirmDiscardDraft, editor, finishBoundaryEditing]);

  return (
    <div className="mx-auto max-w-7xl space-y-4 p-4 sm:p-6">
      <section className="overflow-hidden rounded-3xl bg-linear-to-br from-blue-700 via-cyan-600 to-emerald-600 p-5 text-white shadow-xl">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-100">Pemetaan Fasilitas Sanitasi</p>
            <h1 className="mt-1 text-2xl font-black">Peta Ruangan & Lokasi Air Bersih</h1>
            <p className="mt-1 max-w-2xl text-sm text-blue-100">
              Lihat sebaran fasilitas dan batas luar RSUD Prof. Dr. W. Z. Johannes Kupang. Admin dapat mengatur titik fasilitas serta menggambar batas wilayah lewat klik peta atau input koordinat.
            </p>
          </div>
          <span className="inline-flex w-fit items-center gap-2 rounded-2xl border border-white/20 bg-white/10 px-3 py-2 text-xs font-bold backdrop-blur">
            <i className="fas fa-map-location-dot" aria-hidden="true" />
            Peta & Satelit
          </span>
        </div>
      </section>

      <FacilityMapOfflineNotice />

      {data.error && (
        <FacilityMapErrorState onRetry={data.refresh} />
      )}

      {boundaryData.error && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800" role="alert">
          <span className="flex items-center gap-2">
            <i className="fas fa-triangle-exclamation text-amber-600" aria-hidden="true" />
            Batas rumah sakit tidak dapat dimuat. Periksa koneksi lalu coba lagi.
          </span>
          <button
            type="button"
            onClick={boundaryData.refresh}
            disabled={boundaryData.loading}
            className="rounded-lg border border-amber-300 bg-white px-2.5 py-1.5 font-bold text-amber-700 transition hover:bg-amber-100 disabled:opacity-50"
          >
            Coba Lagi
          </button>
        </div>
      )}

      <FacilityMapStats stats={stats} />

      <FacilityMapToolbar
        query={query}
        onQueryChange={setQuery}
        category={category}
        onCategoryChange={setCategory}
        onRefresh={handleRefresh}
        loading={data.loading || boundaryData.loading}
        isAdmin={isAdmin}
        editing={editor.editing}
        onToggleEditing={handleToggleEditing}
        boundaryEditing={boundaryEditor.editing}
        onToggleBoundaryEditing={handleToggleBoundaryEditing}
        boundaryDisabled={!boundaryEditor.editing && (boundaryData.loading || Boolean(boundaryData.error))}
      />

      <FacilityEditorPanel editor={editor} onFinish={finishEditing} />
      <HospitalBoundaryPanel editor={boundaryEditor} onFinish={finishBoundaryEditing} />

      <div className="grid gap-4 h-[62vh] min-h-[380px] lg:h-[calc(100vh-26rem)] lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
        <FacilityMapSidebar
          facilities={filteredFacilities}
          category={category}
          selectedKey={editor.selectedKey}
          visibleCategories={visibleCategories}
          onToggleCategoryVisibility={toggleCategoryVisibility}
          isAdmin={isAdmin}
          busy={editor.saving}
          onSelect={handleSelectFacility}
          onEdit={handleEditFacility}
          onDelete={handleDeleteFacilityCoordinates}
        />

        <section className="relative h-full min-h-0 overflow-hidden rounded-2xl border border-slate-200 bg-white p-1.5 shadow-sm">
          {data.loading && data.facilities.length === 0 ? (
            <FacilityMapLoadingState />
          ) : (
            <FacilityMapCanvas
              facilities={mapFacilities}
              selectedKey={editor.selectedKey}
              showEmptyMarkerHint={!mapFacilities.some(facility => facility.hasCoordinates)}
              draft={editor.draft}
              editing={editor.editing}
              onSelect={handleSelectFacility}
              onMapClick={editor.placeAt}
              onMarkerDragEnd={(_facility, latitude, longitude) => editor.placeAt(latitude, longitude)}
              boundary={boundaryData.boundary}
              boundaryDraftPoints={boundaryEditor.draftPoints}
              boundaryEditing={boundaryEditor.editing}
              onBoundaryMapClick={boundaryEditor.addPoint}
              onBoundaryVertexDragEnd={boundaryEditor.updatePoint}
              className="h-full"
            />
          )}
          <div className="pointer-events-none absolute bottom-5 left-5 z-10 hidden sm:block">
            <FacilityMapLegend />
          </div>
          {editor.editing && !editor.selectedFacility && (
            <div className="pointer-events-none absolute left-1/2 top-4 z-10 -translate-x-1/2 rounded-full bg-slate-900/85 px-4 py-2 text-xs font-bold text-white shadow-lg">
              Pilih fasilitas dari daftar untuk mulai menentukan titik
            </div>
          )}
        </section>
      </div>

      {!isAdmin && stats.total === 0 && !data.loading && (
        <p className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500">
          Belum ada fasilitas yang dipetakan. Hubungi administrator untuk menentukan titik lokasi.
        </p>
      )}

      <p className="flex items-center gap-1.5 text-[11px] text-slate-400">
        <i className="fas fa-circle-info" aria-hidden="true" />
        Marker hanya muncul untuk fasilitas yang sudah memiliki koordinat. Batas rumah sakit hanya dapat diubah oleh admin.
      </p>
    </div>
  );
}
