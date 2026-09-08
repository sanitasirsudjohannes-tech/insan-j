import { EmptyState, TableRowsSkeleton } from '../../ui/DataStates';

export default function PengangkutanDesktopTable({ data, loading, page, itemsPerPage, formatDate, onEdit, onDelete }) {
  return (
    <div className="hidden md:block overflow-x-auto">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="bg-gray-100 text-gray-700 text-xs uppercase tracking-wider border-b">
            <th className="px-3 py-2.5 font-bold">No.</th>
            <th className="px-3 py-2.5 font-bold">Tanggal</th>
            <th className="px-3 py-2.5 font-bold text-right">Jumlah Diangkut</th>
            <th className="px-3 py-2.5 font-bold">Keterangan</th>
            <th className="px-3 py-2.5 font-bold">Petugas</th>
            <th className="px-3 py-2.5 font-bold text-center">Aksi</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 text-xs">
          {loading ? (
            <TableRowsSkeleton columns={6} />
          ) : data.length === 0 ? (
            <tr><td colSpan="6"><EmptyState compact title="Belum ada pengangkutan" description="Belum ada data untuk periode yang dipilih." icon="fas fa-truck" /></td></tr>
          ) : data.map((item, idx) => {
            const rowNo = (page - 1) * itemsPerPage + idx + 1;
            const amount = parseFloat(item.jumlah_kg || 0);
            return (
              <tr key={item.id} className={item.isOffline ? 'bg-amber-50/70 hover:bg-amber-100/70 border-l-4 border-l-amber-500 transition-colors' : 'hover:bg-orange-50/40 transition-colors'}>
                <td className="px-3 py-2 text-gray-400 font-medium">{rowNo}</td>
                <td className="px-3 py-2 font-medium text-gray-800 whitespace-nowrap">
                  {formatDate(item.tanggal)}
                  {item.isOffline && <span className="ml-1.5 inline-flex items-center gap-1 text-[9px] font-extrabold bg-amber-200 text-amber-900 border border-amber-400 px-1.5 py-px rounded-full shadow-2xs animate-pulse"><i className="fas fa-wifi-slash text-amber-700" />Draft</span>}
                </td>
                <td className="px-3 py-2 text-right"><span className="inline-block bg-orange-100 text-orange-700 text-[10px] font-black px-2 py-1 rounded-lg whitespace-nowrap">{amount.toFixed(2)} Kg</span></td>
                <td className="px-3 py-2 text-gray-600 max-w-xs"><span className="block truncate" title={item.keterangan || '-'}>{item.keterangan || '-'}</span></td>
                <td className="px-3 py-2 text-gray-600">{item.petugas || '-'}</td>
                <td className="px-3 py-2 text-center whitespace-nowrap">
                  <button type="button" onClick={() => onEdit(item)} className="bg-blue-100 text-blue-600 hover:bg-blue-200 px-2 py-1 rounded-lg mx-0.5 transition active:scale-95 text-xs" aria-label="Edit data"><i className="fas fa-edit" /></button>
                  <button type="button" onClick={() => onDelete(item)} className="bg-red-100 text-red-600 hover:bg-red-200 px-2 py-1 rounded-lg mx-0.5 transition active:scale-95 text-xs" aria-label="Hapus data"><i className="fas fa-trash" /></button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
