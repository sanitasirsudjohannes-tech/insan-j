export const monthKey = date => String(date || '').slice(0, 7);

export const groupExaminationsByMonth = (entries = []) => {
  const grouped = new Map();
  entries.forEach(entry => {
    const key = monthKey(entry.sampled_at);
    if (!key) return;
    const current = grouped.get(key) || { month: key, total: 0, clean: 0, wastewater: 0 };
    const total = Number(entry.total || 1);
    current.total += total;
    if (entry.water_type === 'clean') current.clean += total;
    if (entry.water_type === 'wastewater') current.wastewater += total;
    grouped.set(key, current);
  });
  return [...grouped.values()].sort((a, b) => b.month.localeCompare(a.month));
};

export const groupExaminationsByDate = (entries = [], month, waterType) => {
  const grouped = new Map();
  entries
    .filter(entry => monthKey(entry.sampled_at) === month && entry.water_type === waterType)
    .forEach(entry => grouped.set(entry.sampled_at, (grouped.get(entry.sampled_at) || 0) + Number(entry.total || 1)));
  return [...grouped.entries()]
    .map(([date, total]) => ({ date, total }))
    .sort((a, b) => b.date.localeCompare(a.date));
};
