import { buildDirectComparison, changeText, formatDate, formatNumber as format, groupTransportDays, groupTypeDays } from '../features/waste-chat/formatters/wasteAnswerFormatters.js';
import { buildAnalysisAnswer, buildAnswerPresentation } from '../features/waste-chat/answers/answerPresentation.js';
import { buildAnomalyAnswer, buildCompletenessAnswer, buildDuplicateAnswer, buildLastTransportAnswer, buildMissingRoomsAnswer, buildTransportGapAnswer } from '../features/waste-chat/answers/dataQualityAnswers.js';
import { buildPeakMonthAnswer, buildPeakWeekAnswer } from '../features/waste-chat/answers/periodRankingAnswers.js';

const percentDifference = (current, previous) => Number(previous) ? ((Number(current) - Number(previous)) / Number(previous)) * 100 : null;
const comparisonLine = (label, previous, current) => {
  const difference = Number(current) - Number(previous);
  const percentage = percentDifference(current, previous);
  return `• ${label}: ${format(previous)} kg menjadi ${format(current)} kg, ${difference >= 0 ? 'naik' : 'turun'} ${format(Math.abs(difference))} kg${percentage === null ? '' : ` (${format(Math.abs(percentage))}%)`}.`;
};

function buildMultiMonthComparison(parsed, periodRecaps) {
  if (!parsed.comparisonPeriods || periodRecaps?.length !== parsed.comparisonPeriods.length || periodRecaps.length < 3) return null;
  const rows = parsed.comparisonPeriods.map((period, index) => ({ period, recap: periodRecaps[index] }));
  const roomKey = parsed.type?.key || 'totalKg';

  if (parsed.roomName) {
    const values = rows.map(({ period, recap }) => {
      const room = (recap.charts.roomDetails || []).find(item => item.name.localeCompare(parsed.roomName, 'id-ID', { sensitivity: 'base' }) === 0);
      return { label: period.label, value: Number(room?.[roomKey]) || 0 };
    });
    const subject = parsed.type?.label ? `${parsed.type.label} dari ${parsed.roomName}` : `timbulan limbah ${parsed.roomName}`;
    return `Perbandingan ${subject} selama 3 bulan\n\n${values.map(item => `• ${item.label}: ${format(item.value)} kg`).join('\n')}\n\nTertinggi: ${[...values].sort((a, b) => b.value - a.value)[0].label} sebanyak ${format([...values].sort((a, b) => b.value - a.value)[0].value)} kg.`;
  }

  if (parsed.type) {
    const values = rows.map(({ period, recap }) => ({ label: period.label, value: Number(recap.facts[parsed.type.key]) || 0 }));
    const highest = [...values].sort((a, b) => b.value - a.value)[0];
    return `Perbandingan ${parsed.type.label} selama 3 bulan\n\n${values.map(item => `• ${item.label}: ${format(item.value)} kg`).join('\n')}\n\nTertinggi: ${highest.label} sebanyak ${format(highest.value)} kg.`;
  }

  const highest = [...rows].sort((a, b) => b.recap.facts.totalGeneratedKg - a.recap.facts.totalGeneratedKg)[0];
  return `Perbandingan pengelolaan limbah selama 3 bulan\n\n${rows.map(({ period, recap }) => `• ${period.label}: timbulan ${format(recap.facts.totalGeneratedKg)} kg; diangkut ${format(recap.facts.totalTransportedKg)} kg; sisa akhir ${format(recap.facts.remainingKg)} kg.`).join('\n')}\n\nTimbulan tertinggi: ${highest.period.label} sebanyak ${format(highest.recap.facts.totalGeneratedKg)} kg.`;
}

function buildScopedComparison(parsed, recap, comparisonRecap) {
  const roomNames = parsed.roomNames || [];
  if (roomNames.length >= 2) {
    const details = roomNames.slice(0, 2).map(name => (recap.charts.roomDetails || []).find(item => item.name.localeCompare(name, 'id-ID', { sensitivity: 'base' }) === 0));
    const key = parsed.type?.key || 'totalKg';
    if (details.every(Boolean)) return `Perbandingan ${parsed.type?.label || 'timbulan limbah'} antarruangan selama ${parsed.period.label}\n\n• ${details[0].name}: ${format(details[0][key])} kg\n• ${details[1].name}: ${format(details[1][key])} kg\n• Selisih: ${format(Math.abs(details[0][key] - details[1][key]))} kg.`;
  }
  if (parsed.types?.length >= 2 && !parsed.comparisonPeriod) {
    const [left, right] = parsed.types;
    return `Perbandingan jenis limbah selama ${parsed.period.label}\n\n• ${left.label}: ${format(recap.facts[left.key])} kg\n• ${right.label}: ${format(recap.facts[right.key])} kg\n• Selisih: ${format(Math.abs(recap.facts[left.key] - recap.facts[right.key]))} kg.`;
  }
  if (parsed.roomName) {
    const current = (recap.charts.roomDetails || []).find(item => item.name.localeCompare(parsed.roomName, 'id-ID', { sensitivity: 'base' }) === 0);
    const previous = comparisonRecap
      ? (comparisonRecap.charts.roomDetails || []).find(item => item.name.localeCompare(parsed.roomName, 'id-ID', { sensitivity: 'base' }) === 0)
      : recap.analytics.rooms?.find(item => item.name.localeCompare(parsed.roomName, 'id-ID', { sensitivity: 'base' }) === 0);
    const key = parsed.type?.key || 'totalKg';
    const previousValue = comparisonRecap ? previous?.[key] : previous?.previous;
    const currentValue = comparisonRecap ? current?.[key] : previous?.current;
    if (current || previous) return `Perbandingan ${parsed.type?.label || 'timbulan limbah'} ${parsed.roomName}\n\n${comparisonLine(parsed.roomName, previousValue || 0, currentValue || 0)}`;
  }
  if (parsed.type) {
    const previousValue = comparisonRecap ? comparisonRecap.facts[parsed.type.key] : recap.analytics.types?.find(item => item.key === parsed.type.key)?.previous;
    const currentValue = recap.facts[parsed.type.key];
    return `Perbandingan ${parsed.type.label}\n\n${comparisonLine(parsed.type.label, previousValue || 0, currentValue || 0)}`;
  }
  if (/setiap\s+jenis|masing[ -]?masing\s+jenis|perubahan.*jenis/i.test(parsed.question) && recap.analytics.types?.length) {
    return `Perubahan setiap jenis limbah selama ${parsed.period.label}\n\n${recap.analytics.types.map(item => comparisonLine(item.name, item.previous, item.current)).join('\n')}`;
  }
  return null;
}

export function buildWasteAnswer(parsed, recap, comparisonRecap = null, periodRecaps = null) {
  const { facts, charts, analytics } = recap;
  const roomTotals = charts.roomTotals || charts.rooms;
  const timeline = charts.timeline || [];
  const transportDays = timeline.filter(item => item.transported > 0);
  const activeGeneratedDays = timeline.filter(item => item.generated > 0);
  const daysForType = parsed.type ? timeline.filter(item => Number(item[parsed.type.key]) > 0) : [];
  const roomTypeDays = parsed.roomName && parsed.type
    ? (charts.roomTypeTimeline || []).filter(item => item.roomName.toLocaleLowerCase('id-ID') === parsed.roomName.toLocaleLowerCase('id-ID') && Number(item[parsed.type.key]) > 0)
    : [];
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
    waste_summary: `Rincian data limbah ${during}\n\nKondisi akhir\n• Sisa limbah: ${format(facts.remainingKg)} kg\n\nAlur limbah\n• Sisa awal: ${format(facts.openingBalanceKg)} kg\n• Ditambah timbulan: ${format(facts.totalGeneratedKg)} kg\n• Dikurangi pengangkutan: ${format(facts.totalTransportedKg)} kg\n\nKomposisi timbulan\n${selectedTypes.map(item => `• ${item.label}: ${format(facts[item.key])} kg`).join('\n')}${roomTotals.length ? `\n\nRuangan terbesar\n• ${roomTotals[0].name}: ${format(roomTotals[0].value)} kg` : ''}${suffix}`,
    analysis: buildAnalysisAnswer(parsed, recap),
    remaining: `Sisa limbah pada akhir ${parsed.period.label}: ${format(facts.remainingKg)} kg\n\nPerhitungan\n• Sisa awal: ${format(facts.openingBalanceKg)} kg\n• Ditambah timbulan: ${format(facts.totalGeneratedKg)} kg\n• Dikurangi pengangkutan: ${format(facts.totalTransportedKg)} kg${suffix}`,
    opening_balance: `Sisa limbah pada awal ${parsed.period.label} adalah ${format(facts.openingBalanceKg)} kg.${suffix}`,
    available_total: `Total limbah yang tersedia untuk dikelola ${during}: ${format(facts.openingBalanceKg + facts.totalGeneratedKg)} kg\n\n• Sisa awal: ${format(facts.openingBalanceKg)} kg\n• Timbulan baru: ${format(facts.totalGeneratedKg)} kg${suffix}`,
    generated: `Timbulan limbah ${during}\n\n• Total: ${format(facts.totalGeneratedKg)} kg\n• Rata-rata: ${format(analytics.performance.averageDailyKg)} kg per hari${suffix}`,
    transported: `Pengangkutan limbah ${during}\n\n• Total: ${format(facts.totalTransportedKg)} kg\n• Cakupan: ${format(analytics.performance.transportedCoveragePercent)}% dari seluruh limbah yang dikelola${suffix}`,
    last_transport: buildLastTransportAnswer(parsed, recap),
    transport_gap: buildTransportGapAnswer(parsed, recap),
    transport_count: `Pengangkutan selama ${parsed.period.label} tercatat sebanyak ${recap.diagnostics?.transport?.recordCount ?? transportDays.length} kali pada ${transportDays.length} tanggal.${suffix}`,
    average_transport: (recap.diagnostics?.transport?.recordCount ?? transportDays.length) > 0
      ? `Rata-rata limbah setiap pengangkutan selama ${parsed.period.label} adalah ${format(facts.totalTransportedKg / (recap.diagnostics?.transport?.recordCount ?? transportDays.length))} kg, dihitung dari ${recap.diagnostics?.transport?.recordCount ?? transportDays.length} catatan pengangkutan.${suffix}`
      : `Belum ada pengangkutan yang tercatat selama ${parsed.period.label}, sehingga rata-rata belum dapat dihitung.${suffix}`,
    transport_dates: transportDays.length
      ? `Pengangkutan selama ${parsed.period.label}\n\nTercatat pada ${transportDays.length} tanggal • Total ${format(facts.totalTransportedKg)} kg\n\n${groupTransportDays(transportDays)}${suffix}`
      : `Belum ada pengangkutan yang tercatat selama ${parsed.period.label}.${suffix}`,
    type_dates: daysForType.length
      ? `${parsed.type.label} selama ${parsed.period.label}\n\nTercatat pada ${daysForType.length} tanggal • Total ${format(daysForType.reduce((sum, item) => sum + (Number(item[parsed.type.key]) || 0), 0))} kg\n\n${groupTypeDays(daysForType, parsed.type)}${suffix}`
      : `Belum ada ${parsed.type?.label || 'jenis limbah tersebut'} yang tercatat selama ${parsed.period.label}.${suffix}`,
    room_type_dates: roomTypeDays.length
      ? `${parsed.type.label} pada ${parsed.roomName} selama ${parsed.period.label}\n\nTercatat pada ${roomTypeDays.length} tanggal • Total ${format(roomTypeDays.reduce((sum, item) => sum + (Number(item[parsed.type.key]) || 0), 0))} kg\n\n${roomTypeDays.map(item => `• ${formatDate(item.date)}: ${format(item[parsed.type.key])} kg`).join('\n')}${suffix}`
      : `Belum ada ${parsed.type?.label || 'jenis limbah tersebut'} yang tercatat pada ${parsed.roomName} selama ${parsed.period.label}.${suffix}`,
    transport_coverage: `Sisa limbah pada akhir ${parsed.period.label}: ${format(facts.remainingKg)} kg\n\nCakupan pengangkutan: ${format(analytics.performance.transportedCoveragePercent)}%\n• Limbah diangkut: ${format(facts.totalTransportedKg)} kg\n• Limbah tersedia: ${format(facts.openingBalanceKg + facts.totalGeneratedKg)} kg${suffix}`,
    average: `Rata-rata timbulan limbah ${during} adalah ${format(analytics.performance.averageDailyKg)} kg per hari.${suffix}`,
    dominant_type: analytics.dominantType ? `Jenis limbah terbanyak ${during} adalah ${analytics.dominantType.name} sebanyak ${format(analytics.dominantType.current)} kg.${suffix}` : `Belum ada data jenis limbah untuk ${parsed.period.label}.`,
    least_type: analytics.types?.filter(item => item.current > 0).length ? (() => { const item = [...analytics.types].filter(entry => entry.current > 0).sort((a, b) => a.current - b.current)[0]; return `Jenis limbah dengan jumlah paling sedikit ${during} adalah ${item.name} sebanyak ${format(item.current)} kg.${suffix}`; })() : `Belum ada data jenis limbah untuk ${parsed.period.label}.`,
    type_breakdown: `Rincian timbulan berdasarkan jenis ${during}\n\n${selectedTypes.map(item => `• ${item.label}: ${format(facts[item.key])} kg`).join('\n')}\n\nTotal: ${format(facts.totalGeneratedKg)} kg${suffix}`,
    type_percentages: `Persentase timbulan berdasarkan jenis ${during}\n\n${selectedTypes.map(item => `• ${item.label}: ${facts.totalGeneratedKg > 0 ? format((facts[item.key] / facts.totalGeneratedKg) * 100) : 0}% (${format(facts[item.key])} kg)`).join('\n')}\n\nTotal timbulan: ${format(facts.totalGeneratedKg)} kg${suffix}`,
    top_rooms: roomTotals.length ? `Ruangan penghasil limbah terbesar ${during}\n\n${roomTotals.slice(0, 5).map((item, index) => `${index + 1}. ${item.name}: ${format(item.value)} kg`).join('\n')}\n\nTerbesar: ${roomTotals[0].name} dengan ${format(roomTotals[0].value)} kg${suffix}` : `Belum ada data limbah per ruangan untuk ${parsed.period.label}.`,
    bottom_room: roomTotals.filter(item => item.value > 0).length ? `Ruangan dengan timbulan paling sedikit ${during} adalah ${roomTotals.filter(item => item.value > 0).at(-1).name} sebanyak ${format(roomTotals.filter(item => item.value > 0).at(-1).value)} kg.${suffix}` : `Belum ada data limbah per ruangan untuk ${parsed.period.label}.`,
    type_rooms: roomsForType.length
      ? `Ruangan dengan ${parsed.type.label} ${during}\n\n${roomsForType.map((item, index) => `${index + 1}. ${item.name}: ${format(item[parsed.type.key])} kg`).join('\n')}\n\nTotal: ${format(roomsForType.reduce((sum, item) => sum + (Number(item[parsed.type.key]) || 0), 0))} kg dari ${roomsForType.length} ruangan${suffix}`
      : `Belum ada ruangan dengan ${parsed.type?.label || 'jenis limbah tersebut'} yang tercatat selama ${parsed.period.label}.${suffix}`,
    never_type_rooms: parsed.type ? (() => {
      const roomsWithType = new Set(roomsForType.map(item => item.name.toLocaleLowerCase('id-ID')));
      const roomsWithoutType = (recap.diagnostics?.officialRooms || []).filter(name => !roomsWithType.has(name.toLocaleLowerCase('id-ID')));
      return roomsWithoutType.length ? `Ruangan tanpa catatan ${parsed.type.label} selama ${parsed.period.label}\n\n${roomsWithoutType.map(name => `• ${name}`).join('\n')}\n\nTotal: ${roomsWithoutType.length} ruangan. Tidak adanya catatan belum tentu berarti data belum diinput.${suffix}` : `Seluruh ruangan aktif memiliki catatan ${parsed.type.label} selama ${parsed.period.label}.${suffix}`;
    })() : undefined,
    room_total: requestedRoom ? `Total timbulan dari ${requestedRoom.name} ${during} adalah ${format(requestedRoom.totalKg)} kg.${suffix}` : `Data untuk ruangan “${parsed.roomName}” tidak ditemukan pada ${parsed.period.label}. Periksa kembali penulisan nama ruangan.`,
    room_contribution: requestedRoom ? `Kontribusi timbulan ${requestedRoom.name} ${during} adalah ${facts.totalGeneratedKg > 0 ? format((requestedRoom.totalKg / facts.totalGeneratedKg) * 100) : 0}%\n\n• Timbulan ruangan: ${format(requestedRoom.totalKg)} kg\n• Total timbulan: ${format(facts.totalGeneratedKg)} kg${suffix}` : `Data untuk ruangan “${parsed.roomName}” tidak ditemukan pada ${parsed.period.label}. Periksa kembali penulisan nama ruangan.`,
    room_type_total: requestedRoom ? `${parsed.type?.label || 'Jenis limbah tersebut'} dari ${requestedRoom.name} ${during} berjumlah ${format(requestedRoom[parsed.type?.key])} kg.${suffix}` : `Data untuk ruangan “${parsed.roomName}” tidak ditemukan pada ${parsed.period.label}. Periksa kembali penulisan nama ruangan.`,
    peak_day: timeline.filter(item => item.generated > 0).length ? (() => { const peak = [...timeline].sort((a, b) => b.generated - a.generated)[0]; return `Timbulan tertinggi selama ${parsed.period.label} terjadi pada ${peak.date.split('-').reverse().join('/')} sebanyak ${format(peak.generated)} kg.${suffix}`; })() : `Belum ada timbulan yang tercatat selama ${parsed.period.label}.`,
    trough_day: activeGeneratedDays.length ? (() => { const trough = [...activeGeneratedDays].sort((a, b) => a.generated - b.generated)[0]; return `Timbulan tercatat paling rendah selama ${parsed.period.label} terjadi pada ${formatDate(trough.date)} sebanyak ${format(trough.generated)} kg. Tanggal tanpa input dan nilai nol tidak disertakan.${suffix}`; })() : `Belum ada timbulan yang tercatat selama ${parsed.period.label}.`,
    peak_month: buildPeakMonthAnswer(parsed, timeline),
    peak_week: buildPeakWeekAnswer(parsed, timeline),
    active_days: `Terdapat ${timeline.filter(item => item.generated > 0).length} hari dengan timbulan limbah yang tercatat selama ${parsed.period.label}.${suffix}`,
    comparison: buildMultiMonthComparison(parsed, periodRecaps) || buildScopedComparison(parsed, recap, comparisonRecap) || (comparisonRecap
      ? buildDirectComparison(parsed, recap, comparisonRecap)
      : `Perbandingan ${parsed.period.label} dengan periode sebelumnya\n\n• Sisa limbah: ${analytics.changes.remainingKg >= 0 ? 'bertambah' : 'berkurang'} ${format(Math.abs(analytics.changes.remainingKg))} kg\n• Timbulan: ${changeText(analytics.changes.generatedPercent)}\n• Pengangkutan: ${changeText(analytics.changes.transportedPercent)}${suffix}`),
    type_total: `${parsed.type?.label || 'Jenis limbah tersebut'} ${during} berjumlah ${format(facts[parsed.type?.key])} kg.${suffix}`,
    data_completeness: buildCompletenessAnswer(parsed, recap.diagnostics),
    missing_rooms: buildMissingRoomsAnswer(parsed, recap.diagnostics),
    duplicate_data: buildDuplicateAnswer(parsed, recap.diagnostics),
    data_anomalies: buildAnomalyAnswer(parsed, recap),
  };
  return { text: answers[parsed.intent], parsed, period: parsed.period, context: { period: parsed.period, intent: parsed.intent, roomName: parsed.roomName, type: parsed.type }, facts, ...buildAnswerPresentation(parsed, recap, comparisonRecap, periodRecaps) };
}
