export default function PengangkutanImportExportToolbar({
  handleDownloadTemplate,
  handleImportFile,
  handleExport,
  importRef
}) {
  return (
    <div className="bg-white rounded-xl shadow-lg mb-6 overflow-hidden">
      <div className="bg-teal-700 text-white px-6 py-4">
        <h2 className="text-lg font-bold"><i className="fas fa-file-excel mr-2"></i>Import / Export Excel</h2>
      </div>
      <div className="p-5 flex flex-wrap gap-3 items-center">
        <button
          onClick={handleDownloadTemplate}
          className="flex items-center gap-2 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 px-4 py-2.5 rounded-lg font-semibold text-sm transition"
        >
          <i className="fas fa-download"></i> Download Template
        </button>
        <div>
          <input
            ref={importRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={handleImportFile}
          />
          <button
            onClick={() => importRef.current?.click()}
            className="flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white px-4 py-2.5 rounded-lg font-semibold text-sm transition"
          >
            <i className="fas fa-upload"></i> Import Excel
          </button>
        </div>
        <button
          onClick={handleExport}
          className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2.5 rounded-lg font-semibold text-sm transition"
        >
          <i className="fas fa-file-excel"></i> Export Excel
        </button>
        <div className="hidden sm:block w-px h-8 bg-gray-200 mx-1"></div>
        <div className="text-xs text-gray-500 w-full sm:w-auto sm:flex-1 min-w-0">
          <p>
            <i className="fas fa-info-circle text-teal-400 mr-1"></i>
            <strong>Format:</strong> Tanggal, Jumlah Diangkut (Kg), Keterangan
          </p>
        </div>
      </div>
    </div>
  );
}
