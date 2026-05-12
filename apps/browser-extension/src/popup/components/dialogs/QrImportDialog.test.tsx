import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { importService } from '../../../services/import-service';
import { QrImportDialog } from './QrImportDialog';

describe('QrImportDialog', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('scans the current page immediately after opening', async () => {
    const currentPageSpy = vi.spyOn(importService, 'fromCurrentTabQr').mockResolvedValue({
      issuer: 'GitHub',
      accountName: 'alice@company.com',
      secret: 'JBSWY3DPEHPK3PXP',
      digits: 6,
      period: 30,
      algorithm: 'SHA1'
    });
    const importedSpy = vi.fn();

    render(<QrImportDialog open onClose={() => {}} onImported={importedSpy} />);

    await waitFor(() => expect(currentPageSpy).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(importedSpy).toHaveBeenCalledWith(
        expect.objectContaining({ issuer: 'GitHub', accountName: 'alice@company.com' })
      )
    );
  });

  it('skips automatic current-page scanning when upload is the preferred source', async () => {
    const currentPageSpy = vi.spyOn(importService, 'fromCurrentTabQr').mockResolvedValue({
      issuer: 'GitHub',
      accountName: 'alice@company.com',
      secret: 'JBSWY3DPEHPK3PXP',
      digits: 6,
      period: 30,
      algorithm: 'SHA1'
    });

    render(
      <QrImportDialog
        open
        preferredSource="upload"
        onClose={() => {}}
        onImported={async () => {}}
      />
    );

    await waitFor(() => expect(screen.getByLabelText('上传二维码图片')).toBeEnabled());
    expect(currentPageSpy).not.toHaveBeenCalled();
  });

  it('shows an error when the async import callback rejects', async () => {
    vi.spyOn(importService, 'fromCurrentTabQr').mockRejectedValue(
      new Error('当前网页未检测到二维码。')
    );
    vi.spyOn(importService, 'fromQrFile').mockResolvedValue({
      issuer: 'GitHub',
      accountName: 'alice@company.com',
      secret: 'JBSWY3DPEHPK3PXP',
      digits: 6,
      period: 30,
      algorithm: 'SHA1'
    });

    render(
      <QrImportDialog
        open
        onClose={() => {}}
        onImported={async () => {
          throw new Error('Vault unavailable.');
        }}
      />
    );

    fireEvent.change(await screen.findByLabelText('上传二维码图片'), {
      target: {
        files: [new File(['qr'], 'account.png', { type: 'image/png' })]
      }
    });

    expect(await screen.findByText('Vault unavailable.')).toBeInTheDocument();
  });
});
