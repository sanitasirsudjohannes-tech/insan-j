const WASTE_KEYS = ['infeksius', 'jarum_suntik', 'botol_obat', 'sitotoksik'];
const DAY_MS = 86400000;
const isoDate = date => date.toISOString().slice(0, 10);
const rowTotal = row => WASTE_KEYS.reduce((total, key) => total + (Number(row[key]) || 0), 0);

function currentWitaDate() {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en', {
    timeZone: 'Asia/Makassar', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date()).map(part => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function datesBetween(start, end) {
  const result = [];
  for (let time = new Date(`${start}T00:00:00Z`).getTime(); time <= new Date(`${end}T00:00:00Z`).getTime(); time += DAY_MS) {
    result.push(isoDate(new Date(time)));
  }
  return result;
}

const normalizeRoom = value => String(value || '').trim().toLocaleLowerCase('id-ID');

export function buildWasteDataDiagnostics({ start, end, wasteRows = [], roomRows = [], transportRows = [], knownRooms = [] }) {
  const effectiveEnd = [end, currentWitaDate()].sort()[0];
  const dates = start <= effectiveEnd ? datesBetween(start, effectiveEnd) : [];
  const wasteDates = new Set(wasteRows.map(row => row.tanggal));
  const rowsByDate = new Map();
  wasteRows.forEach(row => {
    if (!rowsByDate.has(row.tanggal)) rowsByDate.set(row.tanggal, []);
    rowsByDate.get(row.tanggal).push(row);
  });

  const officialRooms = new Map(knownRooms.map(name => [normalizeRoom(name), name]));
  const roomsByDate = new Map();
  const duplicateGroups = new Map();
  roomRows.forEach(row => {
    const roomKey = normalizeRoom(row.ruangan);
    if (!roomsByDate.has(row.tanggal)) roomsByDate.set(row.tanggal, new Set());
    if (roomKey) roomsByDate.get(row.tanggal).add(roomKey);
    const key = `${row.tanggal}|${roomKey}`;
    if (roomKey) duplicateGroups.set(key, (duplicateGroups.get(key) || 0) + 1);
  });

  const missingRoomDays = dates.map(date => ({
    date,
    rooms: Array.from(officialRooms, ([key, name]) => roomsByDate.get(date)?.has(key) ? null : name).filter(Boolean),
  })).filter(item => item.rooms.length);
  const roomMissingCounts = new Map();
  missingRoomDays.forEach(item => item.rooms.forEach(name => roomMissingCounts.set(name, (roomMissingCounts.get(name) || 0) + 1)));

  const transportDates = [...new Set(transportRows.filter(row => Number(row.jumlah_kg) > 0).map(row => row.tanggal))].sort();
  const lastTransportDate = transportDates.at(-1) || null;
  const daysSinceLastTransport = lastTransportDate
    ? Math.max(0, Math.round((new Date(`${effectiveEnd}T00:00:00Z`) - new Date(`${lastTransportDate}T00:00:00Z`)) / DAY_MS))
    : null;
  const gaps = transportDates.slice(1).map((date, index) => ({
    from: transportDates[index], date,
    days: Math.max(0, Math.round((new Date(`${date}T00:00:00Z`) - new Date(`${transportDates[index]}T00:00:00Z`)) / DAY_MS) - 1),
  })).sort((left, right) => right.days - left.days);

  return {
    checkedThrough: effectiveEnd,
    expectedDays: dates.length,
    missingDates: dates.filter(date => !wasteDates.has(date)),
    zeroOnlyDates: dates.filter(date => rowsByDate.has(date) && rowsByDate.get(date).every(row => rowTotal(row) === 0)),
    missingRoomDays,
    roomMissingCounts: Array.from(roomMissingCounts, ([name, days]) => ({ name, days })).sort((a, b) => b.days - a.days),
    duplicateRoomDates: Array.from(duplicateGroups, ([key, count]) => {
      const [date, roomKey] = key.split('|');
      return { date, roomName: officialRooms.get(roomKey) || roomRows.find(row => row.tanggal === date && normalizeRoom(row.ruangan) === roomKey)?.ruangan || roomKey, count };
    }).filter(item => item.count > 1).sort((a, b) => a.date.localeCompare(b.date)),
    negativeRows: wasteRows.filter(row => WASTE_KEYS.some(key => Number(row[key]) < 0)).map(row => ({ date: row.tanggal, roomName: row.ruangan || null })),
    transport: { dates: transportDates, lastDate: lastTransportDate, daysSinceLast: daysSinceLastTransport, longestGap: gaps[0] || null },
  };
}
