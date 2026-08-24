import { JENIS_FIELDS } from './AnorganikForm';

/**
 * AnorganikTable – tabel data limbah anorganik (desktop + mobile card).
 *
 * Props:
 *  data, loading, page, itemsPerPage,
 *  filterMonth, filterRuangan, ruanganList,
 *  totalData,
 *  setFilterMonth, setFilterRuangan, setPage,
 *  onEdit, onDelete
 */
export default function AnorganikTable({
  data,
  loading,
  page,
  itemsPerPage,
  filterMonth,
  filterRuangan,
  ruanganList,
  totalData,
  setFilterMonth,
  setFilterRuangan,
  setPage,
  onEdit,
  onDelete,
  onPrint,
}) {
  return (
    <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
      {/* Header bar */}
      <div className="bg-slate-800 text-white px-6 py-4 flex flex-col md:flex-row justify-between items-center gap-4">
        <h2 className="text-lg font-bold flex items-center gap-2">
          <i className="fas fa-table" /> Data Limbah Anorganik
          <span className="ml-2 text-xs font-normal text-slate-300">({totalData} total data)</span>
        </h2>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <select
            value={filterRuangan}
            onChange={(e) => { setFilterRuangan(e.target.value); setPage(1); }}
            className="bg-white text-gray-800 px-3 py-2 rounded-xl text-xs sm:text-sm border outline-none font-medium max-w-[180px] truncate"
          >
            <option value="">Semua Ruangan</option>
            {ruanganList.map(r => <option key={r} value={r}>{r}</option>)}
          </select>

          <input
            type="month"
            value={filterMonth}
            onChange={(e) => { setFilterMonth(e.target.value); setPage(1); }}
            className="bg-white text-gray-800 px-3 py-2 rounded-xl text-xs sm:text-sm border outline-none font-medium"
          />

          {onPrint && (
            <button
              onClick={onPrint}
              className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-xl transition text-xs font-semibold flex items-center gap-1.5 shadow-sm"
            >
              <i className="fas fa-print" /> Cetak
            </button>
          )}
        </div>
      </div>

      {/* Desktop table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-100 text-gray-700 text-xs uppercase tracking-wider border-b">
              <th className="px-3 py-2.5 font-bold">No.</th>
              <th className="px-3 py-2.5 font-bold">Tanggal</th>
              <th className="px-3 py-2.5 font-bold">Ruangan</th>
              {JENIS_FIELDS.map(f => (
                <th key={f.name} className="px-3 py-2.5 font-bold text-right">
                  {f.label}<br /><span className="normal-case text-gray-500">({f.satuan})</span>
                </th>
              ))}
              <th className="px-3 py-2.5 font-bold text-right">Total<br /><span className="normal-case text-gray-500">(Kg)</span></th>
              <th className="px-3 py-2.5 font-bold">Petugas</th>
              <th className="px-3 py-2.5 font-bold text-center">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 text-xs">
            {loading ? (
              <tr><td colSpan={JENIS_FIELDS.length + 6} className="text-center py-10">
                <i className="fas fa-spinner fa-spin text-cyan-500 text-2xl mb-2 block" />
                <span className="text-gray-500 text-xs font-semibold">Memuat data...</span>
              </td></tr>
            ) : data.length === 0 ? (
              <tr><td colSpan={JENIS_FIELDS.length + 6} className="text-center py-12 text-gray-400">
                <i className="fas fa-inbox text-4xl mb-3 block opacity-40" />Belum ada data limbah anorganik.
              </td></tr>
            ) : (
              data.map((item, idx) => {
                const rowNo = (page - 1) * itemsPerPage + idx + 1;
                const total = JENIS_FIELDS.reduce((sum, f) => (
                  f.satuan === 'Kg' ? sum + (parseFloat(item[f.name]) || 0) : sum
                ), 0);
                return (
                  <tr key={item.id} className={item.isOffline ? "bg-amber-50/70 hover:bg-amber-100/70 border-l-4 border-l-amber-500 transition-colors" : "hover:bg-cyan-50/40 transition-colors"}>
                    <td className="px-3 py-2 text-gray-400 font-medium">{rowNo}</td>
                    <td className="px-3 py-2 font-medium text-gray-800 whitespace-nowrap">
                      {new Date(item.tanggal).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                      {item.isOffline && <span className="ml-1.5 inline-flex items-center gap-1 text-[9px] font-extrabold bg-amber-200 text-amber-900 border border-amber-400 px-1.5 py-px rounded-full animate-pulse"><i className="fas fa-wifi-slash text-amber-700" />Draft</span>}
                    </td>
                    <td className="px-3 py-2 font-bold text-cyan-700">
                      <span className="inline-block bg-cyan-100 text-cyan-800 text-[10px] px-2 py-0.5 rounded-lg">{item.ruangan || '-'}</span>
                    </td>
                    {JENIS_FIELDS.map(f => (
                      <td key={f.name} className="px-3 py-2 text-right font-semibold text-gray-700">
                        {f.satuan === 'Buah'
                          ? (parseFloat(item[f.name]) || 0).toLocaleString('id-ID')
                          : (parseFloat(item[f.name]) || 0).toFixed(2)}
                      </td>
                    ))}
                    <td className="px-3 py-2 text-right font-black text-slate-800">{total.toFixed(2)} Kg</td>
                    <td className="px-3 py-2 text-gray-600">{item.petugas || '-'}</td>
                    <td className="px-3 py-2 text-center whitespace-nowrap">
                      <button onClick={() => onEdit(item)} className="bg-blue-100 text-blue-600 hover:bg-blue-200 px-2 py-1 rounded-lg mx-0.5 transition active:scale-95 text-xs"><i className="fas fa-edit" /></button>
                      <button onClick={() => onDelete(item)} className="bg-red-100 text-red-600 hover:bg-red-200 px-2 py-1 rounded-lg mx-0.5 transition active:scale-95 text-xs"><i className="fas fa-trash" /></button>
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
            <i className="fas fa-spinner fa-spin text-cyan-500 text-2xl" />
            <p className="text-gray-500 text-xs mt-2">Memuat data...</p>
          </div>
        ) : data.length === 0 ? (
          <div className="text-center py-10 text-gray-400">
            <i className="fas fa-inbox text-3xl mb-2 block opacity-50" />
            <p className="text-xs">Belum ada data limbah anorganik.</p>
          </div>
        ) : (
          data.map((item, idx) => {
            const rowNo = (page - 1) * itemsPerPage + idx + 1;
            const total = JENIS_FIELDS.reduce((sum, f) => (
              f.satuan === 'Kg' ? sum + (parseFloat(item[f.name]) || 0) : sum
            ), 0);
            return (
              <div key={item.id} className={`flex items-start gap-3 px-4 py-3 border-l-4 ${item.isOffline ? 'border-l-amber-500 bg-amber-50/60' : 'border-l-cyan-400'}`}>
                <span className="text-[10px] text-gray-400 font-bold pt-0.5 w-5 shrink-0">{rowNo}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap mb-1">
                    <span className="text-xs font-bold text-gray-800">{new Date(item.tanggal).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                    <span className="text-[10px] font-bold bg-cyan-100 text-cyan-800 px-2 py-px rounded-full">{item.ruangan || '-'}</span>
                    {item.isOffline && <span className="text-[9px] font-bold bg-amber-200 text-amber-900 px-1.5 py-px rounded-full animate-pulse">Draft</span>}
                  </div>
                  <div className="grid grid-cols-3 gap-x-1 gap-y-0.5 text-[10px]">
                    {JENIS_FIELDS.map(f => (
                      <div key={f.name}>
                        <span className="text-gray-400">{f.label} ({f.satuan})</span><br />
                        <span className="font-bold text-gray-700">
                          {f.satuan === 'Buah'
                            ? (parseFloat(item[f.name]) || 0).toLocaleString('id-ID')
                            : (parseFloat(item[f.name]) || 0).toFixed(2)}
                        </span>
                      </div>
                    ))}
                    <div><span className="text-gray-400">Total (Kg)</span><br /><span className="font-black text-slate-800">{total.toFixed(2)}</span></div>
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <button onClick={() => onEdit(item)} className="w-7 h-7 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center text-xs"><i className="fas fa-edit" /></button>
                  <button onClick={() => onDelete(item)} className="w-7 h-7 rounded-lg bg-red-100 text-red-600 flex items-center justify-center text-xs"><i className="fas fa-trash" /></button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
