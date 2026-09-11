import { formatNumber as format } from '../formatters/wasteAnswerFormatters.js';
import { buildQuestionUnderstanding, buildSourceLink } from '../presentation/questionPresentation.js';

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
  if (facts.remainingKg < 0) warnings.push('Sisa akhir bernilai negatif. Periksa kembali data timbulan dan pengangkutan.');
  if (facts.totalTransportedKg > available) warnings.push('Pengangkutan lebih besar daripada limbah yang tersedia pada perhitungan periode ini.');
  if (!noRecordedWaste && !facts.totalGeneratedKg && !facts.totalTransportedKg) warnings.push('Belum ada timbulan maupun pengangkutan pada periode ini.');

  const cards = !noRecordedWaste && ['waste_summary', 'analysis', 'remaining', 'comparison', 'transport_coverage'].includes(parsed.intent) ? [
    { label: 'Sisa Akhir', value: `${format(facts.remainingKg)} kg`, tone: facts.remainingKg < 0 ? 'red' : 'emerald' },
    { label: 'Timbulan', value: `${format(facts.totalGeneratedKg)} kg`, tone: 'blue' },
    { label: 'Diangkut', value: `${format(facts.totalTransportedKg)} kg`, tone: 'orange' },
  ] : [];

  let visualization = null;
  if (parsed.intent === 'type_breakdown' || parsed.intent === 'dominant_type') visualization = { title: 'Komposisi jenis', items: (charts.composition || []).map(item => ({ label: item.name, value: item.value })) };
  else if (['top_rooms', 'type_rooms'].includes(parsed.intent)) visualization = { title: 'Ruangan teratas', items: (charts.roomTotals || charts.rooms || []).slice(0, 5).map(item => ({ label: item.name, value: item.value })) };
  else if (parsed.intent === 'comparison' && periodRecaps?.length >= 2) visualization = {
    title: 'Perbandingan timbulan',
    items: parsed.comparisonPeriods.map((period, index) => ({ label: period.label, value: periodRecaps[index].facts.totalGeneratedKg })),
  };
  else if (parsed.intent === 'comparison' && comparisonRecap) visualization = { title: 'Perbandingan timbulan', items: [{ label: parsed.comparisonPeriod.label, value: comparisonRecap.facts.totalGeneratedKg }, { label: parsed.period.label, value: facts.totalGeneratedKg }] };
  else if (['analysis', 'generated'].includes(parsed.intent)) visualization = { title: 'Tren timbulan', items: monthlyTimeline(charts.timeline || []) };

  const period = parsed.period.label;
  const followUps = [
    { label: 'Rincian jenis', question: `Rincian limbah berdasarkan jenis ${period}` },
    { label: 'Ruangan terbesar', question: `Ruangan dengan timbulan terbesar ${period}` },
    { label: 'Bandingkan sebelumnya', question: `Bandingkan limbah ${period} dengan sebelumnya` },
  ];
  if (parsed.type) followUps.unshift({ label: 'Lihat per ruangan', question: `Ruangan yang ada ${parsed.type.label} ${period}` });
  if (parsed.roomName && parsed.type) followUps.unshift({ label: 'Rincian tanggal', question: `Tanggal berapa ${parsed.type.label} pada ruangan ${parsed.roomName} ${period}` });

  return {
    cards,
    visualization,
    warnings,
    followUps: followUps.slice(0, 4),
    source: `Sumber: data server INSAN-J, periode ${parsed.period.start} sampai ${parsed.period.end}.`,
    understanding: buildQuestionUnderstanding(parsed),
    sourceLink: buildSourceLink(parsed),
    reportPayload: { period: { start: parsed.period.start, end: parsed.period.end }, facts, analytics, chartData: { balanceFlow: charts.balanceFlow, timeline: charts.timeline, rooms: charts.rooms, composition: charts.composition } },
  };
}
