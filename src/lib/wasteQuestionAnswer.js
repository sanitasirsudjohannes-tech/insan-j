const format = value => new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(Math.round(Number(value) || 0));
const changeText = value => value === null || value === undefined ? 'belum dapat dibandingkan karena data periode sebelumnya tidak tersedia' : `${value >= 0 ? 'meningkat' : 'menurun'} ${format(Math.abs(value))}%`;
const percentChange = (current, previous) => Number(previous) ? ((Number(current) - Number(previous)) / Number(previous)) * 100 : null;
const directComparison = (parsed, current, previous) => {
  const currentFacts = current.facts;
  const previousFacts = previous.facts;
  const generatedChange = currentFacts.totalGeneratedKg - previousFacts.totalGeneratedKg;
  const transportedChange = currentFacts.totalTransportedKg - previousFacts.totalTransportedKg;
  const remainingChange = currentFacts.remainingKg - previousFacts.remainingKg;
  const describe = (value, percentage) => `${value >= 0 ? 'naik' : 'turun'} ${format(Math.abs(value))} kg${percentage === null ? '' : ` (${format(Math.abs(percentage))}%)`}`;
  const suffix = parsed.period.inferredYear && parsed.comparisonPeriod.inferredYear ? ' Tahun tidak disebutkan, sehingga digunakan tahun berjalan.' : '';
  return `Perbandingan ${parsed.comparisonPeriod.label} dan ${parsed.period.label}: timbulan ${format(previousFacts.totalGeneratedKg)} kg menjadi ${format(currentFacts.totalGeneratedKg)} kg, ${describe(generatedChange, percentChange(currentFacts.totalGeneratedKg, previousFacts.totalGeneratedKg))}; pengangkutan ${format(previousFacts.totalTransportedKg)} kg menjadi ${format(currentFacts.totalTransportedKg)} kg, ${describe(transportedChange, percentChange(currentFacts.totalTransportedKg, previousFacts.totalTransportedKg))}; dan sisa akhir ${format(previousFacts.remainingKg)} kg menjadi ${format(currentFacts.remainingKg)} kg, ${describe(remainingChange, percentChange(currentFacts.remainingKg, previousFacts.remainingKg))}.${suffix}`;
};

export function buildWasteAnswer(parsed, recap, comparisonRecap = null) {
  const { facts, charts, analytics } = recap;
  const roomTotals = charts.roomTotals || charts.rooms;
  const timeline = charts.timeline || [];
  const requestedRoom = (charts.roomDetails || []).find(item => item.name.toLocaleLowerCase('id-ID') === parsed.roomName?.toLocaleLowerCase('id-ID'));
  const suffix = parsed.period.inferredYear ? ' Tahun tidak disebutkan, sehingga digunakan tahun berjalan.' : '';
  const during = parsed.period.scope === 'day' ? `pada ${parsed.period.label}` : `selama ${parsed.period.label}`;
  const selectedTypes = parsed.types?.length ? parsed.types : [
    { key: 'infectiousKg', label: 'limbah infeksius' },
    { key: 'sharpsKg', label: 'limbah jarum suntik' },
    { key: 'bottleKg', label: 'limbah botol obat' },
    { key: 'cytotoxicKg', label: 'limbah sitotoksik' },
  ];
  const answers = {
    waste_summary: `Rincian data limbah ${during}: sisa awal ${format(facts.openingBalanceKg)} kg; timbulan ${format(facts.totalGeneratedKg)} kg; diangkut ${format(facts.totalTransportedKg)} kg; dan sisa akhir ${format(facts.remainingKg)} kg. Komposisi timbulan terdiri dari limbah infeksius ${format(facts.infectiousKg)} kg, limbah jarum suntik ${format(facts.sharpsKg)} kg, limbah botol obat ${format(facts.bottleKg)} kg, serta limbah sitotoksik ${format(facts.cytotoxicKg)} kg.${roomTotals.length ? ` Ruangan dengan timbulan terbesar adalah ${roomTotals[0].name} sebanyak ${format(roomTotals[0].value)} kg.` : ''}${suffix}`,
    remaining: `Sisa limbah pada akhir ${parsed.period.label} adalah ${format(facts.remainingKg)} kg. Nilai ini berasal dari sisa awal ${format(facts.openingBalanceKg)} kg, ditambah timbulan ${format(facts.totalGeneratedKg)} kg, kemudian dikurangi pengangkutan ${format(facts.totalTransportedKg)} kg.${suffix}`,
    opening_balance: `Sisa limbah pada awal ${parsed.period.label} adalah ${format(facts.openingBalanceKg)} kg.${suffix}`,
    available_total: `Total limbah yang tersedia untuk dikelola ${during} adalah ${format(facts.openingBalanceKg + facts.totalGeneratedKg)} kg, terdiri dari sisa awal ${format(facts.openingBalanceKg)} kg dan timbulan baru ${format(facts.totalGeneratedKg)} kg.${suffix}`,
    generated: `Total timbulan limbah ${during} adalah ${format(facts.totalGeneratedKg)} kg, dengan rata-rata ${format(analytics.performance.averageDailyKg)} kg per hari.${suffix}`,
    transported: `Total limbah yang diangkut ${during} adalah ${format(facts.totalTransportedKg)} kg atau ${format(analytics.performance.transportedCoveragePercent)}% dari seluruh limbah yang dikelola.${suffix}`,
    transport_coverage: `Cakupan pengangkutan ${during} adalah ${format(analytics.performance.transportedCoveragePercent)}%. Sebanyak ${format(facts.totalTransportedKg)} kg telah diangkut dari ${format(facts.openingBalanceKg + facts.totalGeneratedKg)} kg limbah yang tersedia.${suffix}`,
    average: `Rata-rata timbulan limbah ${during} adalah ${format(analytics.performance.averageDailyKg)} kg per hari.${suffix}`,
    dominant_type: analytics.dominantType ? `Jenis limbah terbanyak ${during} adalah ${analytics.dominantType.name} sebanyak ${format(analytics.dominantType.current)} kg.${suffix}` : `Belum ada data jenis limbah untuk ${parsed.period.label}.`,
    type_breakdown: `Rincian timbulan berdasarkan jenis ${during}: ${selectedTypes.map(item => `${item.label} ${format(facts[item.key])} kg`).join('; ')}. Totalnya ${format(facts.totalGeneratedKg)} kg.${suffix}`,
    top_rooms: roomTotals.length ? `Ruangan penghasil limbah terbesar ${during} adalah ${roomTotals[0].name} dengan jumlah ${format(roomTotals[0].value)} kg. Lima ruangan teratas: ${roomTotals.slice(0, 5).map((item, index) => `${index + 1}. ${item.name} (${format(item.value)} kg)`).join('; ')}.${suffix}` : `Belum ada data limbah per ruangan untuk ${parsed.period.label}.`,
    bottom_room: roomTotals.filter(item => item.value > 0).length ? `Ruangan dengan timbulan paling sedikit ${during} adalah ${roomTotals.filter(item => item.value > 0).at(-1).name} sebanyak ${format(roomTotals.filter(item => item.value > 0).at(-1).value)} kg.${suffix}` : `Belum ada data limbah per ruangan untuk ${parsed.period.label}.`,
    room_total: requestedRoom ? `Total timbulan dari ${requestedRoom.name} ${during} adalah ${format(requestedRoom.totalKg)} kg.${suffix}` : `Data untuk ruangan “${parsed.roomName}” tidak ditemukan pada ${parsed.period.label}. Periksa kembali penulisan nama ruangan.`,
    room_type_total: requestedRoom ? `${parsed.type?.label || 'Jenis limbah tersebut'} dari ${requestedRoom.name} ${during} berjumlah ${format(requestedRoom[parsed.type?.key])} kg.${suffix}` : `Data untuk ruangan “${parsed.roomName}” tidak ditemukan pada ${parsed.period.label}. Periksa kembali penulisan nama ruangan.`,
    peak_day: timeline.filter(item => item.generated > 0).length ? (() => { const peak = [...timeline].sort((a, b) => b.generated - a.generated)[0]; return `Timbulan tertinggi selama ${parsed.period.label} terjadi pada ${peak.date.split('-').reverse().join('/')} sebanyak ${format(peak.generated)} kg.${suffix}`; })() : `Belum ada timbulan yang tercatat selama ${parsed.period.label}.`,
    active_days: `Terdapat ${timeline.filter(item => item.generated > 0).length} hari dengan timbulan limbah yang tercatat selama ${parsed.period.label}.${suffix}`,
    comparison: comparisonRecap
      ? directComparison(parsed, recap, comparisonRecap)
      : `Dibandingkan periode sebelumnya, timbulan ${parsed.period.label} ${changeText(analytics.changes.generatedPercent)}, sedangkan pengangkutan ${changeText(analytics.changes.transportedPercent)}. Sisa limbah berubah ${format(Math.abs(analytics.changes.remainingKg))} kg (${analytics.changes.remainingKg >= 0 ? 'bertambah' : 'berkurang'}).${suffix}`,
    type_total: `${parsed.type?.label || 'Jenis limbah tersebut'} ${during} berjumlah ${format(facts[parsed.type?.key])} kg.${suffix}`,
  };
  return { text: answers[parsed.intent], parsed, period: parsed.period, facts };
}
