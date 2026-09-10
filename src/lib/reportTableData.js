const number = value => Number(value) || 0;
const formatNumber = value => new Intl.NumberFormat('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(number(value));
const percentage = (value, total) => total > 0 ? `${formatNumber((number(value) / total) * 100)}%` : '0,00%';
const formatDate = value => {
  const [year, month, day] = String(value || '').slice(0, 10).split('-');
  return year && month && day ? `${day}/${month}/${year}` : String(value || '-');
};

export function buildMedicalWasteTableModels(facts = {}, chartData = {}) {
  const opening = number(facts.openingBalanceKg);
  const generated = number(facts.totalGeneratedKg);
  const transported = number(facts.totalTransportedKg);
  const remaining = number(facts.remainingKg);
  const composition = chartData.composition || [];
  const timeline = chartData.timeline || [];
  const rooms = chartData.rooms || [];
  return [
    { title: 'Tabel 1. Neraca Limbah Medis', headers: ['Uraian', 'Jumlah (kg)', 'Keterangan'], rows: [
      ['Saldo awal', formatNumber(opening), 'Sisa limbah sebelum periode terpilih'],
      ['Timbulan periode', formatNumber(generated), 'Limbah yang dihasilkan pada periode terpilih'],
      ['Total tersedia', formatNumber(opening + generated), 'Saldo awal ditambah timbulan periode'],
      ['Diangkut', formatNumber(transported), 'Limbah yang diangkut pada periode terpilih'],
      ['Saldo akhir', formatNumber(remaining), 'Total tersedia dikurangi limbah yang diangkut'],
    ] },
    { title: 'Tabel 2. Komposisi Limbah Medis', headers: ['No.', 'Jenis limbah', 'Jumlah (kg)', 'Persentase'], rows: [
      ...composition.map((item, index) => [String(index + 1), item.name, formatNumber(item.value), percentage(item.value, generated)]),
      ['', 'Total', formatNumber(generated), generated > 0 ? '100,00%' : '0,00%'],
    ] },
    { title: 'Tabel 3. Timbulan, Pengangkutan, dan Saldo Harian', headers: ['No.', 'Tanggal', 'Timbulan (kg)', 'Diangkut (kg)', 'Saldo (kg)'], rows: timeline.length
      ? timeline.map((item, index) => [String(index + 1), formatDate(item.date), formatNumber(item.generated), formatNumber(item.transported), formatNumber(item.balance)])
      : [['-', 'Tidak tersedia', '-', '-', '-']] },
    { title: 'Tabel 4. Ruangan Penghasil Limbah Terbesar', headers: ['Peringkat', 'Ruangan', 'Jumlah (kg)', 'Persentase'], rows: rooms.length
      ? rooms.map((item, index) => [String(index + 1), item.name, formatNumber(item.value), percentage(item.value, generated)])
      : [['-', 'Tidak tersedia', '-', '-']] },
  ];
}
