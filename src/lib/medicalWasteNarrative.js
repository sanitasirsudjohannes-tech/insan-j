const number = value => Number(value) || 0;
const format = value => new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 }).format(number(value));
const direction = value => value > 0 ? 'meningkat' : value < 0 ? 'menurun' : 'tetap';
const changeSentence = (label, current, previous, percent) => percent === null || percent === undefined
  ? `${label} periode sebelumnya belum cukup untuk dihitung sebagai pembanding.`
  : `${label} ${direction(current - previous)} sebesar ${format(Math.abs(current - previous))} kg atau ${format(Math.abs(percent))}% dibandingkan periode sebelumnya.`;

export function buildMedicalWasteAnalysis(facts = {}, analytics = null) {
  const generated = number(facts.totalGeneratedKg);
  const transported = number(facts.totalTransportedKg);
  const opening = number(facts.openingBalanceKg);
  const remaining = number(facts.remainingKg);
  if (!analytics) {
    const dominant = [['limbah infeksius', facts.infectiousKg], ['limbah jarum suntik', facts.sharpsKg], ['limbah botol obat', facts.bottleKg], ['limbah sitotoksik', facts.cytotoxicKg]].sort((a, b) => number(b[1]) - number(a[1]))[0];
    return `Selama periode pelaporan, timbulan limbah medis tercatat sebanyak ${format(generated)} kg dan pengangkutan sebanyak ${format(transported)} kg. Setelah memperhitungkan saldo awal sebesar ${format(opening)} kg, saldo akhir tercatat sebesar ${format(remaining)} kg.\n\nJenis limbah yang paling dominan adalah ${dominant[0]} sebanyak ${format(dominant[1])} kg. Data pembanding periode sebelumnya belum tersedia sehingga kecenderungan kenaikan atau penurunan belum dapat dinilai.`;
  }
  const previous = analytics.previous;
  const comparison = analytics.comparisonPeriod;
  const periodText = comparison ? ` (${comparison.start} sampai ${comparison.end})` : '';
  const balanceText = analytics.performance.negativeBalance
    ? `Saldo akhir bernilai negatif ${format(Math.abs(remaining))} kg sehingga pencatatan timbulan, saldo awal, dan pengangkutan perlu diverifikasi.`
    : analytics.performance.accumulationIncreased
      ? `Saldo akhir meningkat ${format(analytics.changes.remainingKg)} kg dibandingkan saldo awal, yang menunjukkan adanya penambahan penumpukan.`
      : 'Saldo akhir tidak meningkat dibandingkan saldo awal sehingga pengangkutan mampu mengimbangi timbulan pada periode ini.';
  const typeText = analytics.dominantType ? `${analytics.dominantType.name} merupakan jenis dominan sebesar ${format(analytics.dominantType.current)} kg atau ${format(generated > 0 ? analytics.dominantType.current / generated * 100 : 0)}% dari timbulan.` : 'Komposisi jenis limbah belum dapat ditentukan.';
  const roomText = analytics.topRoom ? `${analytics.topRoom.name} menjadi ruangan dengan timbulan terbesar, yaitu ${format(analytics.topRoom.current)} kg. ${analytics.highestRoomIncrease ? `Kenaikan jumlah terbesar tercatat pada ${analytics.highestRoomIncrease.name}, sebesar ${format(analytics.highestRoomIncrease.change)} kg.` : ''}` : 'Data timbulan per ruangan belum tersedia.';
  const anomalyText = analytics.unusualDays.length ? `Timbulan yang setidaknya 50% di atas rata-rata harian ditemukan pada ${analytics.unusualDays.slice(0, 3).map(item => `${item.date} (${format(item.value)} kg)`).join(', ')} dan perlu dicocokkan dengan kegiatan pelayanan pada tanggal tersebut.` : 'Tidak ditemukan hari dengan timbulan setidaknya 50% di atas rata-rata harian.';
  return `Timbulan periode ini sebesar ${format(generated)} kg dengan rata-rata ${format(analytics.performance.averageDailyKg)} kg per hari. Pengangkutan mencapai ${format(transported)} kg atau ${format(analytics.performance.transportedCoveragePercent)}% dari total limbah yang tersedia. ${balanceText}\n\nDibandingkan periode sebelumnya${periodText}, ${changeSentence('timbulan', generated, previous.generatedKg, analytics.changes.generatedPercent)} ${changeSentence('Pengangkutan', transported, previous.transportedKg, analytics.changes.transportedPercent)}\n\n${typeText} ${roomText} ${anomalyText}`;
}

export function buildMedicalWasteRecommendations(facts = {}, analytics = null) {
  const recommendations = [];
  const remaining = number(facts.remainingKg);
  if (remaining < 0 || analytics?.performance.negativeBalance) recommendations.push('Verifikasi kesesuaian saldo awal, timbulan, dan dokumen pengangkutan karena perhitungan menunjukkan saldo negatif.');
  else if (analytics?.performance.accumulationIncreased) recommendations.push('Evaluasi jadwal dan kapasitas pengangkutan karena saldo akhir meningkat dibandingkan saldo awal.');
  else recommendations.push('Pertahankan jadwal pengangkutan dan pemantauan saldo agar tidak terjadi penumpukan pada periode berikutnya.');
  if (analytics?.topRoom) recommendations.push(`Lakukan pemantauan pemilahan dan pencatatan pada ${analytics.topRoom.name} sebagai ruangan dengan timbulan terbesar.`);
  if (analytics?.highestTypeIncrease?.changePercent > 20) recommendations.push(`Evaluasi kenaikan ${analytics.highestTypeIncrease.name} yang mencapai ${format(analytics.highestTypeIncrease.changePercent)}% dibandingkan periode sebelumnya.`);
  if (analytics?.unusualDays.length) recommendations.push('Cocokkan tanggal dengan timbulan tidak biasa terhadap kegiatan pelayanan dan catatan penimbangan untuk memastikan keakuratan data.');
  return recommendations.map((item, index) => `${index + 1}. ${item}`).join('\n');
}

export function buildMedicalWasteConclusion(facts = {}, analytics = null) {
  const remaining = number(facts.remainingKg);
  const comparison = analytics?.changes.generatedPercent;
  const trend = comparison === null || comparison === undefined ? 'Perbandingan dengan periode sebelumnya belum dapat dihitung.' : `Timbulan ${direction(comparison)} ${format(Math.abs(comparison))}% dibandingkan periode sebelumnya.`;
  const condition = remaining < 0 ? 'Saldo negatif menunjukkan data masih perlu diverifikasi sebelum laporan ditetapkan.' : analytics?.performance.accumulationIncreased ? 'Saldo akhir meningkat sehingga pengendalian penumpukan perlu menjadi perhatian.' : 'Pengangkutan mampu menjaga saldo agar tidak meningkat dibandingkan awal periode.';
  return `Pengelolaan limbah medis mencatat timbulan ${format(facts.totalGeneratedKg)} kg, pengangkutan ${format(facts.totalTransportedKg)} kg, dan saldo akhir ${format(remaining)} kg. ${trend} ${condition}`;
}
