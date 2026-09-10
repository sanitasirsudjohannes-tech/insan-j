import { formatDate, formatNumber as format } from '../formatters/wasteAnswerFormatters.js';

const listDates = dates => dates.length
  ? dates.map(date => `• ${formatDate(date)}`).join('\n')
  : '• Tidak ada';

const roomMatches = (left, right) => String(left || '').trim().localeCompare(String(right || '').trim(), 'id-ID', { sensitivity: 'base' }) === 0;

export function buildCompletenessAnswer(parsed, diagnostics = {}) {
  const missing = diagnostics.missingDates || [];
  const zero = diagnostics.zeroOnlyDates || [];
  if (!missing.length && !zero.length) return `Pemeriksaan kelengkapan data ${parsed.period.label}\n\nTidak ditemukan tanggal tanpa input atau tanggal dengan seluruh nilai nol sampai ${formatDate(diagnostics.checkedThrough || parsed.period.end)}.`;
  return `Pemeriksaan kelengkapan data ${parsed.period.label}\n\nDitemukan ${missing.length + zero.length} tanggal yang perlu diperiksa.\n\nTanggal tanpa input (${missing.length})\n${listDates(missing)}\n\nTanggal dengan seluruh nilai nol (${zero.length})\n${listDates(zero)}\n\nCatatan: tanggal tersebut belum tentu merupakan kesalahan dan perlu dikonfirmasi kepada petugas.`;
}

export function buildMissingRoomsAnswer(parsed, diagnostics = {}) {
  const missingRoomDays = diagnostics.missingRoomDays || [];
  if (parsed.roomName) {
    const dates = missingRoomDays.filter(item => item.rooms.some(name => roomMatches(name, parsed.roomName))).map(item => item.date);
    return dates.length
      ? `${parsed.roomName} belum memiliki input pada ${dates.length} hari selama ${parsed.period.label}\n\n${listDates(dates)}\n\nKonfirmasikan kepada petugas sebelum menyimpulkan bahwa pencatatan terlewat.`
      : `${parsed.roomName} memiliki catatan pada seluruh tanggal yang diperiksa selama ${parsed.period.label}.`;
  }
  if (parsed.period.scope === 'day') {
    const rooms = missingRoomDays[0]?.rooms || [];
    return rooms.length
      ? `Ruangan yang belum memiliki input pada ${parsed.period.label}\n\n${rooms.map(name => `• ${name}`).join('\n')}\n\nTotal: ${rooms.length} ruangan.`
      : `Seluruh ruangan aktif memiliki catatan pada ${parsed.period.label}.`;
  }
  const counts = diagnostics.roomMissingCounts || [];
  return counts.length
    ? `Kelengkapan input ruangan selama ${parsed.period.label}\n\n${counts.map(item => `• ${item.name}: belum tercatat pada ${item.days} hari`).join('\n')}\n\nTanggal tanpa input belum tentu merupakan kesalahan dan perlu dikonfirmasi.`
    : `Seluruh ruangan aktif memiliki catatan pada semua tanggal yang diperiksa selama ${parsed.period.label}.`;
}

export function buildDuplicateAnswer(parsed, diagnostics = {}) {
  const duplicates = diagnostics.duplicateRoomDates || [];
  return duplicates.length
    ? `Kemungkinan data ganda selama ${parsed.period.label}\n\n${duplicates.map(item => `• ${formatDate(item.date)} — ${item.roomName}: ${item.count} catatan`).join('\n')}\n\nDitemukan ${duplicates.length} pasangan tanggal dan ruangan yang perlu diperiksa. Jangan hapus data sebelum memastikan catatan tersebut benar-benar duplikat.`
    : `Tidak ditemukan pasangan tanggal dan ruangan dengan lebih dari satu catatan selama ${parsed.period.label}.`;
}

export function buildAnomalyAnswer(parsed, recap) {
  const diagnostics = recap.diagnostics || {};
  const unusual = recap.analytics?.unusualDays || [];
  const negative = diagnostics.negativeRows || [];
  const duplicates = diagnostics.duplicateRoomDates || [];
  const findings = [];
  if (recap.facts.remainingKg < 0) findings.push(`• Sisa akhir bernilai negatif (${format(recap.facts.remainingKg)} kg).`);
  if (recap.facts.totalTransportedKg > recap.facts.openingBalanceKg + recap.facts.totalGeneratedKg) findings.push('• Pengangkutan melebihi limbah yang tersedia pada periode ini.');
  if (negative.length) findings.push(`• Terdapat ${negative.length} catatan dengan angka negatif.`);
  if (duplicates.length) findings.push(`• Terdapat ${duplicates.length} kemungkinan data ganda berdasarkan tanggal dan ruangan.`);
  unusual.slice(0, 10).forEach(item => findings.push(`• Timbulan ${formatDate(item.date)} mencapai ${format(item.value)} kg, lebih tinggi dari pola rata-rata periode.`));
  return findings.length
    ? `Data yang perlu diperiksa selama ${parsed.period.label}\n\n${findings.join('\n')}\n\nTemuan ini merupakan indikator pemeriksaan, bukan bukti bahwa data pasti salah.`
    : `Tidak ditemukan angka negatif, kemungkinan data ganda, sisa negatif, atau lonjakan timbulan berdasarkan pemeriksaan otomatis selama ${parsed.period.label}.`;
}

export function buildLastTransportAnswer(parsed, recap) {
  const transport = recap.diagnostics?.transport || {};
  if (!transport.lastDate) return `Belum ada pengangkutan yang tercatat selama ${parsed.period.label}.`;
  const amount = (recap.charts.timeline || []).find(item => item.date === transport.lastDate)?.transported || 0;
  return `Pengangkutan terakhir selama ${parsed.period.label}\n\n• Tanggal: ${formatDate(transport.lastDate)}\n• Jumlah: ${format(amount)} kg\n• Jarak sampai akhir periode yang diperiksa: ${transport.daysSinceLast} hari.`;
}

export function buildTransportGapAnswer(parsed, recap) {
  const transport = recap.diagnostics?.transport || {};
  if (!transport.lastDate) return `Belum ada pengangkutan yang tercatat selama ${parsed.period.label}, sehingga jeda pengangkutan belum dapat dihitung.`;
  const longest = transport.longestGap;
  return `Jeda pengangkutan selama ${parsed.period.label}\n\n• Sejak pengangkutan terakhir: ${transport.daysSinceLast} hari\n${longest ? `• Jeda terpanjang antarpengangkutan: ${longest.days} hari, antara ${formatDate(longest.from)} dan ${formatDate(longest.date)}` : '• Baru terdapat satu tanggal pengangkutan pada periode ini.'}`;
}
