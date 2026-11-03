import { formatCoordinate } from '../domain/mapCoordinates';

export default function FacilityEditorPanel({ editor, onFinish }) {
  if (!editor.editing) return null;

  const {
    selectedFacility,
    draft,
    coordinateInputs,
    draftError,
    saving,
    hasChanges,
    updateCoordinateInput,
  } = editor;

  const latitudeInput = coordinateInputs?.latitude || '';
  const longitudeInput = coordinateInputs?.longitude || '';
  const inputsEmpty = !latitudeInput.trim() && !longitudeInput.trim();
  const showError = !inputsEmpty && Boolean(draftError);
  const hint = inputsEmpty
    ? (selectedFacility?.hasCoordinates
      ? 'Koordinat dikosongkan. Gunakan tombol Hapus Titik untuk menghapus titik dari peta.'
      : 'Isi latitude dan longitude, atau tentukan titik lewat peta.')
    : draftError || 'Koordinat valid dan siap disimpan.';

  return (
    <section className="rounded-2xl border border-blue-200 bg-blue-50/70 p-3 shadow-sm" aria-live="polite">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm">
            <i className="fas fa-pen-to-square text-sm" aria-hidden="true" />
          </span>
          <div>
            <h2 className="text-sm font-black text-slate-800">Mode Atur Titik</h2>
            <p className="mt-0.5 text-xs text-slate-600">
              Isi koordinat manual, klik peta, atau geser marker untuk menentukan titik.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onFinish}
          className="shrink-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-600 transition hover:bg-slate-50"
        >
          Selesai
        </button>
      </div>

      {selectedFacility ? (
        <div className="mt-3 rounded-xl border border-blue-100 bg-white p-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-slate-800">{selectedFacility.name}</p>
              <p className="mt-0.5 text-xs text-slate-500">
                {draft
                  ? `${formatCoordinate(draft.latitude, 6)}, ${formatCoordinate(draft.longitude, 6)}`
                  : 'Titik belum ditentukan'}
              </p>
            </div>
            {hasChanges && (
              <span className="rounded-full bg-amber-100 px-2 py-1 text-[10px] font-bold text-amber-700">
                Belum disimpan
              </span>
            )}
          </div>

          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <label className="text-[11px] font-bold uppercase tracking-wide text-slate-600">
              Latitude
              <input
                type="text"
                inputMode="decimal"
                autoComplete="off"
                spellCheck={false}
                value={latitudeInput}
                onChange={event => updateCoordinateInput('latitude', event.target.value)}
                placeholder="-10.167912"
                aria-invalid={showError}
                className={`mt-1 w-full rounded-lg border px-3 py-2 text-sm font-medium outline-none focus:ring-2 ${showError ? 'border-rose-300 focus:ring-rose-400' : 'border-slate-300 focus:ring-blue-500'}`}
              />
            </label>
            <label className="text-[11px] font-bold uppercase tracking-wide text-slate-600">
              Longitude
              <input
                type="text"
                inputMode="decimal"
                autoComplete="off"
                spellCheck={false}
                value={longitudeInput}
                onChange={event => updateCoordinateInput('longitude', event.target.value)}
                placeholder="123.585712"
                aria-invalid={showError}
                className={`mt-1 w-full rounded-lg border px-3 py-2 text-sm font-medium outline-none focus:ring-2 ${showError ? 'border-rose-300 focus:ring-rose-400' : 'border-slate-300 focus:ring-blue-500'}`}
              />
            </label>
          </div>

          <p className={`mt-2 text-[11px] font-semibold ${showError ? 'text-rose-600' : inputsEmpty ? 'text-slate-500' : 'text-emerald-700'}`}>
            {hint}
          </p>

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={editor.save}
              disabled={!hasChanges || Boolean(draftError) || saving}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white transition hover:bg-blue-700 disabled:opacity-50"
            >
              <i className={`fas ${saving ? 'fa-spinner fa-spin' : 'fa-save'} text-[10px]`} aria-hidden="true" />
              Simpan Titik
            </button>
            <button
              type="button"
              onClick={editor.resetDraft}
              disabled={!hasChanges || saving}
              className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
            >
              Batalkan Perubahan
            </button>
            {selectedFacility.hasCoordinates && (
              <button
                type="button"
                onClick={editor.clearCoordinates}
                disabled={saving}
                className="rounded-lg border border-rose-200 px-3 py-2 text-xs font-bold text-rose-600 transition hover:bg-rose-50 disabled:opacity-50"
              >
                Hapus Titik
              </button>
            )}
          </div>
        </div>
      ) : (
        <p className="mt-3 rounded-xl border border-dashed border-blue-200 bg-white/70 px-3 py-3 text-xs text-slate-500">
          Belum ada fasilitas yang dipilih. Klik tombol Tambah atau Edit pada daftar fasilitas.
        </p>
      )}
    </section>
  );
}
