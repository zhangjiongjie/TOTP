import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { importService } from '../../../services/import-service';
import { QrImportDialog } from './QrImportDialog';

describe('QrImportDialog', () => {
  it('shows an error when the async import callback rejects', async () => {
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

    fireEvent.change(screen.getByLabelText('Choose image'), {
      target: {
        files: [new File(['qr'], 'account.png', { type: 'image/png' })]
      }
    });

    expect(await screen.findByText('Vault unavailable.')).toBeInTheDocument();
  });
});
