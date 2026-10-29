import { analyzeWaterRecords, locationName, normalizeParameterName } from '../domain/waterQuestionAnalysis.js';

const statusLabel = status => status === 'memenuhi' ? 'Memenuhi' : status === 'tidak_memenuhi' ? 'Tidak memenuhi' : 'Belum dinilai';
const formatDate = value => {
  if (!value) return '-';
  const [year, month, day] = value.split('-').map(Number);
  return new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Makassar' })
    .format(new Date(Date.UTC(year, month - 1, day)));
};
const resultText = item => `${item.result ?? '-'}${item.unit ? ` ${item.unit}` : ''}`;
const sourceLink = { label: 'Buka Pemeriksaan Air', to: '/pemeriksaan-air' };
const parameterTable = (items, title = 'Lokasi yang perlu diperiksa') => items.length ? {
  title,
  columns: [
    { key: 'location', label: 'Lokasi' }, { key: 'parameter', label: 'Parameter' },
    { key: 'result', label: 'Hasil' }, { key: 'standard', label: 'Baku mutu' }, { key: 'status', label: 'Status' },
  ],
  rows: items.map((item, index) => ({ id: `${item.location}-${item.parameter}-${index}`, location: item.location, parameter: item.parameter, result: resultText(item), standard: item.standard || '-', status: statusLabel(item.status) })),
} : null;

const cleanResultTable = records => ({
  title: 'Rincian seluruh lokasi',
  columns: [
    { key: 'location', label: 'Lokasi' }, { key: 'coliform', label: 'Total coliform' },
    { key: 'ecoli', label: 'E. coli' }, { key: 'status', label: 'Status' },
  ],
  rows: records.map(record => {
    const coliform = record.parameters.find(item => normalizeParameterName(item.parameter) === 'totalcoliform');
    const ecoli = record.parameters.find(item => normalizeParameterName(item.parameter) === 'ecoli');
    const statuses = record.parameters.map(item => item.status);
    const status = statuses.includes('tidak_memenuhi') ? 'Tidak memenuhi' : statuses.includes('belum_dinilai') ? 'Belum dinilai' : 'Memenuhi';
    return { id: record.id, location: locationName(record), coliform: coliform ? resultText(coliform) : '-', ecoli: ecoli ? resultText(ecoli) : '-', status };
  }),
});

const summaryCards = (locations, total, compliant, failed, unassessed) => [
  { label: 'Lokasi', value: locations }, { label: 'Hasil parameter', value: total },
  { label: 'Memenuhi', value: compliant }, { label: 'Tidak memenuhi', value: failed },
  { label: 'Belum dinilai', value: unassessed },
];

function recordLines(records, parameterFilter = null) {
  return records.flatMap(record => record.parameters
    .filter(item => !parameterFilter || normalizeParameterName(item.parameter) === normalizeParameterName(parameterFilter))
    .map(item => `• ${locationName(record)} — ${item.parameter}: ${resultText(item)} · BM ${item.standard || '-'} · ${statusLabel(item.status)}`));
}

const followUpsFor = (waterType, date) => waterType === 'wastewater' ? [
  { label: 'Bandingkan inlet–outlet', question: `Bandingkan inlet dan outlet IPAL tanggal ${date}` },
  { label: 'Parameter bermasalah', question: `Parameter IPAL yang tidak memenuhi tanggal ${date}` },
] : [
  { label: 'Lokasi bermasalah', question: `Lokasi air bersih yang tidak memenuhi tanggal ${date}` },
  { label: 'Total coliform', question: `Hasil Total coliform air bersih tanggal ${date}` },
];

export function buildWaterAnswer(parsed, records, availableDates = []) {
  const waterLabel = parsed.waterType === 'clean' ? 'Air Bersih' : 'IPAL';
  if (parsed.intent === 'dates') {
    const dates = availableDates.filter(item => item.water_type === parsed.waterType).map(item => item.sampled_at);
    return {
      text: dates.length
        ? `Tanggal pemeriksaan ${waterLabel}\n${dates.map(date => `• ${formatDate(date)}`).join('\n')}\n\nTotal: ${dates.length} tanggal pemeriksaan.`
        : `Belum ada pemeriksaan ${waterLabel} yang tersimpan.`,
      visualization: dates.length ? { title: `Tanggal pemeriksaan ${waterLabel}`, items: dates.map(date => ({ label: formatDate(date), value: 1 })) } : null,
    };
  }
  if (!records.length) return { text: `Tidak ada data pemeriksaan ${waterLabel} pada tanggal ${formatDate(parsed.sampledAt)}.` };

  const analysis = analyzeWaterRecords(records);
  if (parsed.intent === 'completeness' && parsed.waterType === 'wastewater') {
    const missing = [analysis.inlet.length ? null : 'Inlet', analysis.outlet.length ? null : 'Outlet'].filter(Boolean);
    return { text: missing.length ? `Data IPAL tanggal ${formatDate(parsed.sampledAt)} belum lengkap. Data ${missing.join(' dan ')} belum tersedia.` : `Data IPAL tanggal ${formatDate(parsed.sampledAt)} lengkap: tersedia ${analysis.inlet.length} pemeriksaan Inlet dan ${analysis.outlet.length} pemeriksaan Outlet.` };
  }
  if (parsed.intent === 'non_compliant') {
    return { text: analysis.failed.length
      ? `${analysis.failed.length} parameter ${waterLabel} tidak memenuhi baku mutu pada ${formatDate(parsed.sampledAt)}:\n${analysis.failed.map(item => `• ${item.location} — ${item.parameter}: ${resultText(item)} · BM ${item.standard || '-'}${item.regulation ? ` · ${item.regulation}` : ''}`).join('\n')}`
      : `Tidak ada parameter yang berstatus tidak memenuhi pada pemeriksaan ${waterLabel} tanggal ${formatDate(parsed.sampledAt)}. ${analysis.unassessed.length ? `${analysis.unassessed.length} parameter belum dinilai.` : 'Seluruh parameter yang dapat dinilai berstatus memenuhi.'}` };
  }
  if (parsed.intent === 'parameter') {
    const lines = recordLines(analysis.records, parsed.parameter);
    if (!lines.length) return { text: `Parameter ${parsed.parameter} tidak ditemukan pada pemeriksaan ${waterLabel} tanggal ${formatDate(parsed.sampledAt)}.` };
    if (parsed.waterType !== 'clean') return { text: `Hasil ${parsed.parameter} pada pemeriksaan ${waterLabel} tanggal ${formatDate(parsed.sampledAt)}:\n${lines.join('\n')}` };
    const matches = analysis.parameters.filter(item => normalizeParameterName(item.parameter) === normalizeParameterName(parsed.parameter));
    if (parsed.detailed) return {
      text: `Rincian ${parsed.parameter} Air Bersih tanggal ${formatDate(parsed.sampledAt)}.`,
      table: parameterTable(matches, `Rincian ${parsed.parameter}`),
    };
    const failed = matches.filter(item => item.status === 'tidak_memenuhi');
    const unassessed = matches.filter(item => item.status === 'belum_dinilai');
    const issues = [...failed, ...unassessed];
    return {
      text: `Ringkasan ${parsed.parameter} Air Bersih tanggal ${formatDate(parsed.sampledAt)}. ${issues.length ? 'Berikut lokasi yang perlu diperiksa.' : 'Seluruh lokasi yang dapat dinilai memenuhi baku mutu.'}`,
      cards: summaryCards(matches.length, matches.length, matches.length - failed.length - unassessed.length, failed.length, unassessed.length),
      table: parameterTable(issues),
      actions: [{ label: 'Lihat rincian lengkap', question: `Tampilkan rincian lengkap ${parsed.parameter} air bersih tanggal ${parsed.sampledAt}` }],
    };
  }
  if (parsed.intent === 'inlet_outlet') {
    const lines = recordLines([...analysis.inlet, ...analysis.outlet], parsed.parameter);
    const warning = !analysis.inlet.length || !analysis.outlet.length ? '\n\nPeringatan: pasangan data Inlet dan Outlet belum lengkap.' : '';
    return { text: `Perbandingan Inlet–Outlet IPAL tanggal ${formatDate(parsed.sampledAt)}:\n${lines.join('\n')}${warning}` };
  }

  const document = records[0];
  if (parsed.waterType === 'clean' && !parsed.detailed) {
    const issues = [...analysis.failed, ...analysis.unassessed];
    return {
      text: `Ringkasan pemeriksaan Air Bersih tanggal ${formatDate(parsed.sampledAt)}. ${issues.length ? 'Berikut lokasi yang perlu diperiksa.' : 'Seluruh hasil yang dapat dinilai memenuhi baku mutu.'}${document?.laboratory ? `\nLaboratorium: ${document.laboratory}.` : ''}${document?.report_number ? `\nNomor laporan: ${document.report_number}.` : ''}`,
      cards: summaryCards(records.length, analysis.parameters.length, analysis.compliant.length, analysis.failed.length, analysis.unassessed.length),
      table: parameterTable(issues),
      actions: [{ label: 'Lihat rincian lengkap', question: `Tampilkan rincian lengkap hasil air bersih tanggal ${parsed.sampledAt}` }],
    };
  }
  if (parsed.waterType === 'clean' && parsed.detailed) {
    return {
      text: `Rincian pemeriksaan Air Bersih tanggal ${formatDate(parsed.sampledAt)}.`,
      cards: summaryCards(records.length, analysis.parameters.length, analysis.compliant.length, analysis.failed.length, analysis.unassessed.length),
      table: cleanResultTable(analysis.records),
    };
  }
  const lines = recordLines(analysis.records);
  return {
    text: `Hasil pemeriksaan ${waterLabel} tanggal ${formatDate(parsed.sampledAt)}\n${lines.join('\n')}\n\nRingkasan: ${analysis.compliant.length} memenuhi, ${analysis.failed.length} tidak memenuhi, dan ${analysis.unassessed.length} belum dinilai.${document?.laboratory ? `\nLaboratorium: ${document.laboratory}.` : ''}${document?.report_number ? `\nNomor laporan: ${document.report_number}.` : ''}`,
  };
}

export function presentWaterAnswer(parsed, answer) {
  return {
    ...answer,
    period: parsed.sampledAt ? { start: parsed.sampledAt, end: parsed.sampledAt } : null,
    context: { domain: 'water', waterType: parsed.waterType, sampledAt: parsed.sampledAt, intent: parsed.intent },
    understanding: { status: 'understood', intent: parsed.waterType === 'clean' ? 'Pemeriksaan Air Bersih' : 'Pemeriksaan IPAL', period: parsed.sampledAt ? formatDate(parsed.sampledAt) : null },
    sourceLink,
    followUps: parsed.sampledAt ? followUpsFor(parsed.waterType, parsed.sampledAt) : [],
    favoriteQuestion: parsed.question,
  };
}
