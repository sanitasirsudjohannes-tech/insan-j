/**
 * PadatImportExportToolbar – toolbar download template, import & export Excel
 * untuk modul Limbah Padat.
 *
 * Props:
 *  importing, importInputRef,
 *  onDownloadTemplate, onImportFile, onExportExcel
 */
export default function PadatImportExportToolbar({
  importing,
  importInputRef,
  onDownloadTemplate,
  onImportFile,
  onExportExcel,
}) {
  return (
    <div className="bg-white rounded-lg shadow-lg mb-6 overflow-hidden">
      <div className="bg-emerald-700 text-white px-6 py-4">
        <h2 className="text-lg font-bold">
          <i className="fas fa-file-excel mr-2" /> Import / Export Excel
        </h2>
      </div>
      <div className="p-5 flex flex-wrap gap-3 items-center">
        {/* Download Template */}
        <button
          onClick={onDownloadTemplate}
          className="flex items-center gap-2 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 px-4 py-2.5 rounded-lg font-semibold text-sm transition active:scale-95 shadow-sm"
        >
          <i className="fas fa-download" />
          <span>Download Template</span>
        </button>

        {/* Import Excel */}
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
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-lg font-semibold text-sm transition active:scale-95 shadow-sm disabled:opacity-60"
          >
            {importing
              ? <><i className="fas fa-spinner fa-spin" /><span>Mengimport...</span></>
              : <><i className="fas fa-upload" /><span>Import Excel</span></>}
          </button>
        </div>

        {/* Export Excel */}
        <button
          onClick={onExportExcel}
          className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2.5 rounded-lg font-semibold text-sm transition active:scale-95 shadow-sm"
        >
          <i className="fas fa-file-excel" />
          <span>Export Excel</span>
        </button>

        <div className="hidden sm:block w-px h-8 bg-gray-200 mx-1" />

        <div className="text-xs text-gray-500 w-full sm:w-auto sm:flex-1 min-w-0">
          <p><i className="fas fa-info-circle text-blue-400 mr-1" /><strong>Import:</strong> Download template terlebih dahulu, isi data, lalu upload.</p>
          <p className="mt-0.5"><i className="fas fa-info-circle text-green-500 mr-1" /><strong>Export:</strong> Ekspor data per bulan ke file Excel (.xlsx).</p>
        </div>
      </div>
    </div>
  );
}
