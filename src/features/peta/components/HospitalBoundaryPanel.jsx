import { formatBoundaryPoint } from '../domain/hospitalBoundary';

export default function HospitalBoundaryPanel({ editor, onFinish }) {
  if (!editor.editing) return null;

  const {
    draftPoints,
    coordinateInput,
    bulkText,
    actionError,
    draftError,
    saving,
    hasChanges,
    canSave,
    hasSavedBoundary,
    updateCoordinateInput,
    setBulkText,
  } = editor;

  const pointCount = draftPoints.length;
  const hasBlockingError = Boolean(actionError) || (pointCount > 0 && Boolean(draftError));
  const hint = actionError
    || (pointCount === 0
      ? 'Klik peta untuk menambah titik, atau masukkan latitude dan longitude di bawah.'
      : draftError || 'Batas valid dan siap disimpan.');

  return (
    <section className="rounded-2xl border border-violet-200 bg-violet-50/70 p-3 shadow-sm" aria-live="polite">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-600 text-white shadow-sm">
            <i className="fas fa-draw-polygon text-sm" aria-hidden="true" />
          </span>
          <div>
            <h2 className="text-sm font-black text-slate-800">Atur Batas Rumah Sakit</h2>
            <p className="mt-0.5 text-xs text-slate-600">
              Gambar satu poligon batas luar dengan klik peta atau input koordinat. Semua pengguna hanya dapat melihat.
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

      <div className="mt-3 rounded-xl border border-violet-100 bg-white p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-bold text-slate-700">
            {pointCount} titik
            <span className="ml-2 font-semibold text-slate-400">minimal 3 titik</span>
          </p>
          {hasChanges && (
            <span className="rounded-full bg-amber-100 px-2 py-1 text-[10px] font-bold text-amber-700">
              Belum disimpan
            </span>
          )}
        </div>

        <div className="mt-2 max-h-44 space-y-1.5 overflow-y-auto rounded-lg border border-slate-100 bg-slate-50 p-2">
          {pointCount === 0 ? (
            <p className="rounded-lg border border-dashed border-slate-200 bg-white px-3 py-4 text-center text-[11px] font-semibold text-slate-400">
              Belum ada titik batas.
            </p>
          ) : (
            draftPoints.map((point, index) => (
              <div key={`${index}-${point.latitude}-${point.longitude}`} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2 py-1.5">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-violet-100 text-[10px] font-black text-violet-700">
                  {index + 1}
                </span>
                <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-slate-600">
                  {formatBoundaryPoint(point)}
                </span>
                <button
                  type="button"
                  onClick={() => editor.removePoint(index)}
                  disabled={saving}
                  className="shrink-0 rounded-md px-2 py-1 text-[10px] font-bold text-rose-600 transition hover:bg-rose-50 disabled:opacity-50"
                >
                  Hapus
                </button>
              </div>
            ))
          )}
        </div>

        <form
          className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_auto]"
          onSubmit={event => {
            event.preventDefault();
            editor.addInputPoint();
          }}
        >
          <label className="text-[11px] font-bold uppercase tracking-wide text-slate-600">
            Latitude
            <input
              type="text"
              inputMode="decimal"
              autoComplete="off"
              spellCheck={false}
              value={coordinateInput.latitude}
              onChange={event => updateCoordinateInput('latitude', event.target.value)}
              disabled={saving}
              placeholder="-10.167912"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium outline-none focus:ring-2 focus:ring-violet-500"
            />
          </label>
          <label className="text-[11px] font-bold uppercase tracking-wide text-slate-600">
            Longitude
            <input
              type="text"
              inputMode="decimal"
              autoComplete="off"
              spellCheck={false}
              value={coordinateInput.longitude}
              onChange={event => updateCoordinateInput('longitude', event.target.value)}
              disabled={saving}
              placeholder="123.585712"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium outline-none focus:ring-2 focus:ring-violet-500"
            />
          </label>
          <button
            type="submit"
            disabled={saving || (!coordinateInput.latitude.trim() && !coordinateInput.longitude.trim())}
            className="self-end rounded-lg bg-violet-600 px-3 py-2 text-xs font-bold text-white transition hover:bg-violet-700 disabled:opacity-50"
          >
            Tambah Titik
          </button>
        </form>

        <details className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-2">
          <summary className="cursor-pointer text-[11px] font-bold text-slate-600">
            Tempel banyak koordinat
          </summary>
          <p className="mt-1 text-[10px] text-slate-500">
            Satu titik per baris, format <span className="font-mono">latitude, longitude</span>.
          </p>
          <textarea
            value={bulkText}
            onChange={event => setBulkText(event.target.value)}
            disabled={saving}
            rows={4}
            spellCheck={false}
            placeholder={'-10.167900, 123.585700\n-10.167800, 123.585800'}
            className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-xs outline-none focus:ring-2 focus:ring-violet-500"
          />
          <button
            type="button"
            onClick={editor.addBulkPoints}
            disabled={saving || !bulkText.trim()}
            className="mt-2 rounded-lg border border-violet-200 bg-white px-3 py-1.5 text-[11px] font-bold text-violet-700 transition hover:bg-violet-50 disabled:opacity-50"
          >
            Tambah dari Daftar
          </button>
        </details>

        <p className={`mt-2 text-[11px] font-semibold ${hasBlockingError ? 'text-rose-600' : pointCount > 0 ? 'text-emerald-700' : 'text-slate-500'}`}>
          {hint}
        </p>

        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={editor.save}
            disabled={!canSave}
            className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-2 text-xs font-bold text-white transition hover:bg-violet-700 disabled:opacity-50"
          >
            <i className={`fas ${saving ? 'fa-spinner fa-spin' : 'fa-save'} text-[10px]`} aria-hidden="true" />
            Simpan Batas
          </button>
          <button
            type="button"
            onClick={editor.undoPoint}
            disabled={pointCount === 0 || saving}
            className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
          >
            Undo Titik
          </button>
          <button
            type="button"
            onClick={editor.resetDraft}
            disabled={!hasChanges || saving}
            className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
          >
            Batalkan Perubahan
          </button>
          {hasSavedBoundary && (
            <button
              type="button"
              onClick={editor.clearBoundary}
              disabled={saving}
              className="rounded-lg border border-rose-200 px-3 py-2 text-xs font-bold text-rose-600 transition hover:bg-rose-50 disabled:opacity-50"
            >
              Hapus Batas
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
