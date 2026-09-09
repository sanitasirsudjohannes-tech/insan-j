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

export async function captureChartPngs(container) {
  if (!container) return [];
  return Promise.all(Array.from(container.querySelectorAll('svg')).map(svg => new Promise((resolve, reject) => {
    const clone = svg.cloneNode(true);
    const bounds = svg.getBoundingClientRect();
    const width = Math.max(Math.round(bounds.width), 640);
    const height = Math.max(Math.round(bounds.height), 320);
    clone.setAttribute('width', width);
    clone.setAttribute('height', height);
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    const source = new Blob([new XMLSerializer().serializeToString(clone)], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(source);
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = width * 2;
      canvas.height = height * 2;
      const context = canvas.getContext('2d');
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      canvas.toBlob(async blob => blob ? resolve(new Uint8Array(await blob.arrayBuffer())) : reject(new Error('Grafik gagal dikonversi.')), 'image/png', 0.92);
    };
    image.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Grafik gagal dimuat.')); };
    image.src = url;
  })));
}
