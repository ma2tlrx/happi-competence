import 'server-only';

import QRCode from 'qrcode';

/**
 * QR code d'un lien de vérification, produit côté serveur (aucun service tiers).
 * Niveau de correction « M » : lisible imprimé sur un PDF ou affiché à l'écran.
 */
const options = { errorCorrectionLevel: 'M' as const, margin: 2, color: { dark: '#102c32', light: '#ffffff' } };

export function qrSvg(url: string): Promise<string> {
  return QRCode.toString(url, { ...options, type: 'svg' });
}

export function qrPng(url: string, width = 512): Promise<Buffer> {
  return QRCode.toBuffer(url, { ...options, type: 'png', width });
}

export async function qrPngDataUri(url: string, width = 360): Promise<string> {
  return `data:image/png;base64,${(await qrPng(url, width)).toString('base64')}`;
}
