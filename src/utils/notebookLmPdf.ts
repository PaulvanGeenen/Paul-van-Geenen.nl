import { jsPDF } from 'jspdf';

/**
 * Converteert een afbeeldingsbestand (JPG, PNG, WebP, enz.) naar een schone sRGB-PDF
 * met een selecteerbare tekstlaag, zodat Google NotebookLM de PDF zonder foutmelding accepteert.
 */
export async function convertImageFileToNotebookLmPdf(file: File): Promise<string> {
  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Kon de geselecteerde afbeelding niet laden.'));
      el.src = objectUrl;
    });

    const width = img.naturalWidth || img.width;
    const height = img.naturalHeight || img.height;
    if (!width || !height) {
      throw new Error('Ongeldige afbeeldingsafmetingen.');
    }

    // Normaliseer naar schone sRGB JPEG (lost transparantie/CMYK/WebP op)
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Canvas context niet beschikbaar.');
    }
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);
    const jpegDataUrl = canvas.toDataURL('image/jpeg', 0.94);

    const wMm = Math.min(350, Math.max(120, (width * 25.4) / 150));
    const hMm = wMm * (height / width);
    const baseName = file.name.replace(/\.[^.]+$/, '') || 'afbeelding';

    const doc = new jsPDF({
      orientation: wMm >= hMm ? 'landscape' : 'portrait',
      unit: 'mm',
      format: [wMm, hMm],
    });

    // Selecteerbare tekstlaag (vereist door NotebookLM zodat het geen lege image-only PDF is)
    doc.setFontSize(12);
    doc.text(`Afbeelding: ${baseName} (${width}x${height} px) - Geconverteerd voor NotebookLM.`, 10, 15);
    doc.addImage(jpegDataUrl, 'JPEG', 0, 0, wMm, hMm);

    const outName = `${baseName}_notebooklm.pdf`;
    doc.save(outName);
    return outName;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
