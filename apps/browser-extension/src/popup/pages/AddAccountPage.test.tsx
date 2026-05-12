import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { accountService } from '../../services/account-service';
import { importService } from '../../services/import-service';
import { AddAccountPage } from './AddAccountPage';

describe('AddAccountPage', () => {
  beforeEach(() => {
    accountService.__resetForTests?.();
    vi.restoreAllMocks();
  });

  it('scans the current page on entry and fills the form without creating an account immediately', async () => {
    const currentPageSpy = vi.spyOn(importService, 'fromCurrentTabQr').mockResolvedValue({
      issuer: 'GitHub',
      accountName: 'alice@company.com',
      secret: 'JBSWY3DPEHPK3PXP',
      digits: 6,
      period: 30,
      algorithm: 'SHA1'
    });
    const createdSpy = vi.fn();

    render(<AddAccountPage onBack={() => {}} onAccountCreated={createdSpy} />);

    await waitFor(() => expect(currentPageSpy).toHaveBeenCalledTimes(1));
    expect(await screen.findByDisplayValue('GitHub')).toBeInTheDocument();
    expect(screen.getByDisplayValue('alice@company.com')).toBeInTheDocument();
    expect((await accountService.listAccounts()).length).toBe(0);
    expect(createdSpy).not.toHaveBeenCalled();
  });

  it('parses a valid otpauth link and backfills the editable fields', async () => {
    vi.spyOn(importService, 'fromCurrentTabQr').mockRejectedValue(
      new Error('当前网页未检测到二维码。')
    );

    render(<AddAccountPage onBack={() => {}} onAccountCreated={() => {}} />);

    fireEvent.change(await screen.findByLabelText('otpauth link'), {
      target: {
        value:
          'otpauth://totp/Notion:owner%40example.com?secret=JBSWY3DPEHPK3PXP&issuer=Notion&digits=8&period=60&algorithm=SHA256'
      }
    });

    expect(await screen.findByDisplayValue('Notion')).toBeInTheDocument();
    expect(screen.getByDisplayValue('owner@example.com')).toBeInTheDocument();
    expect(screen.getByDisplayValue('8')).toBeInTheDocument();
    expect(screen.getByDisplayValue('60')).toBeInTheDocument();
    expect(screen.getByDisplayValue('SHA256')).toBeInTheDocument();
  });

  it('uploads a QR image, fills the form, and only creates the account after save', async () => {
    vi.spyOn(importService, 'fromCurrentTabQr').mockRejectedValue(
      new Error('当前网页未检测到二维码。')
    );
    vi.spyOn(importService, 'fromQrFile').mockResolvedValue({
      issuer: 'OpenAI',
      accountName: 'workspace-owner',
      secret: 'KRSXG5DSNFXGOIDB',
      digits: 6,
      period: 30,
      algorithm: 'SHA256'
    });
    const createdSpy = vi.fn();

    render(<AddAccountPage onBack={() => {}} onAccountCreated={createdSpy} />);

    fireEvent.change(await screen.findByLabelText('上传二维码图片'), {
      target: {
        files: [new File(['qr'], 'account.png', { type: 'image/png' })]
      }
    });

    expect(await screen.findByDisplayValue('OpenAI')).toBeInTheDocument();
    expect((await accountService.listAccounts()).length).toBe(0);

    fireEvent.click(screen.getByRole('button', { name: '保存' }));

    await waitFor(async () => {
      const accounts = await accountService.listAccounts();
      expect(accounts.some((account) => account.issuer === 'OpenAI')).toBe(true);
    });
    expect(createdSpy).toHaveBeenCalledTimes(1);
  });
});
