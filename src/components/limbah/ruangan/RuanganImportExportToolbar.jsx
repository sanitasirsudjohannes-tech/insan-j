/**
 * RuanganImportExportToolbar – toolbar download template, import & export Excel
 * serta tombol cetak PDF untuk modul Limbah Per Ruangan.
 *
 * Props:
 *  importing, importInputRef,
 *  onDownloadTemplate, onImportFile, onExportExcel
 */
export default function RuanganImportExportToolbar({
  importing,
  importInputRef,
  onDownloadTemplate,
  onImportFile,
  onExportExcel,
}) {
  return (
    <div className="bg-white rounded-2xl shadow-xl border border-gray-100 mb-6 overflow-hidden">
      <div className="bg-teal-700 text-white px-6 py-3 flex items-center justify-between">
        <h2 className="text-base font-bold flex items-center gap-2">
          <i className="fas fa-file-excel" /> Import &amp; Export Data Excel
        </h2>
      </div>
      <div className="p-5 flex flex-wrap gap-3 items-center">
        <button
          onClick={onDownloadTemplate}
          className="flex items-center gap-2 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 px-4 py-2.5 rounded-xl font-semibold text-xs sm:text-sm transition active:scale-95 shadow-xs"
        >
          <i className="fas fa-download" /> Download Template
        </button>

        <div>
          <input
            ref={importInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={onImportFile}
          />
          <button
            onClick={() => importInputRef.current?.click()}
            disabled={importing}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl font-semibold text-xs sm:text-sm transition active:scale-95 shadow-xs disabled:opacity-60"
          >
            {importing
              ? <><i className="fas fa-spinner fa-spin" /> Mengimport...</>
              : <><i className="fas fa-upload" /> Import Excel</>}
          </button>
        </div>

        <button
          onClick={onExportExcel}
          className="flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white px-4 py-2.5 rounded-xl font-semibold text-xs sm:text-sm transition active:scale-95 shadow-xs"
        >
          <i className="fas fa-file-excel" /> Export Excel
        </button>
      </div>
    </div>
  );
}
