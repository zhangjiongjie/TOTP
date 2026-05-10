interface BarcodeDetectorLike {
  detect(source: ImageBitmapSource): Promise<Array<{ rawValue?: string }>>;
}

interface BarcodeDetectorConstructorLike {
  new (options?: { formats?: string[] }): BarcodeDetectorLike;
  getSupportedFormats?: () => Promise<string[]>;
}

export async function decodeQrFromImageFile(file: File): Promise<string> {
  const BarcodeDetectorClass = getBarcodeDetector();
  if (!BarcodeDetectorClass) {
    throw new Error(
      'This browser cannot decode QR images yet. Paste an otpauth:// link instead.'
    );
  }

  const supportsQr =
    typeof BarcodeDetectorClass.getSupportedFormats !== 'function'
      ? true
      : (await BarcodeDetectorClass.getSupportedFormats()).includes('qr_code');

  if (!supportsQr) {
    throw new Error(
      'QR image decoding is unavailable in this browser. Paste an otpauth:// link instead.'
    );
  }

  const bitmap = await createImageBitmap(file);

  try {
    const detector = new BarcodeDetectorClass({ formats: ['qr_code'] });
    const results = await detector.detect(bitmap);
    const rawValue = results[0]?.rawValue?.trim();

    if (!rawValue) {
      throw new Error('No QR code was detected in the selected image.');
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
