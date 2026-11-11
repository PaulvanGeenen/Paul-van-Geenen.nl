import QRCodeStyling, {
  CornerDotType,
  CornerSquareType,
  DotType,
  ErrorCorrectionLevel,
  Options,
} from 'qr-code-styling';
import jsQR from 'jsqr';
import { jsPDF } from 'jspdf';

export const DEFAULT_QR_BASE_URL = 'https://paulvangeenen.nl/';

export type QrDotStyle = 'square' | 'rounded' | 'dots' | 'classy' | 'classy-rounded' | 'extra-rounded';
export type QrCornerSquareStyle = 'square' | 'extra-rounded' | 'dot';
export type QrCornerDotStyle = 'square' | 'dot';

export interface QrStyleConfig {
  url: string;
  size: number;
  fgColor: string;
  bgColor: string;
  dotType: DotType;
  cornerSquareType: CornerSquareType;
  cornerDotType: CornerDotType;
  errorCorrectionLevel: ErrorCorrectionLevel;
  image?: string;
  imageSize: number;
  imageMarginRatio: number;
  quietZoneRatio: number;
}

export const BOOK_DEFAULT_QR_STYLE: Omit<QrStyleConfig, 'url' | 'image'> = {
  size: 200,
  fgColor: '#000000',
  bgColor: '#FFFFFF',
  dotType: 'square',
  cornerSquareType: 'square',
  cornerDotType: 'square',
  errorCorrectionLevel: 'H',
  imageSize: 0.35,
  imageMarginRatio: 0.014,
  quietZoneRatio: 0.04,
};

/**
 * Bouwt de exacte doel-URL voor een redirectcode ("https://paulvangeenen.nl/" + RedirectCode).
 */
export function buildRedirectQrUrl(redirectCode: string, baseUrl = DEFAULT_QR_BASE_URL): string {
  const cleanCode = (redirectCode || '').trim().toUpperCase().replace(/^\/+/, '');
  const cleanBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  return cleanCode ? `${cleanBase}${cleanCode}` : cleanBase;
}

/**
 * Converteert een QrStyleConfig naar qr-code-styling Options waarbij marges
 * en logo-afstand schalen met de gekozen pixelresolutie.
 */
export function buildQrStylingOptions(
  config: QrStyleConfig,
  renderType: 'canvas' | 'svg' = 'canvas'
): Partial<Options> {
  const size = Math.max(120, Math.round(config.size));
  const quietZonePx = Math.max(4, Math.round(size * config.quietZoneRatio));
  const imageMarginPx = Math.max(2, Math.round(size * config.imageMarginRatio));

  return {
    width: size,
    height: size,
    type: renderType,
    data: config.url || DEFAULT_QR_BASE_URL,
    margin: quietZonePx,
    qrOptions: {
      typeNumber: 0,
      mode: 'Byte',
      errorCorrectionLevel: config.errorCorrectionLevel || 'H',
    },
    backgroundOptions: {
      color: config.bgColor || '#FFFFFF',
    },
    dotsOptions: {
      color: config.fgColor || '#000000',
      type: config.dotType || 'square',
    },
    cornersSquareOptions: {
      color: config.fgColor || '#000000',
      type: config.cornerSquareType || 'square',
    },
    cornersDotOptions: {
      color: config.fgColor || '#000000',
      type: config.cornerDotType || 'square',
    },
    ...(config.image
      ? {
          image: config.image,
          imageOptions: {
            hideBackgroundDots: true,
            imageSize: config.imageSize || 0.35,
            margin: imageMarginPx,
            crossOrigin: 'anonymous',
          },
        }
      : { image: undefined }),
  };
}

export function createStyledQrInstance(
  config: QrStyleConfig,
  renderType: 'canvas' | 'svg' = 'canvas'
): QRCodeStyling {
  return new QRCodeStyling(buildQrStylingOptions(config, renderType));
}

function loadImageFromBlob(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(img);
    };
    img.onerror = (err) => {
      URL.revokeObjectURL(objectUrl);
      reject(err);
    };
    img.src = objectUrl;
  });
}

/**
 * Verifieert scanbaarheid van een QR PNG-blob of canvas met jsQR.
 */
export async function verifyQrBlobScanability(blob: Blob): Promise<{
  scanable: boolean;
  decodedValue: string | null;
}> {
  try {
    const img = await loadImageFromBlob(blob);
    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return { scanable: false, decodedValue: null };
    ctx.drawImage(img, 0, 0);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const decoded = jsQR(imageData.data, imageData.width, imageData.height);
    return {
      scanable: Boolean(decoded?.data),
      decodedValue: decoded?.data || null,
    };
  } catch {
    return { scanable: false, decodedValue: null };
  }
}

/**
 * Genereert een scherpe 200x200 PNG data-URL van een QR-code (standaard boekstijl)
 * voor opslag bij Redirect Mappings en verifieert direct met jsQR.
 */
export async function generateRedirectQrDataUrl(
  redirectCode: string,
  centerLogo?: string | null,
  size = 200
): Promise<{ dataUrl: string; targetUrl: string; verified: boolean }> {
  const targetUrl = buildRedirectQrUrl(redirectCode);
  const config: QrStyleConfig = {
    ...BOOK_DEFAULT_QR_STYLE,
    url: targetUrl,
    size,
    errorCorrectionLevel: centerLogo ? 'H' : 'Q',
    image: centerLogo || undefined,
  };

  const qr = createStyledQrInstance(config, 'canvas');
  const raw = await qr.getRawData('png');
  if (!raw || !(raw instanceof Blob)) {
    throw new Error('Kon geen QR-afbeelding genereren.');
  }

  const img = await loadImageFromBlob(raw);
  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas context niet beschikbaar.');
  }
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0);

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const decoded = jsQR(imageData.data, imageData.width, imageData.height);
  const dataUrl = canvas.toDataURL('image/png');

  return {
    dataUrl,
    targetUrl,
    verified: Boolean(decoded && decoded.data.trim().toUpperCase() === targetUrl.toUpperCase()),
  };
}

/**
 * Optimaliseert een geüpload middenlogo (bijv. leeuw JPG/PNG) voor opslag
 * in de boeken-tabel: max 512px op effen witte achtergrond.
 */
export function optimizeCenterLogoForBook(file: File, maxDim = 512): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Bestand kon niet worden gelezen.'));
    reader.onload = (ev) => {
      const src = ev.target?.result as string;
      if (!src) {
        reject(new Error('Leeg bestand.'));
        return;
      }
      const img = new Image();
      img.onerror = () => reject(new Error('Ongeldige afbeelding.'));
      img.onload = () => {
        let width = img.width;
        let height = img.height;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(src);
          return;
        }
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.9));
      };
      img.src = src;
    };
    reader.readAsDataURL(file);
  });
}

export function sanitizeDownloadFileName(name: string, fallback = 'qrcode'): string {
  const cleaned = (name || '')
    .replace(/[\\/:*?"<>|]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned || fallback;
}

/**
 * Converteert een willekeurige QR-dataURL (bijv. JPEG uit database) naar een echte PNG-download.
 */
export async function downloadDataUrlAsPng(dataUrl: string, fileName: string): Promise<void> {
  const safeName = sanitizeDownloadFileName(fileName, 'qrcode');
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.crossOrigin = 'anonymous';
    i.onload = () => resolve(i);
    i.onerror = reject;
    i.src = dataUrl;
  });
  const canvas = document.createElement('canvas');
  canvas.width = img.width || 400;
  canvas.height = img.height || 400;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas context niet beschikbaar.');
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0);

  const pngBlob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!pngBlob) throw new Error('PNG export mislukt.');
  triggerBlobDownload(pngBlob, `${safeName}.png`);
}

/**
 * Downloadt een QR-code als haarscherpe PNG, vector SVG of drukklare PDF.
 */
export async function downloadStyledQr(
  config: QrStyleConfig,
  format: 'png' | 'svg' | 'pdf',
  fileName: string
): Promise<void> {
  const safeName = sanitizeDownloadFileName(fileName, 'qrcode');

  if (format === 'svg') {
    const svgQr = createStyledQrInstance(config, 'svg');
    const blob = await svgQr.getRawData('svg');
    if (!(blob instanceof Blob)) throw new Error('SVG export mislukt.');
    triggerBlobDownload(blob, `${safeName}.svg`);
    return;
  }

  const canvasQr = createStyledQrInstance(config, 'canvas');
  const pngBlob = await canvasQr.getRawData('png');
  if (!(pngBlob instanceof Blob)) throw new Error('PNG export mislukt.');

  if (format === 'png') {
    triggerBlobDownload(pngBlob, `${safeName}.png`);
    return;
  }

  // PDF: 100 x 100 mm vierkante drukwerk-pagina op volledige pixelresolutie
  const img = await loadImageFromBlob(pngBlob);
  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('PDF canvas niet beschikbaar.');
  ctx.fillStyle = config.bgColor || '#FFFFFF';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0);

  const imgData = canvas.toDataURL('image/png');
  const pageSizeMm = 100;
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: [pageSizeMm, pageSizeMm],
    compress: true,
  });
  doc.addImage(imgData, 'PNG', 0, 0, pageSizeMm, pageSizeMm, undefined, 'FAST');
  doc.save(`${safeName}.pdf`);
}

function triggerBlobDownload(blob: Blob, fullFileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fullFileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
