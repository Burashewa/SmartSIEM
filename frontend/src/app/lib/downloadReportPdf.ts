import { jsPDF } from 'jspdf';

function stripMarkdownInline(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/^[-*]\s/, '• ');
}

/**
 * Renders markdown (subset) into a downloadable PDF using jsPDF.
 */
export function downloadMarkdownAsPdf(markdown: string, filename: string): void {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const margin = 48;
  const maxWidth = 515;
  const pageHeight = 792;
  let y = margin;

  const ensureSpace = (needed: number) => {
    if (y + needed > pageHeight - margin) {
      doc.addPage();
      y = margin;
    }
  };

  for (const rawLine of markdown.split('\n')) {
    const line = stripMarkdownInline(rawLine);

    if (!line.trim()) {
      y += 10;
      continue;
    }

    if (line.startsWith('---')) {
      ensureSpace(12);
      doc.setDrawColor(180, 180, 180);
      doc.line(margin, y, margin + maxWidth, y);
      y += 16;
      continue;
    }

    let fontSize = 10;
    let fontStyle: 'normal' | 'bold' = 'normal';
    let text = line;

    if (line.startsWith('# ')) {
      fontSize = 18;
      fontStyle = 'bold';
      text = line.slice(2);
    } else if (line.startsWith('## ')) {
      fontSize = 14;
      fontStyle = 'bold';
      text = line.slice(3);
    } else if (line.startsWith('### ')) {
      fontSize = 12;
      fontStyle = 'bold';
      text = line.slice(4);
    } else if (line.startsWith('• ')) {
      text = line;
    } else if (/^\d+\.\s/.test(line)) {
      text = line;
    }

    doc.setFont('helvetica', fontStyle);
    doc.setFontSize(fontSize);
    const wrapped = doc.splitTextToSize(text, maxWidth) as string[];
    const lineHeight = fontSize + 4;
    const blockHeight = wrapped.length * lineHeight + 8;
    ensureSpace(blockHeight);
    doc.text(wrapped, margin, y);
    y += blockHeight;
  }

  doc.save(filename.endsWith('.pdf') ? filename : `${filename}.pdf`);
}
