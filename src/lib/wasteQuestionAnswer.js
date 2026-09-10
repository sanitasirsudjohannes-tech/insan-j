import { buildDirectComparison, changeText, formatDate, formatNumber as format, groupTransportDays, groupTypeDays } from '../features/waste-chat/formatters/wasteAnswerFormatters.js';

export function buildWasteAnswer(parsed, recap, comparisonRecap = null) {
  const { facts, charts, analytics } = recap;
  const roomTotals = charts.roomTotals || charts.rooms;
  const timeline = charts.timeline || [];
  const transportDays = timeline.filter(item => item.transported > 0);
  const daysForType = parsed.type ? timeline.filter(item => Number(item[parsed.type.key]) > 0) : [];
  const roomsForType = parsed.type
    ? (charts.roomDetails || []).filter(item => Number(item[parsed.type.key]) > 0).sort((left, right) => right[parsed.type.key] - left[parsed.type.key])
    : [];
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
    waste_summary: `Rincian data limbah ${during}\n\nAlur limbah\n• Sisa awal: ${format(facts.openingBalanceKg)} kg\n• Timbulan: ${format(facts.totalGeneratedKg)} kg\n• Diangkut: ${format(facts.totalTransportedKg)} kg\n• Sisa akhir: ${format(facts.remainingKg)} kg\n\nKomposisi timbulan\n${selectedTypes.map(item => `• ${item.label}: ${format(facts[item.key])} kg`).join('\n')}${roomTotals.length ? `\n\nRuangan terbesar\n• ${roomTotals[0].name}: ${format(roomTotals[0].value)} kg` : ''}${suffix}`,
    remaining: `Sisa limbah pada akhir ${parsed.period.label}: ${format(facts.remainingKg)} kg\n\nPerhitungan\n• Sisa awal: ${format(facts.openingBalanceKg)} kg\n• Ditambah timbulan: ${format(facts.totalGeneratedKg)} kg\n• Dikurangi pengangkutan: ${format(facts.totalTransportedKg)} kg${suffix}`,
    opening_balance: `Sisa limbah pada awal ${parsed.period.label} adalah ${format(facts.openingBalanceKg)} kg.${suffix}`,
    available_total: `Total limbah yang tersedia untuk dikelola ${during}: ${format(facts.openingBalanceKg + facts.totalGeneratedKg)} kg\n\n• Sisa awal: ${format(facts.openingBalanceKg)} kg\n• Timbulan baru: ${format(facts.totalGeneratedKg)} kg${suffix}`,
    generated: `Timbulan limbah ${during}\n\n• Total: ${format(facts.totalGeneratedKg)} kg\n• Rata-rata: ${format(analytics.performance.averageDailyKg)} kg per hari${suffix}`,
    transported: `Pengangkutan limbah ${during}\n\n• Total: ${format(facts.totalTransportedKg)} kg\n• Cakupan: ${format(analytics.performance.transportedCoveragePercent)}% dari seluruh limbah yang dikelola${suffix}`,
    transport_dates: transportDays.length
      ? `Pengangkutan selama ${parsed.period.label}\n\nTercatat pada ${transportDays.length} tanggal • Total ${format(facts.totalTransportedKg)} kg\n\n${groupTransportDays(transportDays)}${suffix}`
      : `Belum ada pengangkutan yang tercatat selama ${parsed.period.label}.${suffix}`,
    type_dates: daysForType.length
      ? `${parsed.type.label} selama ${parsed.period.label}\n\nTercatat pada ${daysForType.length} tanggal • Total ${format(daysForType.reduce((sum, item) => sum + (Number(item[parsed.type.key]) || 0), 0))} kg\n\n${groupTypeDays(daysForType, parsed.type)}${suffix}`
      : `Belum ada ${parsed.type?.label || 'jenis limbah tersebut'} yang tercatat selama ${parsed.period.label}.${suffix}`,
    transport_coverage: `Cakupan pengangkutan ${during}: ${format(analytics.performance.transportedCoveragePercent)}%\n\n• Limbah diangkut: ${format(facts.totalTransportedKg)} kg\n• Limbah tersedia: ${format(facts.openingBalanceKg + facts.totalGeneratedKg)} kg${suffix}`,
    average: `Rata-rata timbulan limbah ${during} adalah ${format(analytics.performance.averageDailyKg)} kg per hari.${suffix}`,
    dominant_type: analytics.dominantType ? `Jenis limbah terbanyak ${during} adalah ${analytics.dominantType.name} sebanyak ${format(analytics.dominantType.current)} kg.${suffix}` : `Belum ada data jenis limbah untuk ${parsed.period.label}.`,
    type_breakdown: `Rincian timbulan berdasarkan jenis ${during}\n\n${selectedTypes.map(item => `• ${item.label}: ${format(facts[item.key])} kg`).join('\n')}\n\nTotal: ${format(facts.totalGeneratedKg)} kg${suffix}`,
    top_rooms: roomTotals.length ? `Ruangan penghasil limbah terbesar ${during}\n\n${roomTotals.slice(0, 5).map((item, index) => `${index + 1}. ${item.name}: ${format(item.value)} kg`).join('\n')}\n\nTerbesar: ${roomTotals[0].name} dengan ${format(roomTotals[0].value)} kg${suffix}` : `Belum ada data limbah per ruangan untuk ${parsed.period.label}.`,
    bottom_room: roomTotals.filter(item => item.value > 0).length ? `Ruangan dengan timbulan paling sedikit ${during} adalah ${roomTotals.filter(item => item.value > 0).at(-1).name} sebanyak ${format(roomTotals.filter(item => item.value > 0).at(-1).value)} kg.${suffix}` : `Belum ada data limbah per ruangan untuk ${parsed.period.label}.`,
    type_rooms: roomsForType.length
      ? `Ruangan dengan ${parsed.type.label} ${during}\n\n${roomsForType.map((item, index) => `${index + 1}. ${item.name}: ${format(item[parsed.type.key])} kg`).join('\n')}\n\nTotal: ${format(roomsForType.reduce((sum, item) => sum + (Number(item[parsed.type.key]) || 0), 0))} kg dari ${roomsForType.length} ruangan${suffix}`
      : `Belum ada ruangan dengan ${parsed.type?.label || 'jenis limbah tersebut'} yang tercatat selama ${parsed.period.label}.${suffix}`,
    room_total: requestedRoom ? `Total timbulan dari ${requestedRoom.name} ${during} adalah ${format(requestedRoom.totalKg)} kg.${suffix}` : `Data untuk ruangan “${parsed.roomName}” tidak ditemukan pada ${parsed.period.label}. Periksa kembali penulisan nama ruangan.`,
    room_type_total: requestedRoom ? `${parsed.type?.label || 'Jenis limbah tersebut'} dari ${requestedRoom.name} ${during} berjumlah ${format(requestedRoom[parsed.type?.key])} kg.${suffix}` : `Data untuk ruangan “${parsed.roomName}” tidak ditemukan pada ${parsed.period.label}. Periksa kembali penulisan nama ruangan.`,
    peak_day: timeline.filter(item => item.generated > 0).length ? (() => { const peak = [...timeline].sort((a, b) => b.generated - a.generated)[0]; return `Timbulan tertinggi selama ${parsed.period.label} terjadi pada ${peak.date.split('-').reverse().join('/')} sebanyak ${format(peak.generated)} kg.${suffix}`; })() : `Belum ada timbulan yang tercatat selama ${parsed.period.label}.`,
    active_days: `Terdapat ${timeline.filter(item => item.generated > 0).length} hari dengan timbulan limbah yang tercatat selama ${parsed.period.label}.${suffix}`,
    comparison: comparisonRecap
      ? buildDirectComparison(parsed, recap, comparisonRecap)
      : `Perbandingan ${parsed.period.label} dengan periode sebelumnya\n\n• Timbulan: ${changeText(analytics.changes.generatedPercent)}\n• Pengangkutan: ${changeText(analytics.changes.transportedPercent)}\n• Sisa limbah: ${analytics.changes.remainingKg >= 0 ? 'bertambah' : 'berkurang'} ${format(Math.abs(analytics.changes.remainingKg))} kg${suffix}`,
    type_total: `${parsed.type?.label || 'Jenis limbah tersebut'} ${during} berjumlah ${format(facts[parsed.type?.key])} kg.${suffix}`,
  };
  return { text: answers[parsed.intent], parsed, period: parsed.period, facts };
}
