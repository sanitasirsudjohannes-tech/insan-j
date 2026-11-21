import { formatNumber as format } from '../formatters/wasteAnswerFormatters.js';
import { buildQuestionUnderstanding, buildSourceLink } from '../presentation/questionPresentation.js';

const BALANCE_WARNING_INTENTS = new Set([
  'waste_summary', 'analysis', 'remaining', 'opening_balance', 'available_total',
  'comparison', 'transport_coverage', 'transported', 'data_anomalies',
]);

const monthlyTimeline = timeline => {
  const months = new Map();
  timeline.forEach(item => {
    const key = item.date.slice(0, 7);
    const current = months.get(key) || { label: key, value: 0 };
    current.value += Number(item.generated) || 0;
    months.set(key, current);
  });
  return Array.from(months.values()).slice(-12);
};

export function buildAnalysisAnswer(parsed, recap) {
  const { facts, analytics, charts } = recap;
  const active = (charts.timeline || []).filter(item => item.generated > 0);
  const peak = [...active].sort((left, right) => right.generated - left.generated)[0];
  const notes = [
    `• Sisa akhir: ${format(facts.remainingKg)} kg${facts.remainingKg > facts.openingBalanceKg ? ', meningkat dari sisa awal.' : ', tidak meningkat dari sisa awal.'}`,
    `• Timbulan: ${format(facts.totalGeneratedKg)} kg; pengangkutan: ${format(facts.totalTransportedKg)} kg.`,
    `• Cakupan pengangkutan: ${format(analytics.performance.transportedCoveragePercent)}%.`,
  ];
  if (analytics.dominantType) notes.push(`• Jenis dominan: ${analytics.dominantType.name} (${format(analytics.dominantType.current)} kg).`);
  if (peak) notes.push(`• Timbulan harian tertinggi: ${peak.date.split('-').reverse().join('/')} (${format(peak.generated)} kg).`);
  return `Analisis data limbah selama ${parsed.period.label}\n\n${notes.join('\n')}`;
}

export function buildAnswerPresentation(parsed, recap, comparisonRecap, periodRecaps = null) {
  const { facts, charts, analytics } = recap;
  const available = facts.openingBalanceKg + facts.totalGeneratedKg;
  const noRecordedWaste = !Number(facts.openingBalanceKg) && !Number(facts.totalGeneratedKg) && !Number(facts.totalTransportedKg) && !Number(facts.remainingKg);
  const warnings = [];
  const showBalanceWarnings = BALANCE_WARNING_INTENTS.has(parsed.intent);
  if (showBalanceWarnings && Math.abs(available - facts.totalTransportedKg - facts.remainingKg) > 0.005) warnings.push('Komponen perhitungan sisa belum cocok. Muat ulang data dan periksa catatan sumber sebelum menggunakan angka ini.');
  if (showBalanceWarnings && facts.remainingKg < 0) warnings.push('Sisa akhir bernilai negatif. Periksa kembali data timbulan dan pengangkutan.');
  if (showBalanceWarnings && facts.totalTransportedKg > available) warnings.push('Pengangkutan lebih besar daripada limbah yang tersedia pada perhitungan periode ini.');
  if (showBalanceWarnings && !noRecordedWaste && !facts.totalGeneratedKg && !facts.totalTransportedKg) warnings.push('Belum ada timbulan maupun pengangkutan pada periode ini.');

  const scopedComparison = parsed.intent === 'comparison' && (parsed.roomName || parsed.type);
  const comparisonAmount = value => parsed.roomName
    ? Number((value.charts.roomDetails || []).find(row => row.name.toLocaleLowerCase('id-ID') === parsed.roomName.toLocaleLowerCase('id-ID'))?.[parsed.type?.key || 'totalKg']) || 0
    : Number(value.facts[parsed.type?.key || 'totalGeneratedKg']) || 0;
  const cards = !noRecordedWaste && !scopedComparison && ['waste_summary', 'analysis', 'remaining', 'comparison', 'transport_coverage'].includes(parsed.intent) ? [
    { label: 'Sisa Akhir', value: `${format(facts.remainingKg)} kg`, tone: facts.remainingKg < 0 ? 'red' : 'emerald' },
    { label: 'Timbulan', value: `${format(facts.totalGeneratedKg)} kg`, tone: 'blue' },
    { label: 'Diangkut', value: `${format(facts.totalTransportedKg)} kg`, tone: 'orange' },
  ] : [];

  let visualization = null;
  if (parsed.intent === 'type_breakdown' || parsed.intent === 'dominant_type') visualization = { title: 'Komposisi jenis', items: (charts.composition || []).map(item => ({ label: item.name, value: item.value })) };
  else if (['top_rooms', 'type_rooms'].includes(parsed.intent)) visualization = { title: 'Ruangan teratas', items: (charts.roomTotals || charts.rooms || []).slice(0, 5).map(item => ({ label: item.name, value: item.value })) };
  else if (parsed.intent === 'comparison' && periodRecaps?.length >= 2) visualization = {
    title: 'Perbandingan timbulan',
    items: parsed.comparisonPeriods.map((period, index) => ({ label: period.label, value: comparisonAmount(periodRecaps[index]) })),
  };
  else if (parsed.intent === 'comparison' && comparisonRecap) visualization = { title: `Perbandingan ${parsed.type?.label || 'timbulan'}${parsed.roomName ? ` — ${parsed.roomName}` : ''}`, items: [{ label: parsed.comparisonPeriod.label, value: comparisonAmount(comparisonRecap) }, { label: parsed.period.label, value: comparisonAmount(recap) }] };
  else if (['analysis', 'generated'].includes(parsed.intent)) visualization = { title: 'Tren timbulan', items: monthlyTimeline(charts.timeline || []) };

  const period = parsed.period.label;
  let followUps;
  if (parsed.intent === 'room_input_count') {
    const selected = new Date(`${parsed.period.start}T00:00:00Z`);
    const previous = new Date(selected.getTime() - 86400000).toISOString().slice(0, 10);
    followUps = [
      { label: 'Bandingkan sehari sebelumnya', question: `Bandingkan jumlah ruangan tanggal ${previous} dan ${parsed.period.start}` },
      { label: 'Ruangan belum input', question: `Ruangan mana yang belum input tanggal ${parsed.period.start}` },
      { label: 'Periksa data ganda', question: `Apakah ada data ganda tanggal ${parsed.period.start}` },
    ];
  } else if (parsed.intent === 'room_input_comparison') {
    followUps = [
      { label: 'Ruangan belum input', question: `Ruangan mana yang belum input tanggal ${parsed.period.start}` },
      { label: 'Periksa data ganda', question: `Apakah ada data ganda tanggal ${parsed.period.start}` },
      { label: 'Rincian jenis', question: `Rincian limbah berdasarkan jenis tanggal ${parsed.period.start}` },
    ];
  } else {
    followUps = [
      { label: 'Rincian jenis', question: `Rincian limbah berdasarkan jenis ${period}` },
      { label: 'Ruangan terbesar', question: `Ruangan dengan timbulan terbesar ${period}` },
      { label: 'Bandingkan sebelumnya', question: `Bandingkan limbah ${period} dengan sebelumnya` },
    ];
    if (parsed.type) followUps.unshift({ label: 'Lihat per ruangan', question: `Ruangan yang ada ${parsed.type.label} ${period}` });
    if (parsed.roomName && parsed.type) followUps.unshift({ label: 'Rincian tanggal', question: `Tanggal berapa ${parsed.type.label} pada ruangan ${parsed.roomName} ${period}` });
    if (['generated', 'comparison'].includes(parsed.intent)) followUps.unshift({ label: 'Telusuri selisih timbulan', question: 'Jelaskan selisih timbulan' });
  }

  const diagnostics = recap.diagnostics || {};
  const relevantFollowUps = [];
  if (diagnostics.duplicateRoomDates?.length) relevantFollowUps.push({ label: 'Periksa catatan ganda', question: `Apakah ada data ganda ${period}` });
  if (diagnostics.missingOfficers?.length) relevantFollowUps.push({ label: 'Petugas belum tercatat', question: `Apakah ada catatan tanpa nama petugas ${period}` });
  if (diagnostics.missingRoomDays?.length) relevantFollowUps.push({ label: 'Ruangan belum tercatat', question: `Ruangan mana yang belum input ${period}` });
  if (diagnostics.negativeRows?.length) relevantFollowUps.push({ label: 'Lihat nilai negatif', question: `Apakah ada nilai limbah negatif ${period}` });
  followUps = [...relevantFollowUps, ...followUps].filter((item, index, list) => list.findIndex(other => other.question === item.question) === index);

  const favoriteSubjects = {
    generated: 'Berapa timbulan limbah', remaining: 'Berapa sisa limbah',
    room_total: `Berapa timbulan ruangan ${parsed.roomName}`,
    room_type_total: `Berapa ${parsed.type?.label} ruangan ${parsed.roomName}`,
    room_input_count: 'Berapa ruangan yang input', data_anomalies: 'Apa data yang perlu diperiksa',
    daily_review: 'Ringkasan pemeriksaan harian', transported: 'Berapa berat limbah diangkut',
  };
  const relativePeriod = parsed.question.match(/\b(hari ini|bulan ini|tahun ini|kemarin)\b/i)?.[0];
  const favoriteQuestion = favoriteSubjects[parsed.intent] ? `${favoriteSubjects[parsed.intent]} ${relativePeriod || period}` : null;
  const comparedPeriods = parsed.comparisonPeriods?.length >= 2
    ? parsed.comparisonPeriods
    : [parsed.comparisonPeriod, parsed.period].filter(Boolean);
  const sourceLinks = parsed.comparisonPeriod || parsed.comparisonPeriods?.length >= 2
    ? comparedPeriods.map(sourcePeriod => ({
      ...buildSourceLink({ ...parsed, period: sourcePeriod, comparisonPeriod: null, comparisonPeriods: null }),
      label: `Buka data ${sourcePeriod.label}`,
    }))
    : [];

  return {
    favoriteQuestion,
    sourceLinks,
    cards,
    visualization,
    warnings,
    followUps: followUps.slice(0, 4),
    source: `Sumber: data server INSAN-J, periode ${parsed.period.start} sampai ${parsed.period.end}.`,
    understanding: buildQuestionUnderstanding(parsed),
    sourceLink: sourceLinks.length ? null : buildSourceLink(parsed),
    reportPayload: { period: { start: parsed.period.start, end: parsed.period.end }, facts, analytics, chartData: { balanceFlow: charts.balanceFlow, timeline: charts.timeline, rooms: charts.rooms, composition: charts.composition } },
  };
}
