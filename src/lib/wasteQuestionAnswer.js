const format = value => new Intl.NumberFormat('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value) || 0);
const changeText = value => value === null || value === undefined ? 'belum dapat dibandingkan karena data periode sebelumnya tidak tersedia' : `${value >= 0 ? 'meningkat' : 'menurun'} ${format(Math.abs(value))}%`;

export function buildWasteAnswer(parsed, recap) {
  const { facts, charts, analytics } = recap;
  const suffix = parsed.period.inferredYear ? ' Tahun tidak disebutkan, sehingga digunakan tahun berjalan.' : '';
  const answers = {
    remaining: `Sisa limbah pada akhir ${parsed.period.label} adalah ${format(facts.remainingKg)} kg. Nilai ini berasal dari sisa awal ${format(facts.openingBalanceKg)} kg, ditambah timbulan ${format(facts.totalGeneratedKg)} kg, kemudian dikurangi pengangkutan ${format(facts.totalTransportedKg)} kg.${suffix}`,
    generated: `Total timbulan limbah selama ${parsed.period.label} adalah ${format(facts.totalGeneratedKg)} kg, dengan rata-rata ${format(analytics.performance.averageDailyKg)} kg per hari.${suffix}`,
    transported: `Total limbah yang diangkut selama ${parsed.period.label} adalah ${format(facts.totalTransportedKg)} kg atau ${format(analytics.performance.transportedCoveragePercent)}% dari seluruh limbah yang dikelola.${suffix}`,
    average: `Rata-rata timbulan limbah selama ${parsed.period.label} adalah ${format(analytics.performance.averageDailyKg)} kg per hari.${suffix}`,
    dominant_type: analytics.dominantType ? `Jenis limbah terbanyak selama ${parsed.period.label} adalah ${analytics.dominantType.name} sebanyak ${format(analytics.dominantType.current)} kg.${suffix}` : `Belum ada data jenis limbah untuk ${parsed.period.label}.`,
    top_rooms: charts.rooms.length ? `Ruangan penghasil limbah terbesar selama ${parsed.period.label} adalah ${charts.rooms[0].name} dengan jumlah ${format(charts.rooms[0].value)} kg. Lima ruangan teratas: ${charts.rooms.slice(0, 5).map((item, index) => `${index + 1}. ${item.name} (${format(item.value)} kg)`).join('; ')}.${suffix}` : `Belum ada data limbah per ruangan untuk ${parsed.period.label}.`,
    comparison: `Dibandingkan periode sebelumnya, timbulan ${parsed.period.label} ${changeText(analytics.changes.generatedPercent)}, sedangkan pengangkutan ${changeText(analytics.changes.transportedPercent)}. Sisa limbah berubah ${format(Math.abs(analytics.changes.remainingKg))} kg (${analytics.changes.remainingKg >= 0 ? 'bertambah' : 'berkurang'}).${suffix}`,
    type_total: `${parsed.type?.label || 'Jenis limbah tersebut'} selama ${parsed.period.label} berjumlah ${format(facts[parsed.type?.key])} kg.${suffix}`,
  };
  return { text: answers[parsed.intent], parsed, period: parsed.period, facts };
}
