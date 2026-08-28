export default function RuanganTab({
  filteredRuangan,
  searchRuangan,
  setSearchRuangan,
  newRuanganName,
  setNewRuanganName,
  addingRuangan,
  loadingRuangan,
  handleAddRuangan,
  handleDeleteRuangan,
  fetchRuangan
}) {
  return (
    <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
      {/* Form Tambah Ruangan */}
      <div className="p-5 border-b border-gray-100 bg-slate-50">
        <form onSubmit={handleAddRuangan} className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            placeholder="Tambah nama ruangan baru (contoh: Poli Mata)..."
            value={newRuanganName}
            onChange={(e) => setNewRuanganName(e.target.value)}
            className="flex-1 px-4 py-2.5 bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-sm font-medium"
          />
          <button
            type="submit"
            disabled={addingRuangan || !newRuanganName.trim()}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl font-bold text-sm transition shadow-sm disabled:opacity-50 flex items-center justify-center gap-2 whitespace-nowrap"
          >
            {addingRuangan ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-plus"></i>}
            Tambah Ruangan
          </button>
        </form>
      </div>

      {/* Filter Ruangan */}
      <div className="p-4 border-b border-gray-100">
        <div className="relative">
          <i className="fas fa-search absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"></i>
          <input
            type="text"
            placeholder="Filter nama ruangan..."
            value={searchRuangan}
            onChange={(e) => setSearchRuangan(e.target.value)}
            className="w-full pl-11 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-xs sm:text-sm"
          />
        </div>
      </div>

      {loadingRuangan ? (
        <div className="flex flex-col items-center justify-center py-16">
          <i className="fas fa-spinner fa-spin text-emerald-500 text-2xl mb-2"></i>
          <p className="text-gray-500 text-xs font-semibold">Memuat master ruangan...</p>
        </div>
      ) : filteredRuangan.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <i className="fas fa-door-closed text-3xl mb-2 block opacity-40"></i>
          Tidak ada ruangan ditemukan.
        </div>
      ) : (
        <div className="p-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 max-h-125 overflow-y-auto">
          {filteredRuangan.map((item, idx) => (
            <div key={item.id || idx} className="bg-gray-50 border border-gray-200 hover:border-emerald-300 p-3 rounded-xl flex items-center justify-between transition group">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs font-bold shrink-0">
                  {idx + 1}
                </span>
                <span className="text-xs sm:text-sm font-bold text-gray-800 truncate">{item.nama_ruangan}</span>
              </div>
              <button
                onClick={() => handleDeleteRuangan(item)}
                className="text-gray-400 hover:text-red-600 p-1.5 rounded-lg hover:bg-red-50 transition"
                title="Hapus Ruangan"
              >
                <i className="fas fa-trash-alt text-xs"></i>
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="px-6 py-3 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
        <p className="text-xs text-gray-500">
          Total <strong>{filteredRuangan.length}</strong> ruangan terdaftar
        </p>
        <button
          onClick={fetchRuangan}
          className="text-xs text-emerald-600 hover:text-emerald-800 font-semibold flex items-center gap-1 transition-colors"
        >
          <i className="fas fa-sync-alt text-[10px]"></i>Segarkan Data
        </button>
      </div>
    </div>
  );
}
