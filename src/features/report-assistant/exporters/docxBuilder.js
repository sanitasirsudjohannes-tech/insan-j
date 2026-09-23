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
    paragraphs.push(new Paragraph({ children: [new PageBreak()] }), new Paragraph({ alignment: AlignmentType.CENTER, heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: 'LAMPIRAN TABEL DATA PEMERIKSAAN', bold: true, size: 28, font: 'Arial' })] }));
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

