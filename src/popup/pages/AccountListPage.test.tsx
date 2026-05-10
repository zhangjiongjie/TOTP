import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { accountService } from '../../services/account-service';
import { AccountListPage } from './AccountListPage';

describe('AccountListPage', () => {
  beforeEach(() => {
    accountService.__resetForTests?.();
  });

  it('renders heading, top actions, and floating add button', async () => {
    render(<AccountListPage />);

    await screen.findAllByRole('button', { name: 'More actions' });

    expect(
      screen.getByRole('heading', { name: 'TOTP Authenticator' })
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sync' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Settings' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add account' })).toBeInTheDocument();
  });

  it('navigates to the add account flow from the floating action button', async () => {
    window.location.hash = '#accounts';

    render(<AccountListPage />);

    await screen.findAllByRole('button', { name: 'More actions' });

    fireEvent.click(screen.getByRole('button', { name: 'Add account' }));

    expect(window.location.hash).toBe('#add');
  });

  it('shows a delete confirmation dialog when deleting an account', async () => {
    render(<AccountListPage />);

    await screen.findAllByRole('button', { name: 'More actions' });
    fireEvent.click(screen.getAllByRole('button', { name: 'More actions' })[0]);
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    expect(
      screen.getByRole('heading', { name: 'Delete account?' })
    ).toBeInTheDocument();
    expect(
      screen.getByText('This action removes the account from the local demo vault.')
    ).toBeInTheDocument();
  });

  it('moves an account into another group from the more menu flow', async () => {
    render(<AccountListPage />);

    await screen.findAllByRole('button', { name: 'More actions' });
    fireEvent.click(screen.getAllByRole('button', { name: 'More actions' })[0]);
    fireEvent.click(screen.getByRole('button', { name: 'Move Group' }));

    expect(
      screen.getByRole('heading', { name: 'Move account to group' })
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Personal' }));

    await waitFor(() => {
      expect(screen.getByText('Group: Personal')).toBeInTheDocument();
    });
  });
});
