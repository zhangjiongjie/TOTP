import jsQR from 'jsqr';

interface BarcodeDetectorLike {
  detect(source: ImageBitmapSource): Promise<Array<{ rawValue?: string }>>;
}

interface BarcodeDetectorConstructorLike {
  new (options?: { formats?: string[] }): BarcodeDetectorLike;
  getSupportedFormats?: () => Promise<string[]>;
}

export async function decodeQrFromImageFile(file: File): Promise<string> {
  return decodeQrFromBlob(file);
}

export async function decodeQrFromDataUrl(dataUrl: string): Promise<string> {
  const response = await fetch(dataUrl);
  const blob = await response.blob();
  return decodeQrFromBlob(blob);
}

async function decodeQrFromBlob(blob: Blob): Promise<string> {
  const BarcodeDetectorClass = getBarcodeDetector();
  const bitmap = await createImageBitmap(blob);

  try {
    if (BarcodeDetectorClass) {
      const supportsQr =
        typeof BarcodeDetectorClass.getSupportedFormats !== 'function'
          ? true
          : (await BarcodeDetectorClass.getSupportedFormats()).includes('qr_code');

      if (supportsQr) {
        const detector = new BarcodeDetectorClass({ formats: ['qr_code'] });
        const results = await detector.detect(bitmap);
        const rawValue = results[0]?.rawValue?.trim();

        if (rawValue) {
          return rawValue;
        }
      }
    }

    const imageData = renderBitmapToImageData(bitmap);
    const decoded = jsQR(imageData.data, imageData.width, imageData.height);
    const rawValue = decoded?.data?.trim();

    if (!rawValue) {
      throw new Error('当前图片中未检测到二维码。');
    }

    return rawValue;
  } finally {
    bitmap.close();
  }
}

function getBarcodeDetector(): BarcodeDetectorConstructorLike | null {
  const maybeDetector = (globalThis as { BarcodeDetector?: BarcodeDetectorConstructorLike })
    .BarcodeDetector;
  return maybeDetector ?? null;
}

function renderBitmapToImageData(bitmap: ImageBitmap): ImageData {
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;

  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) {
    throw new Error('当前浏览器无法读取二维码图像。');
  }

  context.drawImage(bitmap, 0, 0);
  return context.getImageData(0, 0, canvas.width, canvas.height);
}
