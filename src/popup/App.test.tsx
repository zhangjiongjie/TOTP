import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  __corruptStoredVaultForTests,
  __readStoredVaultForTests,
  __resetForTests,
  __seedStoredVaultForTests
} from '../state/app-store';
import { accountService } from '../services/account-service';
import { App } from './App';

describe('App', () => {
  beforeEach(async () => {
    await __resetForTests();
    window.location.hash = '#settings';
  });

  it('routes locked sessions into the setup flow before showing protected pages', async () => {
    render(<App />);

    expect(await screen.findByRole('heading', { name: '创建主密码' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Backup and sync' })).not.toBeInTheDocument();
  });

  it('routes existing vaults into the unlock flow before showing protected pages', async () => {
    await __seedStoredVaultForTests();

    render(<App />);

    expect(await screen.findByRole('heading', { name: '输入主密码' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Backup and sync' })).not.toBeInTheDocument();
  });

  it('hydrates accounts from the encrypted vault after a successful unlock', async () => {
    await accountService.replaceAllAccounts([
      {
        id: 'vault-1',
        issuer: 'Custom',
        accountName: 'vault-user',
        secret: 'JBSWY3DPEHPK3PXP',
        digits: 6,
        period: 30,
        algorithm: 'SHA1',
        tags: ['restored'],
        groupId: 'personal',
        pinned: true,
        iconKey: null,
        updatedAt: '2026-05-10T08:00:00.000Z'
      }
    ]);
    await __seedStoredVaultForTests();
    accountService.__resetForTests?.();

    render(<App />);

    fireEvent.change(await screen.findByLabelText('主密码'), {
      target: { value: 'very-secure-password' }
    });
    fireEvent.click(screen.getByRole('button', { name: '解锁' }));

    expect(await screen.findByText('vault-user')).toBeInTheDocument();
    expect(screen.getByText('Custom')).toBeInTheDocument();
  });

  it('persists account changes back into the encrypted vault after setup unlock', async () => {
    render(<App />);

    fireEvent.change(await screen.findByLabelText('主密码'), {
      target: { value: 'very-secure-password' }
    });
    fireEvent.click(screen.getByRole('button', { name: '创建并继续' }));
    await screen.findByRole('heading', { name: 'TOTP Authenticator' });

    await act(async () => {
      await accountService.addAccount({
        issuer: 'Persisted',
        accountName: 'local-change',
        secret: 'GEZDGNBVGY3TQOJQ',
        digits: 6,
        period: 30,
        algorithm: 'SHA1'
      });
    });

    await waitFor(async () => {
      const storedVault = await __readStoredVaultForTests();

      expect(
        storedVault?.accounts.some((account) => account.accountName === 'local-change')
      ).toBe(true);
    });
  });

  it('persists account changes after unlocking an existing vault', async () => {
    await __seedStoredVaultForTests();

    render(<App />);

    fireEvent.change(await screen.findByLabelText('主密码'), {
      target: { value: 'very-secure-password' }
    });
    fireEvent.click(screen.getByRole('button', { name: '解锁' }));
    await screen.findByRole('heading', { name: 'TOTP Authenticator' });

    await act(async () => {
      await accountService.addAccount({
        issuer: 'AfterUnlock',
        accountName: 'existing-vault-change',
        secret: 'GEZDGNBVGY3TQOJQ',
        digits: 6,
        period: 30,
        algorithm: 'SHA1'
      });
    });

    await waitFor(async () => {
      const storedVault = await __readStoredVaultForTests();

      expect(
        storedVault?.accounts.some((account) => account.accountName === 'existing-vault-change')
      ).toBe(true);
    });
  });

  it('keeps corrupted stored vaults on the unlock flow and shows the error', async () => {
    await __corruptStoredVaultForTests();

    render(<App />);

    expect(await screen.findByRole('heading', { name: '输入主密码' })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('主密码'), {
      target: { value: 'very-secure-password' }
    });
    fireEvent.click(screen.getByRole('button', { name: '解锁' }));

    expect(await screen.findByText('Stored vault payload is invalid')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '输入主密码' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: '创建主密码' })).not.toBeInTheDocument();
  });
});
