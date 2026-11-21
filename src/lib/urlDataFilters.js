const ISO_DATE = /^20\d{2}-(0[1-9]|1[0-2])-([0-2]\d|3[01])$/;

export function readDataFilters(search = '') {
  const query = new URLSearchParams(search);
  const start = query.get('start') || '';
  const end = query.get('end') || '';
  const explicitDate = query.get('date') || '';
  const validStart = ISO_DATE.test(start) ? start : '';
  const validEnd = ISO_DATE.test(end) ? end : '';
  const date = ISO_DATE.test(explicitDate) ? explicitDate : validStart && validStart === validEnd ? validStart : '';
  const sameMonth = validStart && validEnd && validStart.slice(0, 7) === validEnd.slice(0, 7);
  const month = /^20\d{2}-(0[1-9]|1[0-2])$/.test(query.get('month') || '')
    ? query.get('month')
    : !date && sameMonth ? validStart.slice(0, 7) : '';
  return { start: validStart, end: validEnd, date, month, room: query.get('room') || '', type: query.get('type') || '', tab: query.get('tab') || '' };
}
