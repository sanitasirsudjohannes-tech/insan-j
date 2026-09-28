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
    return { text: lines.length ? `Hasil ${parsed.parameter} pada pemeriksaan ${waterLabel} tanggal ${formatDate(parsed.sampledAt)}:\n${lines.join('\n')}` : `Parameter ${parsed.parameter} tidak ditemukan pada pemeriksaan ${waterLabel} tanggal ${formatDate(parsed.sampledAt)}.` };
  }
  if (parsed.intent === 'inlet_outlet') {
    const lines = recordLines([...analysis.inlet, ...analysis.outlet], parsed.parameter);
    const warning = !analysis.inlet.length || !analysis.outlet.length ? '\n\nPeringatan: pasangan data Inlet dan Outlet belum lengkap.' : '';
    return { text: `Perbandingan Inlet–Outlet IPAL tanggal ${formatDate(parsed.sampledAt)}:\n${lines.join('\n')}${warning}` };
  }

  const lines = recordLines(analysis.records);
  const document = records[0];
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
