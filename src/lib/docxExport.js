import { AlignmentType, BorderStyle, Document, HeadingLevel, ImageRun, Packer, PageBreak, Paragraph, ShadingType, Table, TableCell, TableRow, TextRun, WidthType } from 'docx';

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

const tableBorder = { style: BorderStyle.SINGLE, size: 2, color: 'CBD5E1' };
const tableCell = (value, header = false) => new TableCell({
  shading: header ? { fill: 'DCE6F1', type: ShadingType.CLEAR } : undefined,
  borders: { top: tableBorder, bottom: tableBorder, left: tableBorder, right: tableBorder },
  children: [new Paragraph({ spacing: { before: 40, after: 40 }, children: [new TextRun({ text: String(value), bold: header, size: 18, font: 'Arial' })] })],
});

function reportTable(model) {
  return [
    new Paragraph({ spacing: { before: 240, after: 100 }, children: [new TextRun({ text: model.title, bold: true, size: 20, font: 'Arial' })] }),
    new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [
      new TableRow({ tableHeader: true, children: model.headers.map(value => tableCell(value, true)) }),
      ...model.rows.map(row => new TableRow({ children: row.map(value => tableCell(value)) })),
    ] }),
  ];
}

export async function buildDocxBlob(draft, chartImages = [], tableModels = []) {
  const paragraphs = String(draft || '').split('\n').map(reportParagraph);
  if (tableModels.length) {
    paragraphs.push(new Paragraph({ children: [new PageBreak()] }), new Paragraph({ alignment: AlignmentType.CENTER, heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: 'LAMPIRAN TABEL DATA LIMBAH', bold: true, size: 28, font: 'Arial' })] }));
    tableModels.forEach(model => paragraphs.push(...reportTable(model)));
  }
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
  return Number(Boolean(data.balanceFlow?.length))
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

async function balanceChart(rows) {
  const { canvas, context } = createCanvas('Ringkasan Neraca Limbah', 'Saldo awal + timbulan - diangkut = saldo akhir');
  const area = { left: 100, top: 140, width: 1000, height: 390 };
  const maxValue = Math.max(1, ...rows.map(row => Math.max(0, Number(row.value) || 0)));
  context.strokeStyle = '#cbd5e1';
  context.lineWidth = 1;
  for (let i = 0; i <= 4; i += 1) {
    const y = area.top + (area.height * i) / 4;
    context.beginPath(); context.moveTo(area.left, y); context.lineTo(area.left + area.width, y); context.stroke();
  }
  const groupWidth = area.width / rows.length;
  const barWidth = Math.min(130, groupWidth * 0.5);
  rows.forEach((row, index) => {
    const x = area.left + groupWidth * index + groupWidth / 2;
    const height = (Math.max(0, Number(row.value) || 0) / maxValue) * area.height;
    context.fillStyle = COLORS[index % COLORS.length];
    context.fillRect(x - barWidth / 2, area.top + area.height - height, barWidth, height);
    context.fillStyle = '#0f172a'; context.font = 'bold 19px Arial'; context.textAlign = 'center';
    context.fillText(formatKg(row.value), x, area.top + area.height - height - 14);
    context.fillStyle = '#475569'; context.font = '19px Arial'; context.fillText(row.name, x, area.top + area.height + 38);
  });
  context.textAlign = 'left';
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
  if (data.balanceFlow?.length) charts.push(await balanceChart(data.balanceFlow));
  if (data.composition?.some(item => Number(item.value) > 0)) charts.push(await compositionChart(data.composition));
  if (data.rooms?.length) charts.push(await roomsChart(data.rooms));
  if (charts.length !== getExpectedReportChartCount(data)) throw new Error('Jumlah grafik yang dibuat tidak lengkap.');
  return charts;
}
