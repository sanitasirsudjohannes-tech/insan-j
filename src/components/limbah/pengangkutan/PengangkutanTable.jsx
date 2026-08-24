function formatTanggal(tanggal) {
  if (!tanggal) return '-';

  return new Date(tanggal).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
}

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
  const offlineCount = data.filter(item => item.isOffline).length;
  const firstItem = totalData > 0 ? (page - 1) * itemsPerPage + 1 : 0;
  const lastItem = Math.min(page * itemsPerPage, totalData);

  const changeMonth = (value) => {
    setFilterMonth(value);
    setPage(1);
  };

  const renderStatus = (item) => item.isOffline && (
    <span className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-100 px-2 py-1 text-[11px] font-bold text-amber-800">
      <i className="fas fa-wifi-slash" aria-hidden="true"></i>
      Belum sinkron
    </span>
  );

  const renderActions = (item, compact = false) => (
    <div className={compact ? 'grid grid-cols-2 gap-2' : 'flex items-center justify-center gap-2'}>
      <button
        type="button"
        onClick={() => handleEdit(item)}
        className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700 transition hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
        aria-label={'Edit data pengangkutan tanggal ' + formatTanggal(item.tanggal)}
        title="Edit data"
      >
        <i className="fas fa-edit" aria-hidden="true"></i>
        {compact && <span>Edit</span>}
      </button>
      <button
        type="button"
        onClick={() => handleDelete(item)}
        className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-1"
        aria-label={'Hapus data pengangkutan tanggal ' + formatTanggal(item.tanggal)}
        title="Hapus data"
      >
        <i className="fas fa-trash" aria-hidden="true"></i>
        {compact && <span>Hapus</span>}
      </button>
    </div>
  );

  return (
    <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-lg" aria-labelledby="riwayat-pengangkutan-title">
      {offlineCount > 0 && (
        <div className="border-b border-amber-200 bg-amber-50 px-4 py-4 text-amber-900 sm:px-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3 text-sm">
              <i className="fas fa-exclamation-triangle mt-0.5 text-amber-600" aria-hidden="true"></i>
              <p>
                <strong>{offlineCount} data offline</strong> tersimpan di perangkat dan belum dikirim ke server.
              </p>
            </div>
            {navigator.onLine && (
              <button
                type="button"
                onClick={() => syncOfflineQueue(true)}
                className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 sm:w-auto"
              >
                <i className="fas fa-cloud-upload-alt" aria-hidden="true"></i>
                Sinkronkan sekarang
              </button>
            )}
          </div>
        </div>
      )}

      <header className="bg-gray-800 px-4 py-5 text-white sm:px-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 id="riwayat-pengangkutan-title" className="flex items-center gap-2 text-lg font-bold">
              <i className="fas fa-truck" aria-hidden="true"></i>
              Riwayat Pengangkutan
            </h2>
            <p className="mt-1 text-sm text-gray-300">
              {totalData} data tercatat
              {filterMonth ? ' pada bulan yang dipilih' : ''}
            </p>
          </div>

          <div className="flex w-full flex-col gap-2 sm:flex-row lg:w-auto">
            <label className="flex-1 lg:min-w-56">
              <span className="mb-1 block text-xs font-semibold text-gray-200">Filter bulan</span>
              <input
                type="month"
                value={filterMonth}
                onChange={(event) => changeMonth(event.target.value)}
                className="min-h-11 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-800 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-400"
              />
            </label>
            {filterMonth && (
              <button
                type="button"
                onClick={() => changeMonth('')}
                className="min-h-11 rounded-lg border border-gray-500 px-4 text-sm font-semibold text-white transition hover:bg-gray-700 sm:self-end"
              >
                <i className="fas fa-times mr-2" aria-hidden="true"></i>
                Hapus filter
              </button>
            )}
          </div>
        </div>
      </header>

      {loading ? (
        <div className="flex min-h-48 flex-col items-center justify-center gap-3 px-4 py-10 text-gray-500" role="status">
          <i className="fas fa-spinner fa-spin text-3xl text-orange-500" aria-hidden="true"></i>
          <span className="text-sm">Memuat riwayat pengangkutan...</span>
        </div>
      ) : data.length === 0 ? (
        <div className="flex min-h-48 flex-col items-center justify-center px-4 py-10 text-center text-gray-500">
          <span className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-gray-100">
            <i className="fas fa-truck text-2xl text-gray-400" aria-hidden="true"></i>
          </span>
          <p className="font-semibold text-gray-700">Belum ada data pengangkutan</p>
          <p className="mt-1 text-sm">
            {filterMonth ? 'Coba pilih bulan lain atau hapus filter.' : 'Data yang disimpan akan muncul di sini.'}
          </p>
        </div>
      ) : (
        <>
          <div className="space-y-3 bg-gray-50 p-3 md:hidden">
            {data.map((item, idx) => (
              <article
                key={item.id}
                className={'rounded-xl border bg-white p-4 shadow-sm ' + (item.isOffline ? 'border-amber-300' : 'border-gray-200')}
              >
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                      Data #{(page - 1) * itemsPerPage + idx + 1}
                    </p>
                    <p className="mt-1 font-bold text-gray-900">{formatTanggal(item.tanggal)}</p>
                  </div>
                  {renderStatus(item)}
                </div>

                <div className="mb-4 rounded-xl bg-orange-50 px-4 py-3">
                  <p className="text-xs font-medium text-orange-700">Jumlah diangkut</p>
                  <p className="mt-0.5 text-xl font-extrabold text-orange-700">
                    {parseFloat(item.jumlah_kg || 0).toLocaleString('id-ID', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2
                    })} <span className="text-sm">Kg</span>
                  </p>
                </div>

                <dl className="mb-4 grid gap-3 text-sm">
                  <div>
                    <dt className="text-xs font-medium text-gray-400">Petugas</dt>
                    <dd className="mt-0.5 break-words font-medium text-gray-700">{item.petugas || '-'}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium text-gray-400">Keterangan</dt>
                    <dd className="mt-0.5 break-words text-gray-700">{item.keterangan || '-'}</dd>
                  </div>
                </dl>

                {renderActions(item, true)}
              </article>
            ))}
          </div>

          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[780px] border-collapse text-left">
              <thead>
                <tr className="border-b bg-gray-50 text-xs font-bold uppercase tracking-wide text-gray-500">
                  <th scope="col" className="px-4 py-3">No.</th>
                  <th scope="col" className="px-4 py-3">Tanggal</th>
                  <th scope="col" className="px-4 py-3 text-right">Jumlah</th>
                  <th scope="col" className="px-4 py-3">Keterangan</th>
                  <th scope="col" className="px-4 py-3">Petugas</th>
                  <th scope="col" className="px-4 py-3 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.map((item, idx) => (
                  <tr
                    key={item.id}
                    className={item.isOffline ? 'bg-amber-50/70 transition hover:bg-amber-100/70' : 'transition hover:bg-orange-50/60'}
                  >
                    <td className="px-4 py-4 text-sm text-gray-500">
                      {(page - 1) * itemsPerPage + idx + 1}
                    </td>
                    <td className="px-4 py-4">
                      <div className="font-semibold whitespace-nowrap text-gray-800">{formatTanggal(item.tanggal)}</div>
                      <div className="mt-1">{renderStatus(item)}</div>
                    </td>
                    <td className="px-4 py-4 text-right">
                      <span className="whitespace-nowrap font-bold text-orange-600">
                        {parseFloat(item.jumlah_kg || 0).toLocaleString('id-ID', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2
                        })} Kg
                      </span>
                    </td>
                    <td className="max-w-xs px-4 py-4 text-sm text-gray-600">
                      <span className="block break-words">{item.keterangan || '-'}</span>
                    </td>
                    <td className="max-w-48 px-4 py-4 text-sm text-gray-600">
                      <span className="block break-words">{item.petugas || '-'}</span>
                    </td>
                    <td className="px-4 py-4">{renderActions(item)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {totalPages > 0 && (
        <footer className="border-t bg-gray-50 px-4 py-4 sm:px-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-center text-sm text-gray-600 sm:text-left">
              Menampilkan <strong>{firstItem}-{lastItem}</strong> dari <strong>{totalData}</strong> data
            </p>

            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
              <button
                type="button"
                onClick={() => setPage(current => Math.max(1, current - 1))}
                disabled={page === 1}
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border bg-white px-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Halaman sebelumnya"
              >
                <i className="fas fa-chevron-left" aria-hidden="true"></i>
                <span className="hidden sm:inline">Sebelumnya</span>
              </button>

              <label className="flex items-center gap-1 whitespace-nowrap text-sm text-gray-600">
                <span>Hal.</span>
                <input
                  type="number"
                  min="1"
                  max={totalPages}
                  value={page}
                  onChange={(event) => {
                    let value = parseInt(event.target.value, 10);
                    if (Number.isNaN(value) || value < 1) value = 1;
                    if (value > totalPages) value = totalPages;
                    setPage(value);
                  }}
                  className="h-10 w-14 rounded-lg border bg-white px-2 text-center font-semibold text-gray-800 outline-none focus:ring-2 focus:ring-orange-400"
                  aria-label="Nomor halaman"
                />
                <span>/ {totalPages}</span>
              </label>

              <button
                type="button"
                onClick={() => setPage(current => Math.min(totalPages, current + 1))}
                disabled={page === totalPages}
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border bg-white px-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Halaman selanjutnya"
              >
                <span className="hidden sm:inline">Selanjutnya</span>
                <i className="fas fa-chevron-right" aria-hidden="true"></i>
              </button>
            </div>
          </div>
        </footer>
      )}
    </section>
  );
}
