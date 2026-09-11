import { formatNumber as format } from '../formatters/wasteAnswerFormatters.js';

const monthLabel = key => new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${key}-01T00:00:00Z`));

function requestedMetric(parsed) {
  if (parsed.type) return { key: parsed.type.key, label: parsed.type.label };
  if (/angkut|pengangkutan|dibawa|dikirim/i.test(parsed.question)) return { key: 'transported', label: 'pengangkutan' };
  if (/sisa|tersisa|penumpukan/i.test(parsed.question)) return { key: 'balance', label: 'sisa limbah', endingValue: true };
  return { key: 'generated', label: 'timbulan limbah' };
}

export function buildPeakMonthAnswer(parsed, timeline = []) {
  const metric = requestedMetric(parsed);
  const months = new Map();
  timeline.forEach(item => {
    const key = item.date.slice(0, 7);
    const value = Number(item[metric.key]) || 0;
    months.set(key, metric.endingValue ? value : (months.get(key) || 0) + value);
  });
  const peak = Array.from(months, ([key, value]) => ({ key, value })).filter(item => item.value > 0).sort((a, b) => b.value - a.value)[0];
  return peak
    ? `${metric.label[0].toUpperCase()}${metric.label.slice(1)} tertinggi selama ${parsed.period.label} terjadi pada ${monthLabel(peak.key)} sebanyak ${format(peak.value)} kg.`
    : `Belum ada data ${metric.label} yang dapat dibandingkan selama ${parsed.period.label}.`;
}

export function buildPeakWeekAnswer(parsed, timeline = []) {
  const metric = requestedMetric(parsed);
  const weeks = new Map();
  timeline.forEach(item => {
    const week = Math.ceil(Number(item.date.slice(8, 10)) / 7);
    const key = `${item.date.slice(0, 7)}|${week}`;
    const value = Number(item[metric.key]) || 0;
    weeks.set(key, metric.endingValue ? value : (weeks.get(key) || 0) + value);
  });
  const peak = Array.from(weeks, ([key, value]) => ({ key, value })).filter(item => item.value > 0).sort((a, b) => b.value - a.value)[0];
  if (!peak) return `Belum ada data ${metric.label} yang dapat dibandingkan selama ${parsed.period.label}.`;
  const [month, week] = peak.key.split('|');
  const startDay = (Number(week) - 1) * 7 + 1;
  const endDay = Math.min(Number(week) * 7, new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0)).getUTCDate());
  return `${metric.label[0].toUpperCase()}${metric.label.slice(1)} tertinggi selama ${parsed.period.label} terjadi pada minggu ke-${week} (${startDay}–${endDay} ${monthLabel(month)}) sebanyak ${format(peak.value)} kg.`;
}
