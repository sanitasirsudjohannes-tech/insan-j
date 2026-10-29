import { formatNumber as format } from '../formatters/wasteAnswerFormatters.js';

// Describe recorded changes only: operational causes require evidence outside this dataset.
export function buildGeneratedDifferenceAnswer(parsed, recap, previousRecap) {
  if (!previousRecap) return 'Sebutkan dua periode yang ingin dibandingkan.';
  const periods = [
    { period: parsed.comparisonPeriod, recap: previousRecap },
    { period: parsed.period, recap },
  ].sort((a, b) => a.period.start.localeCompare(b.period.start));
  const [before, after] = periods;
  const key = parsed.type?.key || 'totalKg';
  const normalize = name => String(name || '').trim().replace(/\s+/g, ' ').toLocaleLowerCase('id-ID');
  const roomMap = value => new Map((value.charts?.roomDetails || []).map(row => [normalize(row.name), row]));
  const left = roomMap(before.recap);
  const right = roomMap(after.recap);
  const changes = [...new Set([...left.keys(), ...right.keys()])].map(name => {
    const a = left.get(name), b = right.get(name);
    return { name: b?.name || a?.name, previous: Number(a?.[key]) || 0, current: Number(b?.[key]) || 0, missing: !a || !b };
  }).filter(row => (!parsed.roomName || normalize(row.name) === normalize(parsed.roomName)) && (!parsed.sameRoomsOnly || !row.missing))
    .map(row => ({ ...row, delta: row.current - row.previous }))
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
  const total = value => parsed.roomName
    ? Number(roomMap(value).get(normalize(parsed.roomName))?.[key]) || 0
    : Number(value.facts?.[parsed.type?.key || 'totalGeneratedKg']) || 0;
  const a = parsed.sameRoomsOnly ? changes.reduce((sum, row) => sum + row.previous, 0) : total(before.recap);
  const b = parsed.sameRoomsOnly ? changes.reduce((sum, row) => sum + row.current, 0) : total(after.recap);
  const deltaText = value => value === 0 ? 'tetap' : `${value > 0 ? 'naik' : 'turun'} ${format(Math.abs(value))} kg`;
  const changed = changes.filter(row => row.delta !== 0 && (!parsed.changeDirection || (parsed.changeDirection === 'up' ? row.delta > 0 : row.delta < 0)));
  const shown = changed.slice(0, 8);
  const lines = shown.map(row => `• ${row.name}: ${format(row.previous)} → ${format(row.current)} kg (${deltaText(row.delta)})${row.missing ? '; tidak ada catatan ruangan pada salah satu periode' : ''}.`);
  if (changed.length > shown.length) lines.push(`• ${changed.length - shown.length} ruangan lainnya: ${deltaText(changed.slice(8).reduce((sum, row) => sum + row.delta, 0))} secara bersih.`);
  const manual = !parsed.sameRoomsOnly && !parsed.roomName && !parsed.type
    ? `\n• Catatan manual: ${deltaText((Number(after.recap.facts.manualGeneratedKg) || 0) - (Number(before.recap.facts.manualGeneratedKg) || 0))}.` : '';
  const typeLines = !parsed.roomName && !parsed.type && !parsed.sameRoomsOnly ? [['Infeksius', 'infectiousKg'], ['Jarum', 'sharpsKg'], ['Botol', 'bottleKg'], ['Sitotoksik', 'cytotoxicKg']].map(([label, field]) => `• ${label}: ${deltaText((Number(after.recap.facts[field]) || 0) - (Number(before.recap.facts[field]) || 0))}.`).join('\n') : '';
  return `Rincian selisih ${parsed.type?.label || 'timbulan'}${parsed.roomName ? ` — ${parsed.roomName}` : ''}${parsed.sameRoomsOnly ? ' — hanya ruangan tercatat pada kedua periode (tanpa catatan manual)' : ''}\n\n• ${before.period.label}: ${format(a)} kg.\n• ${after.period.label}: ${format(b)} kg.\n• Selisih: ${deltaText(b - a)}.${manual}\n\nPerubahan catatan ruangan${parsed.changeDirection ? ` (${parsed.changeDirection === 'up' ? 'kenaikan' : 'penurunan'})` : ''}\n${lines.length ? lines.join('\n') : '• Tidak ditemukan perubahan berat per ruangan sesuai filter.'}${typeLines ? `\n\nPerubahan jenis\n${typeLines}` : ''}\n\nTidak adanya catatan bukan berarti limbah pasti nol. Angka di atas menjelaskan sumber selisih pencatatan; penyebab operasional belum dapat ditentukan dari data yang tersedia.`;
}
