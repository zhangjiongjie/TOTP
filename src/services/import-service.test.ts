import { describe, expect, it, vi } from 'vitest';
import * as qrDecodeModule from '../core/import/qr-decode';
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
});
