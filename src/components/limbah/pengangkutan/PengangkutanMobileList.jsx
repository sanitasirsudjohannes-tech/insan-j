export default function PengangkutanMobileList({ data, loading, page, itemsPerPage, formatDate, onEdit, onDelete }) {
  return (
    <div className="md:hidden divide-y divide-gray-100">
      {loading ? (
        <div className="text-center py-10"><i className="fas fa-spinner fa-spin text-orange-500 text-2xl" /><p className="text-gray-500 text-xs mt-2">Memuat data...</p></div>
      ) : data.length === 0 ? (
        <div className="text-center py-10 text-gray-400"><i className="fas fa-inbox text-3xl mb-2 block opacity-50" /><p className="text-xs">Belum ada data pengangkutan.</p></div>
      ) : data.map((item, idx) => {
        const rowNo = (page - 1) * itemsPerPage + idx + 1;
        const amount = parseFloat(item.jumlah_kg || 0);
        return (
          <div key={item.id} className={'flex items-start gap-3 px-4 py-3 border-l-4 ' + (item.isOffline ? 'border-l-amber-500 bg-amber-50/60' : 'border-l-orange-400')}>
            <span className="text-[10px] text-gray-400 font-bold pt-0.5 w-5 shrink-0">{rowNo}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap mb-1"><span className="text-xs font-bold text-gray-800">{formatDate(item.tanggal)}</span>{item.isOffline && <span className="text-[9px] font-bold bg-amber-200 text-amber-900 px-1.5 py-px rounded-full animate-pulse">Draft</span>}</div>
              <div className="flex items-baseline gap-1 mb-1"><span className="text-base font-black text-orange-600">{amount.toFixed(2)}</span><span className="text-[10px] font-bold text-gray-400">Kg</span></div>
              <p className="text-[10px] text-gray-500 truncate"><i className="fas fa-user mr-1 text-gray-400" />{item.petugas || '-'}</p>
              {item.keterangan && <p className="text-[10px] text-gray-400 truncate mt-0.5" title={item.keterangan}>{item.keterangan}</p>}
            </div>
            <div className="flex gap-1 shrink-0">
              <button type="button" onClick={() => onEdit(item)} className="w-7 h-7 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center text-xs" aria-label="Edit data"><i className="fas fa-edit" /></button>
              <button type="button" onClick={() => onDelete(item)} className="w-7 h-7 rounded-lg bg-red-100 text-red-600 flex items-center justify-center text-xs" aria-label="Hapus data"><i className="fas fa-trash" /></button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
