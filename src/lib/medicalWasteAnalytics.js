const WASTE_KEYS = ['infeksius', 'jarum_suntik', 'botol_obat', 'sitotoksik'];
const TYPE_LABELS = { infeksius: 'limbah infeksius', jarum_suntik: 'limbah jarum suntik', botol_obat: 'limbah botol obat', sitotoksik: 'limbah sitotoksik' };
const number = value => Number(value) || 0;
const sum = (rows, key) => rows.reduce((total, row) => total + number(row[key]), 0);
const wasteTotal = rows => WASTE_KEYS.reduce((total, key) => total + sum(rows, key), 0);
const percentChange = (current, previous) => previous > 0 ? ((current - previous) / previous) * 100 : null;

export function previousPeriod(start, end) {
  const startDate = new Date(`${start}T00:00:00Z`);
  const endDate = new Date(`${end}T00:00:00Z`);
  const duration = Math.max(1, Math.round((endDate - startDate) / 86400000) + 1);
  const previousEnd = new Date(startDate.getTime() - 86400000);
  const previousStart = new Date(previousEnd.getTime() - (duration - 1) * 86400000);
  return { start: previousStart.toISOString().slice(0, 10), end: previousEnd.toISOString().slice(0, 10), days: duration };
}

function roomTotals(rows) {
  const result = new Map();
  rows.forEach(row => {
    const room = row.ruangan || 'Tanpa nama';
    const total = WASTE_KEYS.reduce((value, key) => value + number(row[key]), 0);
    result.set(room, (result.get(room) || 0) + total);
  });
  return result;
}

export function buildMedicalWasteAnalytics({ currentWasteRows = [], currentRoomRows = [], currentTransportRows = [], previousWasteRows = [], previousRoomRows = [], previousTransportRows = [], openingBalanceKg = 0, days = 1 }) {
  const currentGenerated = wasteTotal(currentWasteRows);
  const previousGenerated = wasteTotal(previousWasteRows);
  const currentTransported = sum(currentTransportRows, 'jumlah_kg');
  const previousTransported = sum(previousTransportRows, 'jumlah_kg');
  const remaining = number(openingBalanceKg) + currentGenerated - currentTransported;
  const previousEndingBalance = number(openingBalanceKg);
  const previousOpeningBalance = previousEndingBalance - previousGenerated + previousTransported;
  const types = WASTE_KEYS.map(key => ({ key, name: TYPE_LABELS[key], current: sum(currentWasteRows, key), previous: sum(previousWasteRows, key) }))
    .map(item => ({ ...item, changePercent: percentChange(item.current, item.previous) }));
  const dominantType = [...types].sort((a, b) => b.current - a.current)[0];
  const highestTypeIncrease = types.filter(item => item.changePercent !== null).sort((a, b) => b.changePercent - a.changePercent)[0] || null;
  const currentRooms = roomTotals(currentRoomRows);
  const previousRooms = roomTotals(previousRoomRows);
  const rooms = Array.from(new Set([...currentRooms.keys(), ...previousRooms.keys()])).map(name => {
    const current = currentRooms.get(name) || 0;
    const previous = previousRooms.get(name) || 0;
    return { name, current, previous, change: current - previous, changePercent: percentChange(current, previous) };
  });
  const topRoom = [...rooms].sort((a, b) => b.current - a.current)[0] || null;
  const highestRoomIncrease = rooms.filter(item => item.change > 0).sort((a, b) => b.change - a.change)[0] || null;
  const daily = new Map();
  currentWasteRows.forEach(row => daily.set(row.tanggal, (daily.get(row.tanggal) || 0) + WASTE_KEYS.reduce((value, key) => value + number(row[key]), 0)));
  const averageDaily = currentGenerated / Math.max(days, 1);
  const unusualDays = Array.from(daily, ([date, value]) => ({ date, value })).filter(item => averageDaily > 0 && item.value >= averageDaily * 1.5).sort((a, b) => b.value - a.value);
  return {
    previous: { generatedKg: previousGenerated, transportedKg: previousTransported, openingBalanceKg: previousOpeningBalance, remainingKg: previousEndingBalance },
    changes: { generatedPercent: percentChange(currentGenerated, previousGenerated), transportedPercent: percentChange(currentTransported, previousTransported), remainingKg: remaining - previousEndingBalance },
    performance: { averageDailyKg: averageDaily, transportedCoveragePercent: openingBalanceKg + currentGenerated > 0 ? (currentTransported / (openingBalanceKg + currentGenerated)) * 100 : 0, accumulationIncreased: remaining > previousEndingBalance, negativeBalance: remaining < 0 },
    types, dominantType, highestTypeIncrease, rooms, topRoom, highestRoomIncrease, unusualDays,
  };
}
