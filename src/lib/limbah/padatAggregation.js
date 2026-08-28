/** Akumulasi harian; referensi input manual dipertahankan untuk edit/hapus. */
export const accumulatePadatRows = (allPadat, allRuangan) => {
  const dateMap = new Map();
  allRuangan.forEach(item => {
    const tgl = item.tanggal;
    if (!tgl) return;
    if (!dateMap.has(tgl)) dateMap.set(tgl, {
      id: `agg_${tgl}`,
      tanggal: tgl,
      infeksius: 0,
      jarum_suntik: 0,
      botol_obat: 0,
      sitotoksik: 0,
      ruanganCount: 0,
      ruanganNames: new Set(),
      padatIds: [],
      manualRecords: [],
      isOffline: false,
      isRoomAccumulation: true,
      isManual: false
    });
    const e = dateMap.get(tgl);
    e.infeksius += parseFloat(item.infeksius || 0);
    e.jarum_suntik += parseFloat(item.jarum_suntik || 0);
    e.botol_obat += parseFloat(item.botol_obat || 0);
    e.sitotoksik += parseFloat(item.sitotoksik || 0);
    e.ruanganCount += 1;
    if (item.ruangan) e.ruanganNames.add(item.ruangan);
    if (item.isOffline) e.isOffline = true;
  });
  allPadat.forEach(item => {
    const tgl = item.tanggal;
    if (!tgl) return;
    if (!dateMap.has(tgl)) dateMap.set(tgl, {
      id: item.id || `padat_${tgl}`,
      tanggal: tgl,
      infeksius: 0,
      jarum_suntik: 0,
      botol_obat: 0,
      sitotoksik: 0,
      ruanganCount: 0,
      ruanganNames: new Set(),
      padatIds: [],
      manualRecords: [],
      isOffline: false,
      isManual: true
    });
    const e = dateMap.get(tgl);
    e.infeksius += parseFloat(item.infeksius || 0);
    e.jarum_suntik += parseFloat(item.jarum_suntik || 0);
    e.botol_obat += parseFloat(item.botol_obat || 0);
    e.sitotoksik += parseFloat(item.sitotoksik || 0);
    e.isManual = true;
    if (item.id && !e.padatIds.includes(item.id)) e.padatIds.push(item.id);
    e.manualRecords.push(item);
    if (item.isOffline) e.isOffline = true;
  });
  return Array.from(dateMap.values());
};
