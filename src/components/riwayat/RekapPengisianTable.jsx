export default function RekapPengisianTable({ data }) {
  // Calculate aggregation for Admin
  const rekapUser = {};
  data.forEach(item => {
    const petugas = item.petugas || 'Tanpa Nama';
    if (!rekapUser[petugas]) {
      rekapUser[petugas] = {
        nama: petugas,
        'Ruang Bangunan': 0,
        'Pengolahan Limbah': 0,
        'Kebersihan Toilet': 0,
        'Kebersihan Bak Reservoir': 0,
        'Ceklist Gizi': 0
      };
    }
    if (item.formName === 'Ruang Bangunan') rekapUser[petugas]['Ruang Bangunan']++;
    else if (item.formName === 'Pengolahan Limbah') rekapUser[petugas]['Pengolahan Limbah']++;
    else if (item.formName === 'Kebersihan Toilet') rekapUser[petugas]['Kebersihan Toilet']++;
    else if (item.formName === 'Kebersihan Bak Reservoir') rekapUser[petugas]['Kebersihan Bak Reservoir']++;
    else if (item.formName === 'Ceklist Gizi') rekapUser[petugas]['Ceklist Gizi']++;
  });
  
  const rekapArray = Object.values(rekapUser);

  return (
    <div className="overflow-x-auto rounded-2xl shadow-sm border border-gray-200">
      <table className="min-w-full divide-y divide-gray-200 bg-white print:border-collapse print:border print:border-black">
        <thead className="bg-gray-50 print:bg-transparent">
          <tr>
            <th scope="col" className="px-3 md:px-6 py-4 print:py-2 print:px-3 print:border print:border-black text-left text-[10px] sm:text-xs font-extrabold text-gray-500 print:text-black uppercase tracking-wider">Nama Petugas</th>
            <th scope="col" className="px-3 md:px-6 py-4 print:py-2 print:px-3 print:border print:border-black text-center text-[10px] sm:text-xs font-extrabold text-blue-600 print:text-black uppercase tracking-wider">Ruang Bangunan</th>
            <th scope="col" className="px-3 md:px-6 py-4 print:py-2 print:px-3 print:border print:border-black text-center text-[10px] sm:text-xs font-extrabold text-green-600 print:text-black uppercase tracking-wider">Limbah</th>
            <th scope="col" className="px-3 md:px-6 py-4 print:py-2 print:px-3 print:border print:border-black text-center text-[10px] sm:text-xs font-extrabold text-purple-600 print:text-black uppercase tracking-wider">Toilet</th>
            <th scope="col" className="px-3 md:px-6 py-4 print:py-2 print:px-3 print:border print:border-black text-center text-[10px] sm:text-xs font-extrabold text-yellow-600 print:text-black uppercase tracking-wider">Reservoir</th>
            <th scope="col" className="px-3 md:px-6 py-4 print:py-2 print:px-3 print:border print:border-black text-center text-[10px] sm:text-xs font-extrabold text-gray-600 print:text-black uppercase tracking-wider">Gizi</th>
            <th scope="col" className="px-3 md:px-6 py-4 print:py-2 print:px-3 print:border print:border-black text-center text-[10px] sm:text-xs font-extrabold text-indigo-800 print:text-black uppercase tracking-wider">Total</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 print:divide-none">
          {rekapArray.map((rekap, idx) => {
            const totalSubmit = rekap['Ruang Bangunan'] + rekap['Pengolahan Limbah'] + rekap['Kebersihan Toilet'] + rekap['Kebersihan Bak Reservoir'] + rekap['Ceklist Gizi'];
            return (
              <tr key={idx} className="hover:bg-indigo-50/30 transition-colors duration-200 group print:border print:border-black text-[10px] sm:text-xs md:text-sm">
                <td className="px-3 md:px-6 py-4 print:py-2 print:px-3 print:border print:border-black whitespace-nowrap">
                  <span className="font-bold text-gray-800 print:text-black">{rekap.nama}</span>
                </td>
                <td className="px-3 md:px-6 py-4 print:py-2 print:px-3 print:border print:border-black whitespace-nowrap text-center font-bold text-gray-700 print:text-black">{rekap['Ruang Bangunan']}</td>
                <td className="px-3 md:px-6 py-4 print:py-2 print:px-3 print:border print:border-black whitespace-nowrap text-center font-bold text-gray-700 print:text-black">{rekap['Pengolahan Limbah']}</td>
                <td className="px-3 md:px-6 py-4 print:py-2 print:px-3 print:border print:border-black whitespace-nowrap text-center font-bold text-gray-700 print:text-black">{rekap['Kebersihan Toilet']}</td>
                <td className="px-3 md:px-6 py-4 print:py-2 print:px-3 print:border print:border-black whitespace-nowrap text-center font-bold text-gray-700 print:text-black">{rekap['Kebersihan Bak Reservoir']}</td>
                <td className="px-3 md:px-6 py-4 print:py-2 print:px-3 print:border print:border-black whitespace-nowrap text-center font-bold text-gray-700 print:text-black">{rekap['Ceklist Gizi']}</td>
                <td className="px-3 md:px-6 py-4 print:py-2 print:px-3 print:border print:border-black whitespace-nowrap text-center">
                  <span className="font-extrabold text-indigo-700 print:text-black bg-indigo-50 print:bg-transparent px-2 md:px-3 py-1 print:p-0 rounded-lg border border-indigo-100 print:border-none inline-block shadow-sm print:shadow-none">
                    {totalSubmit}
                  </span>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  );
}
