import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { accountService } from '../../services/account-service';
import { importService } from '../../services/import-service';
import { AddAccountPage } from './AddAccountPage';

describe('AddAccountPage', () => {
  it('locks mode switching while an import request is still running', async () => {
    const addSpy = vi.spyOn(accountService, 'addAccount').mockImplementation(
      () => new Promise(() => {})
    );

    render(<AddAccountPage onBack={() => {}} onAccountCreated={() => {}} />);

    fireEvent.click(screen.getByRole('button', { name: 'otpauth://' }));
    fireEvent.change(screen.getByLabelText('otpauth link'), {
      target: {
        value: 'otpauth://totp/alice%40company.com?secret=JBSWY3DPEHPK3PXP'
      }
    });
    fireEvent.click(screen.getByRole('button', { name: 'Import link' }));

    expect(await screen.findByRole('button', { name: 'Importing...' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Manual' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'QR image' })).toBeDisabled();

    addSpy.mockRestore();
  });

  it('disables the QR import dialog controls while the add request is in flight', async () => {
    vi.spyOn(importService, 'fromQrFile').mockResolvedValue({
      issuer: 'GitHub',
      accountName: 'alice@company.com',
      secret: 'JBSWY3DPEHPK3PXP',
      digits: 6,
      period: 30,
      algorithm: 'SHA1'
    });
    const addSpy = vi.spyOn(accountService, 'addAccount').mockImplementation(
      () => new Promise(() => {})
    );

    render(<AddAccountPage onBack={() => {}} onAccountCreated={() => {}} />);

    fireEvent.click(screen.getByRole('button', { name: 'QR image' }));
    fireEvent.change(screen.getByLabelText('Choose image'), {
      target: {
        files: [new File(['qr'], 'account.png', { type: 'image/png' })]
      }
    });

    expect(await screen.findByRole('button', { name: 'Working...' })).toBeDisabled();
    expect(screen.getByLabelText('Choose image')).toBeDisabled();

    addSpy.mockRestore();
  });
});
