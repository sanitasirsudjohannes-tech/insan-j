export const formatNumber = value => new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(Math.round(Number(value) || 0));
export const formatDate = value => new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${value}T00:00:00Z`));
const formatMonth = value => new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${value.slice(0, 7)}-01T00:00:00Z`));

export const changeText = value => value === null || value === undefined
  ? 'belum dapat dibandingkan karena data periode sebelumnya tidak tersedia'
  : `${value >= 0 ? 'meningkat' : 'menurun'} ${formatNumber(Math.abs(value))}%`;

const percentChange = (current, previous) => Number(previous) ? ((Number(current) - Number(previous)) / Number(previous)) * 100 : null;

export function buildDirectComparison(parsed, current, previous) {
  const currentFacts = current.facts;
  const previousFacts = previous.facts;
  const describe = (value, percentage) => `${value >= 0 ? 'naik' : 'turun'} ${formatNumber(Math.abs(value))} kg${percentage === null ? '' : ` (${formatNumber(Math.abs(percentage))}%)`}`;
  const metric = (label, key) => {
    const change = currentFacts[key] - previousFacts[key];
    return `• ${label}: ${formatNumber(previousFacts[key])} kg menjadi ${formatNumber(currentFacts[key])} kg, ${describe(change, percentChange(currentFacts[key], previousFacts[key]))}.`;
  };
  const suffix = parsed.period.inferredYear && parsed.comparisonPeriod.inferredYear ? ' Tahun tidak disebutkan, sehingga digunakan tahun berjalan.' : '';
  return `Perbandingan ${parsed.comparisonPeriod.label} dan ${parsed.period.label}\n\n${metric('Sisa akhir', 'remainingKg')}\n${metric('Timbulan', 'totalGeneratedKg')}\n${metric('Pengangkutan', 'totalTransportedKg')}${suffix}`;
}

function groupDays(days, valueKey) {
  const groups = new Map();
  days.forEach(item => {
    const key = item.date.slice(0, 7);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  });
  return Array.from(groups, ([month, items]) => {
    const total = items.reduce((sum, item) => sum + (Number(item[valueKey]) || 0), 0);
    const details = items.map(item => `• ${formatDate(item.date)}: ${formatNumber(item[valueKey])} kg`).join('\n');
    return `${formatMonth(month)} — ${formatNumber(total)} kg\n${details}`;
  }).join('\n\n');
}

export const groupTransportDays = days => groupDays(days, 'transported');
export const groupTypeDays = (days, type) => groupDays(days, type.key);
