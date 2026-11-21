import { ARCHIVE_TABLES } from '../../features/data-maintenance/services/dataMaintenanceService';

export default function DataMaintenanceTab({ maintenance }) {
  const {
    year, currentYear, inspection, totalRows, verifiedArchive, deletionAllowed,
    busy, progress, restoreInputRef, setYear, inspect, backup, remove, restore,
  } = maintenance;

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 bg-slate-50 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-cyan-100 flex items-center justify-center">
            <i className="fas fa-database text-cyan-700" />
          </div>
          <div>
            <h2 className="font-bold text-gray-800 text-sm">Pemeliharaan Data</h2>
            <p className="text-xs text-gray-500">Backup, verifikasi, hapus arsip lama, dan pulihkan data</p>
          </div>
        </div>

        <div className="p-5 sm:p-6 space-y-5">
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-xs text-blue-900">
            <p className="font-bold mb-1"><i className="fas fa-shield-alt mr-1.5" />Perlindungan otomatis</p>
            <p>Tahun berjalan dan tahun sebelumnya tidak dapat dihapus. Penghapusan baru aktif setelah backup JSON dan Excel selesai serta jumlah data terverifikasi.</p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
            <div className="flex-1">
              <label className="block text-xs font-bold text-gray-600 mb-1.5">Tahun yang akan diarsipkan</label>
              <input
                type="number"
                min="2000"
                max={currentYear - 1}
                value={year}
                disabled={busy}
                onChange={event => setYear(event.target.value)}
                className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm font-bold outline-none focus:ring-2 focus:ring-cyan-500 disabled:opacity-60"
              />
              <p className="text-[11px] text-gray-400 mt-1">
                Tahun {currentYear - 1} dapat dibackup tetapi belum dapat dihapus. Penghapusan maksimal tahun {currentYear - 2}.
              </p>
            </div>
            <button type="button" onClick={inspect} disabled={busy || year >= currentYear} className="bg-slate-700 hover:bg-slate-800 text-white px-5 py-2.5 rounded-xl text-xs font-bold disabled:opacity-50">
              <i className="fas fa-search mr-2" />Periksa Data
            </button>
          </div>

          {inspection && (
            <div className="rounded-xl border border-gray-200 overflow-hidden">
              <div className="bg-gray-50 px-4 py-3 flex justify-between text-xs font-bold text-gray-700">
                <span>Ringkasan tahun {year}</span>
                <span>{totalRows.toLocaleString('id-ID')} baris</span>
              </div>
              <div className="divide-y divide-gray-100">
                {ARCHIVE_TABLES.map(table => {
                  const item = inspection.find(entry => entry.name === table.name);
                  return (
                    <div key={table.name} className="px-4 py-2.5 flex justify-between text-xs">
                      <span className="text-gray-600">{table.label}</span>
                      <strong className="text-gray-800">{(item?.count || 0).toLocaleString('id-ID')}</strong>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {progress && (
            <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-xs font-semibold text-amber-800">
              <i className="fas fa-spinner fa-spin mr-2" />{progress}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button type="button" onClick={backup} disabled={busy || !inspection || totalRows === 0} className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-3 rounded-xl text-xs font-bold disabled:opacity-50">
              <i className="fas fa-file-download mr-2" />Backup JSON + Excel
            </button>
            <button type="button" onClick={remove} disabled={busy || !deletionAllowed || totalRows === 0} className="bg-red-600 hover:bg-red-700 text-white px-4 py-3 rounded-xl text-xs font-bold disabled:opacity-40">
              <i className="fas fa-trash-alt mr-2" />Hapus Data Terarsip
            </button>
          </div>

          {verifiedArchive && (
            <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-xs text-green-800">
              <i className="fas fa-check-circle mr-2" />
              Backup terverifikasi: <strong>{verifiedArchive.manifest.totalRows.toLocaleString('id-ID')} baris</strong>, checksum <code>{verifiedArchive.manifest.checksum}</code>.
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-5 sm:p-6">
        <h3 className="font-bold text-gray-800 text-sm"><i className="fas fa-undo-alt text-indigo-600 mr-2" />Pemulihan Arsip JSON</h3>
        <p className="text-xs text-gray-500 mt-1 mb-4">File akan diperiksa format, jumlah baris, dan checksum sebelum dipulihkan. Data dengan ID yang sama akan diperbarui.</p>
        <input ref={restoreInputRef} type="file" accept=".json,application/json" className="hidden" onChange={restore} disabled={busy} />
        <button type="button" onClick={() => restoreInputRef.current?.click()} disabled={busy} className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl text-xs font-bold disabled:opacity-50">
          <i className="fas fa-upload mr-2" />Pilih File dan Pulihkan
        </button>
      </div>
    </div>
  );
}
