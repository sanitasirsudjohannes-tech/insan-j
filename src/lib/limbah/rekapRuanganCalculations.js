const WASTE_FIELDS = ['infeksius', 'jarum_suntik', 'botol_obat', 'sitotoksik'];

export function calculateRuanganSummary(rows = []) {
  const roomMap = new Map();

  rows.forEach(row => {
    const roomName = String(row.ruangan || '').trim() || 'Tanpa Nama Ruangan';
    const roomKey = roomName.toLocaleLowerCase('id-ID');
    if (!roomMap.has(roomKey)) {
      roomMap.set(roomKey, {
        ruangan: roomName,
        infeksius: 0,
        jarum_suntik: 0,
        botol_obat: 0,
        sitotoksik: 0,
        total: 0,
        jumlahEntri: 0,
        tanggalTercatat: new Set()
      });
    }

    const summary = roomMap.get(roomKey);
    WASTE_FIELDS.forEach(field => {
      const value = Number(row[field]) || 0;
      summary[field] += value;
      summary.total += value;
    });
    summary.jumlahEntri += 1;
    if (row.tanggal) summary.tanggalTercatat.add(String(row.tanggal).slice(0, 10));
  });

  return Array.from(roomMap.values()).map(({ tanggalTercatat, ...summary }) => ({
    ...summary,
    hariTercatat: tanggalTercatat.size
  }));
}

export function calculateRuanganTotals(rows = []) {
  return rows.reduce((totals, row) => {
    WASTE_FIELDS.forEach(field => {
      totals[field] += Number(row[field]) || 0;
    });
    totals.total += Number(row.total) || 0;
    return totals;
  }, { infeksius: 0, jarum_suntik: 0, botol_obat: 0, sitotoksik: 0, total: 0 });
}
