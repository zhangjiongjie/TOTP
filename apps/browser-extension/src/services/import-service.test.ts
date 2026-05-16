import { describe, expect, it, vi } from 'vitest';
import * as qrDecodeModule from '@totp/core';
import { importService } from './import-service';

describe('importService', () => {
  it('accepts otpauth URIs without issuer and normalizes a display issuer', () => {
    const draft = importService.fromOtpAuthUri(
      'otpauth://totp/alice%40company.com?secret=JBSWY3DPEHPK3PXP'
    );

    expect(draft.accountName).toBe('alice@company.com');
    expect(draft.issuer).toBe('alice@company.com');
  });

  it('accepts QR imports without issuer and normalizes a display issuer', async () => {
    vi.spyOn(qrDecodeModule, 'decodeQrFromImageFile').mockResolvedValue(
      'otpauth://totp/alice%40company.com?secret=JBSWY3DPEHPK3PXP'
    );

    const file = new File(['qr'], 'account.png', { type: 'image/png' });
    const draft = await importService.fromQrFile(file);

    expect(draft.accountName).toBe('alice@company.com');
    expect(draft.issuer).toBe('alice@company.com');
  });

  it('captures the current tab and decodes it as a QR image', async () => {
    vi.spyOn(qrDecodeModule, 'decodeQrFromDataUrl').mockResolvedValue(
      'otpauth://totp/alice%40company.com?secret=JBSWY3DPEHPK3PXP'
    );

    (
      globalThis as typeof globalThis & {
        chrome?: {
          tabs?: {
            captureVisibleTab: (
              windowId: number | undefined,
              options: { format?: 'jpeg' | 'png'; quality?: number },
              callback: (dataUrl?: string) => void
            ) => void;
          };
          runtime?: { lastError?: { message?: string } };
        };
      }
    ).chrome = {
      tabs: {
        captureVisibleTab: (_windowId, _options, callback) => {
          callback('data:image/png;base64,qr-data');
        }
      },
      runtime: {}
    };

    const draft = await importService.fromCurrentTabQr();

    expect(draft.accountName).toBe('alice@company.com');
    expect(draft.issuer).toBe('alice@company.com');
    expect(qrDecodeModule.decodeQrFromDataUrl).toHaveBeenCalledWith(
      'data:image/png;base64,qr-data'
    );
  });
});
