const WASTE_KEYS = ['infeksius', 'jarum_suntik', 'botol_obat', 'sitotoksik'];
const DAY_MS = 86400000;
const isoDate = date => date.toISOString().slice(0, 10);
const rowTotal = row => WASTE_KEYS.reduce((total, key) => total + (Number(row[key]) || 0), 0);

function currentWita() {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en', {
    timeZone: 'Asia/Makassar', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date()).map(part => [part.type, part.value]));
  return { date: `${parts.year}-${parts.month}-${parts.day}`, hour: Number(parts.hour) };
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
  const now = currentWita();
  const safeToday = now.hour >= 10 ? now.date : isoDate(new Date(new Date(`${now.date}T00:00:00Z`).getTime() - DAY_MS));
  const effectiveEnd = [end, safeToday].sort()[0];
  const inputEnd = [end, now.date].sort()[0];
  const dates = start <= effectiveEnd ? datesBetween(start, effectiveEnd) : [];
  const inputDates = start <= inputEnd ? datesBetween(start, inputEnd) : [];
  const wasteDates = new Set(wasteRows.map(row => row.tanggal));
  const rowsByDate = new Map();
  wasteRows.forEach(row => {
    if (!rowsByDate.has(row.tanggal)) rowsByDate.set(row.tanggal, []);
    rowsByDate.get(row.tanggal).push(row);
  });

  const officialRooms = new Map(knownRooms.map(name => [normalizeRoom(name), name]));
  const roomsByDate = new Map();
  const duplicateGroups = new Map();
  const officersByDate = new Map();
  roomRows.forEach(row => {
    const roomKey = normalizeRoom(row.ruangan);
    if (!roomsByDate.has(row.tanggal)) roomsByDate.set(row.tanggal, new Set());
    if (roomKey) roomsByDate.get(row.tanggal).add(roomKey);
    const officer = String(row.petugas || '').trim();
    if (!officersByDate.has(row.tanggal)) officersByDate.set(row.tanggal, new Map());
    if (officer) {
      const officerKey = officer.toLocaleLowerCase('id-ID');
      if (!officersByDate.get(row.tanggal).has(officerKey)) officersByDate.get(row.tanggal).set(officerKey, officer);
    }
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

  const exactGroups = new Map();
  const roomDaily = new Map();
  roomRows.forEach(row => {
    const key = JSON.stringify([row.tanggal, normalizeRoom(row.ruangan), ...WASTE_KEYS.map(k => Number(row[k]) || 0)]);
    const item = exactGroups.get(key) || { date: row.tanggal, roomName: row.ruangan, count: 0 };
    item.count += 1;
    exactGroups.set(key, item);
    const roomKey = normalizeRoom(row.ruangan);
    if (!roomDaily.has(roomKey)) roomDaily.set(roomKey, { name: row.ruangan, days: new Map() });
    const days = roomDaily.get(roomKey).days;
    days.set(row.tanggal, (days.get(row.tanggal) || 0) + rowTotal(row));
  });
  const roomOutliers = [];
  for (const room of roomDaily.values()) {
    // Compare each day with at least five OTHER recorded days; absent days are not zeros.
    for (const [date, amount] of room.days) {
      const others = [...room.days].filter(([d]) => d !== date && d <= now.date).map(([, value]) => value).sort((a, b) => a - b);
      if (others.length < 5 || date > now.date) continue;
      const middle = Math.floor(others.length / 2);
      const median = others.length % 2 ? others[middle] : (others[middle - 1] + others[middle]) / 2;
      if (median > 0 && amount > median * 3) roomOutliers.push({ date, roomName: room.name, amount, median });
    }
  }

  return {
    checkedThrough: effectiveEnd,
    completenessCutoffHourWita: 10,
    expectedDays: dates.length,
    officialRooms: Array.from(officialRooms.values()),
    exactDuplicates: [...exactGroups.values()].filter(item => item.count > 1),
    zeroRooms: roomRows.filter(row => WASTE_KEYS.every(key => Number(row[key] || 0) === 0)).map(row => ({ date: row.tanggal, roomName: row.ruangan })),
    unknownRooms: knownRooms.length ? [...new Set(roomRows.filter(row => !officialRooms.has(normalizeRoom(row.ruangan))).map(row => row.ruangan || '(nama kosong)'))] : null,
    missingOfficers: roomRows.filter(row => !String(row.petugas || '').trim()).map(row => ({ date: row.tanggal, roomName: row.ruangan })),
    futureRows: [...wasteRows, ...transportRows].filter(row => row.tanggal > now.date).map(row => ({ date: row.tanggal, roomName: row.ruangan || ('jumlah_kg' in row ? 'Pengangkutan' : 'Catatan manual') })),
    roomOutliers,
    roomPatternNames: [...roomDaily.values()].filter(room => [...room.days.keys()].filter(date => date <= now.date).length >= 6).map(room => room.name),
    officerRecords: roomRows.map(row => ({ date: row.tanggal, roomName: row.ruangan, officer: String(row.petugas || '').trim() })),
    roomPatternCount: [...roomDaily.values()].filter(room => [...room.days.keys()].filter(date => date <= now.date).length >= 6).length,
    recordedWasteDays: wasteDates.size,
    missingDates: dates.filter(date => !wasteDates.has(date)),
    zeroOnlyDates: dates.filter(date => rowsByDate.has(date) && rowsByDate.get(date).every(row => rowTotal(row) === 0)),
    missingRoomDays,
    roomInputs: inputDates.map(date => {
      const names = Array.from(roomsByDate.get(date) || []).map(roomKey =>
        officialRooms.get(roomKey) || roomRows.find(row => row.tanggal === date && normalizeRoom(row.ruangan) === roomKey)?.ruangan || roomKey
      ).sort((left, right) => left.localeCompare(right, 'id-ID', { sensitivity: 'base' }));
      return { date, count: names.length, names, officers: Array.from((officersByDate.get(date) || new Map()).values()).sort((left, right) => left.localeCompare(right, 'id-ID', { sensitivity: 'base' })) };
    }),
    roomMissingCounts: Array.from(roomMissingCounts, ([name, days]) => ({ name, days })).sort((a, b) => b.days - a.days),
    duplicateRoomDates: Array.from(duplicateGroups, ([key, count]) => {
      const [date, roomKey] = key.split('|');
      return { date, roomName: officialRooms.get(roomKey) || roomRows.find(row => row.tanggal === date && normalizeRoom(row.ruangan) === roomKey)?.ruangan || roomKey, count };
    }).filter(item => item.count > 1).sort((a, b) => a.date.localeCompare(b.date)),
    negativeRows: wasteRows.filter(row => WASTE_KEYS.some(key => Number(row[key]) < 0)).map(row => ({ date: row.tanggal, roomName: row.ruangan || null })),
    transport: { dates: transportDates, recordCount: transportRows.filter(row => Number(row.jumlah_kg) > 0).length, lastDate: lastTransportDate, daysSinceLast: daysSinceLastTransport, longestGap: gaps[0] || null },
  };
}
