export default function PengangkutanTable({
  data,
  loading,
  totalData,
  filterMonth,
  setFilterMonth,
  page,
  setPage,
  itemsPerPage,
  totalPages,
  handleEdit,
  handleDelete,
  syncOfflineQueue
}) {
  return (
    <div className="bg-white rounded-xl shadow-lg overflow-hidden">
      {/* Banner Peringatan Data Offline Belum Sinkron */}
      {data.some(i => i.isOffline) && (
        <div className="bg-amber-50 border-b border-amber-200 text-amber-900 px-6 py-3 text-xs sm:text-sm font-medium flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <i className="fas fa-exclamation-triangle text-amber-600 text-base animate-pulse"></i>
            <span>Terdapat <strong>{data.filter(i => i.isOffline).length} data offline</strong> yang tersimpan di HP dan <strong>belum tersinkronisasi</strong> ke server.</span>
          </div>
          {navigator.onLine && (
            <button
              onClick={() => syncOfflineQueue(true)}
              className="bg-amber-600 hover:bg-amber-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-xs"
            >
              <i className="fas fa-cloud-upload-alt"></i> Sinkronkan Sekarang
            </button>
          )}
        </div>
      )}

      <div className="bg-gray-800 text-white px-6 py-4 flex flex-col md:flex-row justify-between items-center gap-4">
        <h2 className="text-lg font-bold">
          <i className="fas fa-table mr-2"></i> Riwayat Pengangkutan
          <span className="ml-2 text-sm font-normal text-gray-400">({totalData} data)</span>
        </h2>
        <div className="flex items-center">
          <input
            type="month"
            value={filterMonth}
            onChange={(e) => {
              setFilterMonth(e.target.value);
              setPage(1);
            }}
            className="bg-white text-gray-800 px-3 py-1.5 rounded-lg text-sm border focus:ring-2 focus:ring-blue-500 outline-none"
          />
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50 text-gray-600 text-sm border-b">
              <th className="px-4 py-3">No.</th>
              <th className="px-4 py-3">Tanggal</th>
              <th className="px-4 py-3 text-right">Jumlah Diangkut (Kg)</th>
              <th className="px-4 py-3">Keterangan</th>
              <th className="px-4 py-3">Petugas</th>
              <th className="px-4 py-3 text-center">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="6" className="text-center py-10">
                  <i className="fas fa-spinner fa-spin text-orange-500 text-2xl"></i>
                </td>
              </tr>
            ) : data.length === 0 ? (
              <tr>
                <td colSpan="6" className="text-center py-10 text-gray-400">
                  <i className="fas fa-truck text-4xl block mb-2 opacity-30"></i>
                  Belum ada data pengangkutan.
                </td>
              </tr>
            ) : data.map((item, idx) => (
              <tr
                key={item.id}
                className={item.isOffline ? "bg-amber-50/70 hover:bg-amber-100/70 border-l-4 border-l-amber-500 border-b transition-colors" : "border-b hover:bg-orange-50 transition-colors"}
              >
                <td className="px-4 py-3 text-gray-500 text-sm">{(page - 1) * itemsPerPage + idx + 1}</td>
                <td className="px-4 py-3 font-medium text-gray-800 whitespace-nowrap">
                  {new Date(item.tanggal).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                  {item.isOffline && (
                    <span className="ml-2 inline-flex items-center gap-1 text-[10px] font-extrabold bg-amber-200 text-amber-900 border border-amber-400 px-2 py-0.5 rounded-full shadow-2xs animate-pulse whitespace-nowrap">
                      <i className="fas fa-wifi-slash text-amber-700"></i> Belum Sinkron
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  <span className="font-bold text-orange-600">{parseFloat(item.jumlah_kg || 0).toFixed(2)} Kg</span>
                </td>
                <td className="px-4 py-3 text-gray-600 text-sm">{item.keterangan || '-'}</td>
                <td className="px-4 py-3 text-gray-600 text-sm">{item.petugas}</td>
                <td className="px-4 py-3 text-center">
                  <button
                    onClick={() => handleEdit(item)}
                    className="bg-blue-100 text-blue-600 hover:bg-blue-200 px-2 py-1 rounded mx-1 transition"
                  >
                    <i className="fas fa-edit"></i>
                  </button>
                  <button
                    onClick={() => handleDelete(item)}
                    className="bg-red-100 text-red-600 hover:bg-red-200 px-2 py-1 rounded mx-1 transition"
                  >
                    <i className="fas fa-trash"></i>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {totalPages > 0 && (
        <div className="flex justify-between items-center px-6 py-4 bg-gray-50 border-t text-sm">
          <div className="flex items-center space-x-2 text-gray-600">
            <span>Hal.</span>
            <input
              type="number"
              min="1"
              max={totalPages}
              value={page}
              onChange={(e) => {
                let val = parseInt(e.target.value);
                if (isNaN(val) || val < 1) val = 1;
                if (val > totalPages) val = totalPages;
                setPage(val);
              }}
              className="w-16 px-2 py-1 border rounded text-center outline-none focus:ring-2 focus:ring-blue-500"
            />
            <span>/ {totalPages}</span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1 bg-white border rounded hover:bg-gray-100 disabled:opacity-50"
            >
              Sebelumnya
            </button>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-3 py-1 bg-white border rounded hover:bg-gray-100 disabled:opacity-50"
            >
              Selanjutnya
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
