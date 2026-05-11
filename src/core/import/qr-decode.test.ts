import { beforeEach, describe, expect, it, vi } from 'vitest';

const { jsQrMock } = vi.hoisted(() => ({
  jsQrMock: vi.fn()
}));

vi.mock('jsqr', () => ({
  default: jsQrMock
}));

import { decodeQrFromDataUrl } from './qr-decode';

describe('qr decode fallback', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    jsQrMock.mockReset();
    const originalCreateElement = document.createElement.bind(document);

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      blob: async () => new Blob(['image'], { type: 'image/png' })
    }));

    vi.stubGlobal(
      'createImageBitmap',
      vi.fn().mockResolvedValue({
        width: 64,
        height: 64,
        close: vi.fn()
      })
    );

    Object.assign(globalThis, { BarcodeDetector: undefined });

    vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      if (tagName !== 'canvas') {
        return originalCreateElement(tagName);
      }

      return {
        width: 0,
        height: 0,
        getContext: () => ({
          drawImage: vi.fn(),
          getImageData: () => ({
            data: new Uint8ClampedArray(64 * 64 * 4),
            width: 64,
            height: 64
          })
        })
      } as unknown as HTMLCanvasElement;
    });
  });

  it('decodes QR data with jsqr when BarcodeDetector is unavailable', async () => {
    jsQrMock.mockReturnValue({ data: 'otpauth://totp/demo?secret=JBSWY3DPEHPK3PXP' });

    await expect(
      decodeQrFromDataUrl('data:image/png;base64,qr-data')
    ).resolves.toBe('otpauth://totp/demo?secret=JBSWY3DPEHPK3PXP');

    expect(jsQrMock).toHaveBeenCalled();
  });
});
