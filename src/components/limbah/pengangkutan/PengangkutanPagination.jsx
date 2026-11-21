export default function PengangkutanPagination({ page, setPage, totalPages }) {
  if (totalPages <= 0) return null;
  return (
    <div className="flex flex-col sm:flex-row justify-between items-center px-6 py-4 bg-gray-50 border-t text-sm gap-3">
      <div className="flex items-center space-x-2 text-gray-600">
        <span>Halaman</span>
        <input type="number" min="1" max={totalPages} value={page} onChange={(event) => {
          let value = parseInt(event.target.value, 10);
          if (Number.isNaN(value) || value < 1) value = 1;
          if (value > totalPages) value = totalPages;
          setPage(value);
        }} className="w-16 px-2 py-1 border rounded-lg text-center outline-none focus:ring-2 focus:ring-orange-500 font-bold bg-white text-xs" />
        <span>dari {totalPages}</span>
      </div>
      <div className="flex gap-2">
        <button type="button" onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1} className="px-3.5 py-1.5 bg-white border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-100 disabled:opacity-50 transition text-xs font-semibold">Sebelumnya</button>
        <button type="button" onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page === totalPages} className="px-3.5 py-1.5 bg-white border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-100 disabled:opacity-50 transition text-xs font-semibold">Selanjutnya</button>
      </div>
    </div>
  );
}
