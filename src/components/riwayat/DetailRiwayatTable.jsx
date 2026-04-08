import { useState, useEffect } from 'react';

export default function DetailRiwayatTable({ data, isAdmin, onEdit, onDelete }) {
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // Reset to first page when filtering or page size changes
  useEffect(() => {
    setCurrentPage(1);
  }, [data.length, rowsPerPage]);

  const totalItems = data.length;
  const totalPages = Math.ceil(totalItems / rowsPerPage);
  const startIndex = (currentPage - 1) * rowsPerPage;
  const paginatedData = data.slice(startIndex, startIndex + rowsPerPage);

  return (
    <div className="overflow-x-auto rounded-2xl shadow-sm border border-gray-200">
      <table className="min-w-full divide-y divide-gray-200 bg-white print:border-collapse print:border print:border-black">
        <thead className="bg-gray-50 print:bg-transparent">
          <tr>
            {isAdmin && <th scope="col" className="px-6 py-4 print:py-2 print:px-3 print:border print:border-black text-left text-xs font-extrabold text-gray-500 print:text-black uppercase tracking-wider">Petugas</th>}
            <th scope="col" className="px-6 py-4 print:py-2 print:px-3 print:border print:border-black text-left text-xs font-extrabold text-gray-500 print:text-black uppercase tracking-wider">Tanggal</th>
            <th scope="col" className="px-6 py-4 print:py-2 print:px-3 print:border print:border-black text-left text-xs font-extrabold text-gray-500 print:text-black uppercase tracking-wider">Lokasi</th>
            <th scope="col" className="px-6 py-4 print:py-2 print:px-3 print:border print:border-black text-left text-xs font-extrabold text-gray-500 print:text-black uppercase tracking-wider">Formulir</th>
            <th scope="col" className="px-6 py-4 print:py-2 print:px-3 print:border print:border-black text-left text-xs font-extrabold text-gray-500 print:text-black uppercase tracking-wider">Total Nilai</th>
            <th scope="col" className="px-6 py-4 print:py-2 print:px-3 print:border print:border-black text-left text-xs font-extrabold text-gray-500 print:text-black uppercase tracking-wider">Persentase</th>
            {!isAdmin && <th scope="col" className="px-6 py-4 print:hidden text-center text-xs font-extrabold text-gray-500 uppercase tracking-wider">Aksi</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 print:divide-none">
          {paginatedData.map((item, idx) => (
            <tr key={item.id || idx} className="hover:bg-blue-50/50 transition-colors duration-200 group print:border print:border-black">
              {isAdmin && (
                <td className="px-3 md:px-6 py-4 md:py-5 print:py-2 print:px-3 print:border print:border-black whitespace-nowrap">
                  <div className="text-[10px] sm:text-xs md:text-sm font-bold text-indigo-700 print:text-black flex items-center">
                    {item.petugas || '-'}
                  </div>
                </td>
              )}
              <td className="px-3 md:px-6 py-4 md:py-5 print:py-2 print:px-3 print:border print:border-black whitespace-nowrap">
                <div className="flex items-center">
                  <div className="bg-blue-100 text-blue-600 w-7 h-7 rounded-full flex items-center justify-center mr-2 group-hover:bg-blue-600 group-hover:text-white transition-colors shadow-sm print:hidden shrink-0">
                    <i className="far fa-calendar-alt text-[10px] print:hidden"></i>
                  </div>
                  <span className="text-[10px] sm:text-sm font-bold text-gray-800 print:text-black">
                    {new Date(item.tanggal).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })} <span className="hidden sm:inline">{new Date(item.tanggal).getFullYear()}</span>
                  </span>
                </div>
              </td>
              <td className="px-3 md:px-6 py-4 md:py-5 print:py-2 print:px-3 print:border print:border-black whitespace-nowrap">
                <div className="text-[10px] md:text-sm text-gray-700 print:text-black font-bold flex items-center">
                  <span className="print:hidden">
                    <i className="fas fa-map-marker-alt text-gray-400 mr-1.5 text-[10px]"></i>
                  </span>
                  {item.lokasi}
                </div>
              </td>
              <td className="px-3 md:px-6 py-4 md:py-5 print:py-2 print:px-3 print:border print:border-black whitespace-nowrap">
                <span className="px-2 py-1 print:p-0 inline-flex text-[9px] md:text-xs leading-5 font-bold rounded-lg bg-indigo-50 print:bg-transparent text-indigo-700 print:text-black border border-indigo-100 print:border-none shadow-sm print:shadow-none">
                  {item.formName}
                </span>
              </td>
              <td className="px-3 md:px-6 py-4 md:py-5 print:py-2 print:px-3 print:border print:border-black whitespace-nowrap">
                <div className="text-[10px] md:text-sm text-gray-900 print:text-black font-extrabold bg-gray-50 print:bg-transparent px-2 md:px-3 py-1 print:p-0 rounded-lg inline-block border border-gray-200 print:border-none">
                  {item.nilai} <span className="text-gray-400 print:text-black font-medium text-[9px] md:text-xs">/ {item.maksimal}</span>
                </div>
              </td>
              <td className="px-3 md:px-6 py-4 md:py-5 print:py-2 print:px-3 print:border print:border-black whitespace-nowrap">
                <div className="flex items-center">
                  <div className="w-12 sm:w-20 bg-gray-200 rounded-full h-2 mr-2 overflow-hidden shadow-inner print:hidden shrink-0">
                    <div
                      className={`h-full rounded-full transition-all duration-1000 ease-out ${item.persentase >= 80 ? 'bg-linear-to-r from-green-400 to-green-500' :
                        item.persentase >= 60 ? 'bg-linear-to-r from-yellow-400 to-yellow-500' :
                          'bg-linear-to-r from-red-400 to-red-500'
                        }`}
                      style={{ width: `${item.persentase}%` }}
                    ></div>
                  </div>
                  <span className={`text-[10px] sm:text-sm font-black print:text-black ${item.persentase >= 80 ? 'text-green-600' :
                    item.persentase >= 60 ? 'text-yellow-600' :
                      'text-red-600'
                    }`}>
                    {item.persentase}%
                  </span>
                </div>
              </td>

              {/* Kolom Aksi Hanya Untuk Petugas */}
              {!isAdmin && (
                <td className="px-6 py-5 whitespace-nowrap text-center print:hidden">
                  <div className="flex items-center justify-center space-x-3">
                    <button
                      onClick={() => onEdit(item)}
                      className="text-blue-500 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 p-2 rounded-lg transition-colors"
                      title="Edit Data"
                    >
                      <i className="fas fa-edit"></i>
                    </button>
                    <button
                      onClick={() => onDelete(item)}
                      className="text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 p-2 rounded-lg transition-colors"
                      title="Hapus Data"
                    >
                      <i className="fas fa-trash-alt"></i>
                    </button>
                  </div>
                </td>
              )}

            </tr>
          ))}
        </tbody>
      </table>

      {/* Pagination Detail Riwayat */}
      <div className="bg-white px-4 md:px-6 py-4 flex flex-col items-center justify-center border-t border-gray-200 print:hidden gap-4">
        <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-4 w-full justify-between">
          <div className="flex items-center">
            <span className="text-xs text-gray-700 font-medium">Baris:</span>
            <select
              className="ml-2 bg-gray-50 border border-gray-300 text-gray-900 text-xs rounded-lg p-1.5 font-bold outline-none"
              value={rowsPerPage}
              onChange={(e) => setRowsPerPage(Number(e.target.value))}
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
            </select>
            <span className="ml-4 text-[10px] sm:text-xs text-gray-500">
              <span className="font-bold text-gray-800">{totalItems > 0 ? startIndex + 1 : 0}</span>-<span className="font-bold text-gray-800">{Math.min(startIndex + rowsPerPage, totalItems)}</span> dari <span className="font-bold text-gray-800">{totalItems}</span>
            </span>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className="p-2 sm:px-4 sm:py-2 bg-white border border-gray-300 rounded-xl text-xs font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              title="Sebelumnya"
            >
              <i className="fas fa-chevron-left sm:mr-2"></i><span className="hidden sm:inline">Sebelumnya</span>
            </button>
            <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl">
              <span className="text-[10px] sm:text-xs font-bold text-gray-700">Hal <span className="text-blue-600">{currentPage}</span> / {totalPages || 1}</span>
            </div>
            <button
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages || totalPages === 0}
              className="p-2 sm:px-4 sm:py-2 bg-white border border-gray-300 rounded-xl text-xs font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              title="Selanjutnya"
            >
              <span className="hidden sm:inline">Selanjutnya</span><i className="fas fa-chevron-right sm:ml-2"></i>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
