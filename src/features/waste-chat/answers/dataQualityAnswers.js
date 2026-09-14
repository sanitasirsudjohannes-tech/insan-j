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

const normalizeRoomName = value => String(value || '').trim().toLocaleLowerCase('id-ID');

function roomInputForDate(diagnostics = {}, date) {
  return (diagnostics.roomInputs || []).find(item => item.date === date) || { date, count: 0, names: [], officers: [] };
}

export function buildRoomInputCountAnswer(parsed, diagnostics = {}) {
  const input = roomInputForDate(diagnostics, parsed.period.start);
  const officialCount = (diagnostics.officialRooms || []).length;
  const coverage = officialCount > 0 ? Math.round((input.count / officialCount) * 100) : null;
  const duplicates = diagnostics.duplicateRoomDates || [];
  return `Input ruangan pada ${formatDate(parsed.period.start)}

• Ruangan tercatat: ${input.count}${officialCount ? ` dari ${officialCount} ruangan resmi` : ''}
${coverage === null ? '' : `• Cakupan: ${coverage}%\n`}• Petugas input: ${input.officers?.length ? input.officers.join(', ') : 'Tidak tercatat'}
• Nama ruangan: ${input.names.length ? input.names.join(', ') : 'Belum ada'}

${duplicates.length ? `Perlu diperiksa: terdapat ${duplicates.length} ruangan dengan lebih dari satu catatan pada tanggal ini. Jumlah ruangan di atas dihitung unik.` : 'Tidak ditemukan nama ruangan ganda pada tanggal ini.'}`;
}

export function buildRoomInputComparisonAnswer(parsed, recap, comparisonRecap) {
  if (!comparisonRecap || !parsed.comparisonPeriod) return 'Sebutkan dua tanggal yang ingin dibandingkan.';
  const left = roomInputForDate(comparisonRecap.diagnostics, parsed.comparisonPeriod.start);
  const right = roomInputForDate(recap.diagnostics, parsed.period.start);
  const leftMap = new Map(left.names.map(name => [normalizeRoomName(name), name]));
  const rightMap = new Map(right.names.map(name => [normalizeRoomName(name), name]));
  const same = Array.from(leftMap, ([key, name]) => rightMap.has(key) ? name : null).filter(Boolean);
  const onlyLeft = Array.from(leftMap, ([key, name]) => rightMap.has(key) ? null : name).filter(Boolean);
  const onlyRight = Array.from(rightMap, ([key, name]) => leftMap.has(key) ? null : name).filter(Boolean);
  const countDifference = Math.abs(left.count - right.count);
  const leftTotal = Number(comparisonRecap.facts?.totalGeneratedKg) || 0;
  const rightTotal = Number(recap.facts?.totalGeneratedKg) || 0;
  const totalDifference = rightTotal - leftTotal;

  const roomDetails = details => new Map((details || []).map(item => [normalizeRoomName(item.name), item]));
  const leftDetails = roomDetails(comparisonRecap.charts?.roomDetails);
  const rightDetails = roomDetails(recap.charts?.roomDetails);
  const roomChanges = Array.from(new Set([...leftDetails.keys(), ...rightDetails.keys()])).map(key => {
    const before = leftDetails.get(key);
    const after = rightDetails.get(key);
    const previous = Number(before?.totalKg) || 0;
    const current = Number(after?.totalKg) || 0;
    return { name: after?.name || before?.name || key, previous, current, change: current - previous };
  }).filter(item => item.change !== 0).sort((a, b) => Math.abs(b.change) - Math.abs(a.change));

  const typeChanges = [
    ['Infeksius', 'infectiousKg'], ['Jarum suntik', 'sharpsKg'],
    ['Botol obat', 'bottleKg'], ['Sitotoksik', 'cytotoxicKg'],
  ].map(([name, key]) => ({
    name,
    change: (Number(recap.facts?.[key]) || 0) - (Number(comparisonRecap.facts?.[key]) || 0),
  })).filter(item => item.change !== 0).sort((a, b) => Math.abs(b.change) - Math.abs(a.change));

  const formatChange = value => value > 0 ? `naik ${format(value)} kg` : `turun ${format(Math.abs(value))} kg`;
  const roomChangeLines = roomChanges.slice(0, 8).map(item =>
    `• ${item.name}: ${format(item.previous)} kg menjadi ${format(item.current)} kg — ${formatChange(item.change)}`
  );
  const typeChangeLines = typeChanges.map(item => `• ${item.name}: ${formatChange(item.change)}`);
  const leadingChange = roomChanges[0];
  const duplicateCount = (comparisonRecap.diagnostics?.duplicateRoomDates?.length || 0) + (recap.diagnostics?.duplicateRoomDates?.length || 0);

  return `Perbandingan input dan timbulan ruangan

• ${formatDate(left.date)}: ${left.count} ruangan, ${format(leftTotal)} kg — petugas: ${left.officers?.length ? left.officers.join(', ') : 'tidak tercatat'}
• ${formatDate(right.date)}: ${right.count} ruangan, ${format(rightTotal)} kg — petugas: ${right.officers?.length ? right.officers.join(', ') : 'tidak tercatat'}
• Selisih jumlah ruangan: ${countDifference}
• Selisih timbulan: ${totalDifference === 0 ? 'tetap' : formatChange(totalDifference)}

Kesamaan nama ruangan
• Sama pada kedua tanggal: ${same.length}
• Hanya ${formatDate(left.date)}: ${onlyLeft.length ? onlyLeft.join(', ') : 'tidak ada'}
• Hanya ${formatDate(right.date)}: ${onlyRight.length ? onlyRight.join(', ') : 'tidak ada'}

Penyumbang perubahan terbesar
${roomChangeLines.length ? roomChangeLines.join('\n') : '• Tidak ada perubahan timbulan per ruangan.'}

Perubahan berdasarkan jenis
${typeChangeLines.length ? typeChangeLines.join('\n') : '• Tidak ada perubahan berdasarkan jenis limbah.'}

Kesimpulan
${leadingChange ? `Perbedaan terbesar berasal dari ${leadingChange.name}, yang ${formatChange(leadingChange.change)}.` : 'Jumlah timbulan kedua tanggal sama.'}${left.count === right.count && (onlyLeft.length || onlyRight.length) ? ' Walaupun jumlah ruangan sama, susunan nama ruangannya berbeda.' : ''}${duplicateCount ? ` Terdapat ${duplicateCount} kemungkinan data ganda yang perlu diperiksa.` : ''}

Jumlah ruangan dihitung berdasarkan nama unik; perbedaan huruf besar, huruf kecil, dan spasi diabaikan. Temuan menunjukkan sumber selisih, bukan memastikan bahwa input salah.`;
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
