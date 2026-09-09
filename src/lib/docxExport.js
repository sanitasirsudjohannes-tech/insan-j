import { AlignmentType, Document, HeadingLevel, ImageRun, Packer, PageBreak, Paragraph, TextRun } from 'docx';

function reportParagraph(line, index) {
  const text = line.trim();
  if (!text) return new Paragraph({ spacing: { after: 80 } });
  const isTitle = index <= 2;
  const isChapter = /^BAB [IVX]+$/.test(text);
  const isSectionTitle = ['PENDAHULUAN', 'HASIL DAN PEMBAHASAN', 'PENUTUP'].includes(text);
  const isSubheading = /^\d+\.\d+\s/.test(text);
  const isBullet = /^-\s/.test(text);
  return new Paragraph({
    alignment: isTitle || isChapter || isSectionTitle ? AlignmentType.CENTER : AlignmentType.JUSTIFIED,
    heading: isChapter || isSectionTitle ? HeadingLevel.HEADING_1 : isSubheading ? HeadingLevel.HEADING_2 : undefined,
    bullet: isBullet ? { level: 0 } : undefined,
    spacing: { after: 120, line: 360 },
    children: [new TextRun({ text: isBullet ? text.replace(/^-\s*/, '') : text, bold: isTitle || isChapter || isSectionTitle || isSubheading, size: isTitle && index === 0 ? 28 : 24, font: 'Arial' })],
  });
}

export async function buildDocxBlob(draft, chartImages = []) {
  const paragraphs = String(draft || '').split('\n').map(reportParagraph);
  if (chartImages.length) {
    paragraphs.push(new Paragraph({ children: [new PageBreak()] }), new Paragraph({ alignment: AlignmentType.CENTER, heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: 'LAMPIRAN GRAFIK', bold: true, size: 28, font: 'Arial' })] }));
    chartImages.forEach((image, index) => {
      paragraphs.push(
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 240, after: 120 }, children: [new TextRun({ text: `Grafik ${index + 1}`, bold: true, font: 'Arial' })] }),
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 240 }, children: [new ImageRun({ data: image, transformation: { width: 620, height: 340 }, type: 'png' })] }),
      );
    });
  }
  const document = new Document({
    creator: 'Unit Sanitasi RSUD Prof. Dr. W.Z. Johannes Kupang',
    title: 'Laporan INSAN-J',
    sections: [{ properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1417, right: 1417, bottom: 1417, left: 1417 } } }, children: paragraphs }],
  });
  return Packer.toBlob(document);
}

const COLORS = ['#2563eb', '#f59e0b', '#10b981', '#8b5cf6'];
const formatKg = value => `${new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 }).format(Number(value) || 0)} kg`;

export function getExpectedReportChartCount(data) {
  if (!data) return 0;
  return Number(Boolean(data.timeline?.length))
    + Number(Boolean(data.composition?.some(item => Number(item.value) > 0)))
    + Number(Boolean(data.rooms?.length));
}

function createCanvas(title, subtitle) {
  const canvas = document.createElement('canvas');
  canvas.width = 1200;
  canvas.height = 675;
  const context = canvas.getContext('2d');
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = '#0f172a';
  context.font = 'bold 32px Arial';
  context.fillText(title, 55, 58);
  context.fillStyle = '#64748b';
  context.font = '20px Arial';
  context.fillText(subtitle, 55, 92);
  return { canvas, context };
}

async function canvasBytes(canvas) {
  const blob = await new Promise((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('Grafik gagal dibuat.')), 'image/png', 0.94));
  return new Uint8Array(await blob.arrayBuffer());
}

async function timelineChart(rows) {
  const { canvas, context } = createCanvas('Timbulan, Pengangkutan, dan Sisa', 'Per tanggal pada periode yang dipilih');
  const area = { left: 85, top: 135, width: 1060, height: 440 };
  const maxValue = Math.max(1, ...rows.flatMap(row => [row.generated, row.transported, Math.max(0, row.balance)].map(Number)));
  context.strokeStyle = '#cbd5e1';
  context.lineWidth = 1;
  for (let i = 0; i <= 4; i += 1) {
    const y = area.top + (area.height * i) / 4;
    context.beginPath(); context.moveTo(area.left, y); context.lineTo(area.left + area.width, y); context.stroke();
  }
  const groupWidth = area.width / rows.length;
  const barWidth = Math.max(3, Math.min(16, groupWidth * 0.28));
  rows.forEach((row, index) => {
    const x = area.left + groupWidth * index + groupWidth / 2;
    [['generated', '#2563eb', -barWidth], ['transported', '#10b981', 0]].forEach(([key, color, offset]) => {
      const height = (Math.max(0, Number(row[key])) / maxValue) * area.height;
      context.fillStyle = color; context.fillRect(x + offset, area.top + area.height - height, barWidth, height);
    });
  });
  context.strokeStyle = '#ef4444'; context.lineWidth = 4; context.beginPath();
  rows.forEach((row, index) => {
    const x = area.left + groupWidth * index + groupWidth / 2;
    const y = area.top + area.height - (Math.max(0, Number(row.balance)) / maxValue) * area.height;
    if (index === 0) context.moveTo(x, y); else context.lineTo(x, y);
  });
  context.stroke();
  context.font = '17px Arial';
  [['Timbulan', '#2563eb'], ['Diangkut', '#10b981'], ['Sisa Akumulasi', '#ef4444']].forEach(([label, color], index) => {
    const x = 380 + index * 190; context.fillStyle = color; context.fillRect(x, 620, 24, 12); context.fillStyle = '#334155'; context.fillText(label, x + 32, 632);
  });
  return canvasBytes(canvas);
}

async function compositionChart(rows) {
  const { canvas, context } = createCanvas('Komposisi Jenis Limbah', 'Proporsi berat setiap jenis limbah');
  const total = rows.reduce((sum, row) => sum + (Number(row.value) || 0), 0) || 1;
  let angle = -Math.PI / 2;
  rows.forEach((row, index) => {
    const slice = ((Number(row.value) || 0) / total) * Math.PI * 2;
    context.beginPath(); context.moveTo(355, 365); context.arc(355, 365, 205, angle, angle + slice); context.closePath(); context.fillStyle = COLORS[index % COLORS.length]; context.fill();
    angle += slice;
  });
  context.font = '22px Arial';
  rows.forEach((row, index) => {
    const y = 220 + index * 78;
    context.fillStyle = COLORS[index % COLORS.length]; context.fillRect(665, y - 18, 28, 28);
    context.fillStyle = '#0f172a'; context.fillText(row.name, 715, y + 3);
    context.fillStyle = '#475569'; context.fillText(`${formatKg(row.value)} (${(((Number(row.value) || 0) / total) * 100).toFixed(2).replace('.', ',')}%)`, 715, y + 33);
  });
  return canvasBytes(canvas);
}

async function roomsChart(rows) {
  const { canvas, context } = createCanvas('Ruangan Penghasil Limbah Terbesar', 'Maksimal 10 ruangan berdasarkan total berat');
  const maxValue = Math.max(1, ...rows.map(row => Number(row.value) || 0));
  const rowHeight = 48;
  context.font = '18px Arial';
  rows.forEach((row, index) => {
    const y = 140 + index * rowHeight;
    const width = ((Number(row.value) || 0) / maxValue) * 660;
    context.fillStyle = '#334155'; context.textAlign = 'right'; context.fillText(String(row.name).slice(0, 28), 330, y + 23);
    context.fillStyle = '#8b5cf6'; context.fillRect(350, y, width, 30);
    context.fillStyle = '#475569'; context.textAlign = 'left'; context.fillText(formatKg(row.value), Math.min(1030, 365 + width), y + 23);
  });
  context.textAlign = 'left';
  return canvasBytes(canvas);
}

export async function createReportChartPngs(data) {
  if (!data) return [];
  const charts = [];
  if (data.timeline?.length) charts.push(await timelineChart(data.timeline));
  if (data.composition?.some(item => Number(item.value) > 0)) charts.push(await compositionChart(data.composition));
  if (data.rooms?.length) charts.push(await roomsChart(data.rooms));
  if (charts.length !== getExpectedReportChartCount(data)) throw new Error('Jumlah grafik yang dibuat tidak lengkap.');
  return charts;
}
