/**
 * PadatTable – tabel data limbah padat (akumulasi harian) + mobile card.
 *
 * Props:
 *  data, loading, page, itemsPerPage, totalData,
 *  filterMonth, setFilterMonth, setPage,
 *  onEdit, onDelete, onPrint
 */
export default function PadatTable({
  data,
  loading,
  page,
  itemsPerPage,
  totalData,
  filterMonth,
  setFilterMonth,
  setPage,
  onEdit,
  onDelete,
  onPrint,
}) {
  return (
    <div className="bg-white rounded-lg shadow-lg overflow-hidden">
      {/* Info banner: keterangan warna baris */}
      <div className="bg-emerald-50 border-b border-emerald-200 px-5 py-2.5 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs text-gray-700">
        <span className="font-semibold text-emerald-800 flex items-center gap-1.5">
          <i className="fas fa-layer-group text-emerald-600" /> Keterangan Baris:
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-emerald-200 border-l-2 border-emerald-600 inline-block" />
          <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-800 border border-emerald-300 px-1.5 py-px rounded-full font-semibold text-[10px]">
            <i className="fas fa-hospital" /> N Ruangan
          </span>
          Akumulasi otomatis dari input per ruangan
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-sky-200 border-l-2 border-sky-600 inline-block" />
          <span className="inline-flex items-center gap-1 bg-sky-100 text-sky-800 border border-sky-300 px-1.5 py-px rounded-full font-semibold text-[10px]">
            <i className="fas fa-edit" /> + Manual
          </span>
          Akumulasi ruangan + input manual
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-gray-200 border-l-2 border-gray-400 inline-block" />
          Input manual (tanpa data ruangan)
        </span>
      </div>

      {/* Header bar */}
      <div className="bg-gray-800 text-white px-6 py-4 flex flex-col md:flex-row justify-between items-center gap-4">
        <h2 className="text-lg font-bold">
          <i className="fas fa-table mr-2" /> Data Limbah Padat
          <span className="ml-3 text-sm font-normal text-gray-300">({totalData} total data)</span>
        </h2>
        <div className="flex items-center gap-3">
          <input
            type="month"
            value={filterMonth}
            onChange={(e) => { setFilterMonth(e.target.value); setPage(1); }}
            className="bg-white text-gray-800 px-3 py-1.5 rounded-lg text-sm border focus:ring-2 focus:ring-blue-500 outline-none"
          />
          <button
            onClick={onPrint}
            className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded transition font-medium text-sm"
          >
            <i className="fas fa-print mr-2" /> Cetak PDF
          </button>
        </div>
      </div>

      {/* Desktop table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-100 text-gray-700 text-xs border-b">
              <th className="px-3 py-2.5">No.</th>
              <th className="px-3 py-2.5">Tanggal</th>
              <th className="px-3 py-2.5 text-right">Infeksius</th>
              <th className="px-3 py-2.5 text-right">Jarum</th>
              <th className="px-3 py-2.5 text-right">Botol</th>
              <th className="px-3 py-2.5 text-right">Sitotoksik</th>
              <th className="px-3 py-2.5 text-center">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="7" className="text-center py-8">
                <i className="fas fa-spinner fa-spin text-blue-500 text-2xl" />
                <p className="text-gray-500 text-sm mt-2">Memuat data...</p>
              </td></tr>
            ) : data.length === 0 ? (
              <tr><td colSpan="7" className="text-center py-8 text-gray-400">
                <i className="fas fa-inbox text-4xl mb-2 block" />Belum ada data.
              </td></tr>
            ) : (
              data.map((item, idx) => {
                const rowNo = (page - 1) * itemsPerPage + idx + 1;
                const isRoomOnly = item.isRoomAccumulation && !item.isManual;
                const isMixed = item.isRoomAccumulation && item.isManual;
                let rowClass = 'border-b hover:bg-gray-50 transition-colors';
                if (item.isOffline) rowClass = 'bg-amber-50/70 hover:bg-amber-100/70 border-l-4 border-l-amber-500 border-b transition-colors';
                else if (isRoomOnly) rowClass = 'bg-emerald-50/60 hover:bg-emerald-100/60 border-l-4 border-l-emerald-500 border-b transition-colors';
                else if (isMixed) rowClass = 'bg-sky-50/60 hover:bg-sky-100/60 border-l-4 border-l-sky-500 border-b transition-colors';
                return (
                  <tr key={item.id} className={rowClass}>
                    <td className="px-3 py-2.5 text-gray-400 text-xs">{rowNo}</td>
                    <td className="px-3 py-2.5 font-medium text-gray-800">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-xs whitespace-nowrap">{new Date(item.tanggal).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                        <div className="flex flex-wrap gap-1">
                          {isRoomOnly && <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 px-1.5 py-px rounded-full"><i className="fas fa-hospital" />{item.ruanganCount} Ruangan</span>}
                          {isMixed && <><span className="inline-flex items-center gap-1 text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 px-1.5 py-px rounded-full"><i className="fas fa-hospital" />{item.ruanganCount}R</span><span className="inline-flex items-center gap-1 text-[10px] font-bold bg-sky-100 text-sky-800 border border-sky-300 px-1.5 py-px rounded-full"><i className="fas fa-edit" />+Manual</span></>}
                          {item.isOffline && <span className="inline-flex items-center gap-1 text-[10px] font-extrabold bg-amber-200 text-amber-900 border border-amber-400 px-1.5 py-px rounded-full animate-pulse"><i className="fas fa-wifi-slash" />Draft</span>}
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-right text-red-600 font-semibold text-xs">{parseFloat(item.infeksius || 0).toFixed(2)}</td>
                    <td className="px-3 py-2.5 text-right text-orange-600 font-semibold text-xs">{parseFloat(item.jarum_suntik || 0).toFixed(2)}</td>
                    <td className="px-3 py-2.5 text-right text-blue-600 font-semibold text-xs">{parseFloat(item.botol_obat || 0).toFixed(2)}</td>
                    <td className="px-3 py-2.5 text-right text-purple-600 font-semibold text-xs">{parseFloat(item.sitotoksik || 0).toFixed(2)}</td>
                    <td className="px-3 py-2.5 text-center">
                      {isRoomOnly ? (
                        <button onClick={() => onEdit(item)} className="bg-emerald-100 text-emerald-700 hover:bg-emerald-200 px-2 py-1 rounded text-xs" title="Lihat Detail"><i className="fas fa-eye" /></button>
                      ) : (
                        <>
                          <button onClick={() => onEdit(item)} className="bg-blue-100 text-blue-600 hover:bg-blue-200 px-2 py-1 rounded mx-0.5 text-xs"><i className="fas fa-edit" /></button>
                          <button onClick={() => onDelete(item)} className="bg-red-100 text-red-600 hover:bg-red-200 px-2 py-1 rounded mx-0.5 text-xs"><i className="fas fa-trash" /></button>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile card list */}
      <div className="md:hidden divide-y divide-gray-100">
        {loading ? (
          <div className="text-center py-10">
            <i className="fas fa-spinner fa-spin text-blue-500 text-2xl" />
            <p className="text-gray-500 text-xs mt-2">Memuat data...</p>
          </div>
        ) : data.length === 0 ? (
          <div className="text-center py-10 text-gray-400">
            <i className="fas fa-inbox text-3xl mb-2 block opacity-50" />
            <p className="text-xs">Belum ada data.</p>
          </div>
        ) : (
          data.map((item, idx) => {
            const rowNo = (page - 1) * itemsPerPage + idx + 1;
            const isRoomOnly = item.isRoomAccumulation && !item.isManual;
            const isMixed = item.isRoomAccumulation && item.isManual;
            const borderColor = item.isOffline ? 'border-l-amber-500' : isRoomOnly ? 'border-l-emerald-500' : isMixed ? 'border-l-sky-500' : 'border-l-gray-300';
            return (
              <div key={item.id} className={`flex items-start gap-3 px-4 py-3 border-l-4 ${borderColor}`}>
                <span className="text-[10px] text-gray-400 font-bold pt-0.5 w-5 shrink-0">{rowNo}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
                    <span className="text-xs font-bold text-gray-800">{new Date(item.tanggal).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                    {isRoomOnly && <span className="inline-flex items-center gap-1 text-[9px] font-bold bg-emerald-100 text-emerald-800 px-1.5 py-px rounded-full"><i className="fas fa-hospital" />{item.ruanganCount}R</span>}
                    {isMixed && <><span className="inline-flex items-center gap-1 text-[9px] font-bold bg-emerald-100 text-emerald-800 px-1.5 py-px rounded-full"><i className="fas fa-hospital" />{item.ruanganCount}R</span><span className="inline-flex items-center gap-1 text-[9px] font-bold bg-sky-100 text-sky-800 px-1.5 py-px rounded-full">+Manual</span></>}
                    {item.isOffline && <span className="inline-flex items-center gap-1 text-[9px] font-bold bg-amber-200 text-amber-900 px-1.5 py-px rounded-full animate-pulse">Draft</span>}
                  </div>
                  <div className="grid grid-cols-4 gap-x-2 gap-y-0.5 text-[10px]">
                    <div><span className="text-gray-400">Infeksius</span><br /><span className="font-bold text-red-600">{parseFloat(item.infeksius || 0).toFixed(2)}</span></div>
                    <div><span className="text-gray-400">Jarum</span><br /><span className="font-bold text-orange-600">{parseFloat(item.jarum_suntik || 0).toFixed(2)}</span></div>
                    <div><span className="text-gray-400">Botol</span><br /><span className="font-bold text-blue-600">{parseFloat(item.botol_obat || 0).toFixed(2)}</span></div>
                    <div><span className="text-gray-400">Sito</span><br /><span className="font-bold text-purple-600">{parseFloat(item.sitotoksik || 0).toFixed(2)}</span></div>
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  {isRoomOnly ? (
                    <button onClick={() => onEdit(item)} className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs" title="Lihat Detail"><i className="fas fa-eye" /></button>
                  ) : (
                    <>
                      <button onClick={() => onEdit(item)} className="w-7 h-7 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center text-xs"><i className="fas fa-edit" /></button>
                      <button onClick={() => onDelete(item)} className="w-7 h-7 rounded-lg bg-red-100 text-red-600 flex items-center justify-center text-xs"><i className="fas fa-trash" /></button>
                    </>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
