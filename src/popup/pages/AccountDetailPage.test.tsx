import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { accountService } from '../../services/account-service';
import { AccountDetailPage } from './AccountDetailPage';

describe('AccountDetailPage', () => {
  beforeEach(() => {
    accountService.__resetForTests?.();
  });

  it('shows a loading state instead of a fake missing state while the account is still loading', () => {
    const getAccountSpy = vi
      .spyOn(accountService, 'getAccount')
      .mockImplementation(() => new Promise(() => {}));

    render(
      <AccountDetailPage
        accountId="demo-1"
        onBack={() => {}}
        onDeleted={() => {}}
      />
    );

    expect(screen.getByText('Loading local account details...')).toBeInTheDocument();
    expect(screen.queryByText('This account is no longer available.')).not.toBeInTheDocument();

    getAccountSpy.mockRestore();
  });

  it('shows an error instead of a fake success message when saving fails', async () => {
    const updateSpy = vi
      .spyOn(accountService, 'updateAccount')
      .mockRejectedValueOnce(new Error('Update failed.'));

    render(
      <AccountDetailPage
        accountId="demo-1"
        onBack={() => {}}
        onDeleted={() => {}}
      />
    );

    expect(await screen.findByDisplayValue('alice@company.com')).toBeInTheDocument();
    fireEvent.click(await screen.findByRole('button', { name: 'Save changes' }));

    expect(await screen.findByText('Update failed.')).toBeInTheDocument();
    expect(screen.queryByText('Account updated.')).not.toBeInTheDocument();

    updateSpy.mockRestore();
  });

  it('disables account deletion while a save request is in flight', async () => {
    const updateSpy = vi
      .spyOn(accountService, 'updateAccount')
      .mockImplementation(() => new Promise(() => {}));

    render(
      <AccountDetailPage
        accountId="demo-1"
        onBack={() => {}}
        onDeleted={() => {}}
      />
    );

    expect(await screen.findByDisplayValue('alice@company.com')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(screen.getByRole('button', { name: 'Delete account' })).toBeDisabled();

    updateSpy.mockRestore();
  });

  it('disables save while a delete request is in flight', async () => {
    const deleteSpy = vi
      .spyOn(accountService, 'deleteAccount')
      .mockImplementation(() => new Promise(() => {}));

    render(
      <AccountDetailPage
        accountId="demo-1"
        onBack={() => {}}
        onDeleted={() => {}}
      />
    );

    expect(await screen.findByDisplayValue('alice@company.com')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Delete account' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    expect(screen.getByRole('button', { name: 'Working...' })).toBeDisabled();

    deleteSpy.mockRestore();
  });
});
