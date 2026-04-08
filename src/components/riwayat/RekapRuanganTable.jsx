export default function RekapRuanganTable({ data }) {
  // Calculate aggregation for Rekap Ruangan (per petugas + per ruangan)
  const rekapRuanganMap = {};
  data.forEach(item => {
    const petugas = item.petugas || 'Tanpa Nama';
    const ruangan = item.lokasi || 'Tanpa Ruangan';
    const key = `${petugas}__${ruangan}`;
    if (!rekapRuanganMap[key]) {
      rekapRuanganMap[key] = {
        petugas,
        ruangan,
        'Ruang Bangunan': null,
        'Pengolahan Limbah': null,
        'Kebersihan Toilet': null,
        'Kebersihan Bak Reservoir': null,
        'Ceklist Gizi': null,
      };
    }
    const formKey = item.formName;
    if (rekapRuanganMap[key][formKey] === null) {
      rekapRuanganMap[key][formKey] = { total: 0, count: 0 };
    }
    if (rekapRuanganMap[key][formKey] !== null) {
      rekapRuanganMap[key][formKey].total += item.persentase;
      rekapRuanganMap[key][formKey].count += 1;
    }
  });
  
  const rekapRuanganArray = Object.values(rekapRuanganMap).sort((a, b) =>
    a.petugas.localeCompare(b.petugas) || a.ruangan.localeCompare(b.ruangan)
  );

  const formKeys = [
    { key: 'Ruang Bangunan' },
    { key: 'Pengolahan Limbah' },
    { key: 'Kebersihan Toilet' },
    { key: 'Kebersihan Bak Reservoir' },
    { key: 'Ceklist Gizi' },
  ];

  const getPct = (row, k) => {
    const d = row[k];
    if (!d || d.count === 0) return null;
    return Math.round(d.total / d.count);
  };

  const pctCell = (row, k, isLastRow) => {
    const pct = getPct(row, k);
    const border = isLastRow ? 'border-b-2 border-gray-300' : '';
    if (pct === null) return (
      <td key={k} className={`px-2 md:px-6 py-4 print:py-2 print:px-3 print:border print:border-black whitespace-nowrap text-center text-[10px] md:text-xs text-gray-300 print:text-black ${border}`}>—</td>
    );
    const bg = pct >= 80 ? 'bg-green-100 text-green-700' : pct >= 60 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700';
    return (
      <td key={k} className={`px-2 md:px-6 py-4 print:py-2 print:px-3 print:border print:border-black whitespace-nowrap text-center ${border}`}>
        <span className={`inline-block px-1.5 md:px-2.5 py-1 rounded-lg text-[9px] md:text-xs font-black print:bg-transparent print:text-black ${bg}`}>{pct}%</span>
      </td>
    );
  };

  // Group rows by petugas
  const groups = [];
  rekapRuanganArray.forEach(row => {
    const last = groups[groups.length - 1];
    if (last && last.petugas === row.petugas) {
      last.rows.push(row);
    } else {
      groups.push({ petugas: row.petugas, rows: [row] });
    }
  });

  return (
    <div className="overflow-x-auto rounded-2xl shadow-sm border border-gray-200">
      <table className="min-w-full divide-y divide-gray-200 bg-white print:border-collapse print:border print:border-black">
        <thead className="bg-teal-50 print:bg-transparent">
          <tr>
            <th scope="col" className="px-3 md:px-6 py-4 print:py-2 print:px-3 print:border print:border-black text-left text-[10px] sm:text-xs font-extrabold text-gray-600 print:text-black uppercase tracking-wider">Petugas</th>
            <th scope="col" className="px-3 md:px-6 py-4 print:py-2 print:px-3 print:border print:border-black text-left text-[10px] sm:text-xs font-extrabold text-teal-700 print:text-black uppercase tracking-wider">Ruangan</th>
            <th scope="col" className="px-2 md:px-6 py-4 print:py-2 print:px-3 print:border print:border-black text-center text-[10px] sm:text-xs font-extrabold text-blue-600 print:text-black uppercase tracking-wider">Ruang</th>
            <th scope="col" className="px-2 md:px-6 py-4 print:py-2 print:px-3 print:border print:border-black text-center text-[10px] sm:text-xs font-extrabold text-green-600 print:text-black uppercase tracking-wider">Limbah</th>
            <th scope="col" className="px-2 md:px-6 py-4 print:py-2 print:px-3 print:border print:border-black text-center text-[10px] sm:text-xs font-extrabold text-purple-600 print:text-black uppercase tracking-wider">Toilet</th>
            <th scope="col" className="px-2 md:px-6 py-4 print:py-2 print:px-3 print:border print:border-black text-center text-[10px] sm:text-xs font-extrabold text-yellow-600 print:text-black uppercase tracking-wider">Resrv</th>
            <th scope="col" className="px-2 md:px-6 py-4 print:py-2 print:px-3 print:border print:border-black text-center text-[10px] sm:text-xs font-extrabold text-orange-600 print:text-black uppercase tracking-wider">Gizi</th>
          </tr>
        </thead>
        <tbody className="print:divide-none">
          {groups.flatMap(group =>
            group.rows.map((row, rowIdx) => {
              const isFirst = rowIdx === 0;
              const isLast = rowIdx === group.rows.length - 1;
              const rowCount = group.rows.length;
              return (
                <tr key={`${group.petugas}-${rowIdx}`} className={`hover:bg-teal-50/40 transition-colors duration-200 print:border print:border-black text-[10px] md:text-sm ${isLast ? 'border-b-2 border-gray-300' : 'border-b border-gray-100'}`}>
                  {isFirst && (
                    <td rowSpan={rowCount} className="px-3 md:px-6 py-4 print:py-2 print:px-3 print:border print:border-black whitespace-nowrap align-middle border-b-2 border-gray-300 font-bold text-gray-800">
                      {row.petugas}
                    </td>
                  )}
                  <td className={`px-3 md:px-6 py-4 print:py-2 print:px-3 print:border print:border-black whitespace-nowrap ${isLast ? 'border-b-2 border-gray-300' : ''} font-semibold text-teal-700`}>
                    {row.ruangan}
                  </td>
                  {formKeys.map(({ key }) => pctCell(row, key, isLast))}
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
