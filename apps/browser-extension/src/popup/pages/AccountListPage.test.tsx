import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { accountService } from '../../services/account-service';
import { AccountListPage } from './AccountListPage';

describe('AccountListPage', () => {
  beforeEach(() => {
    accountService.__resetForTests?.();
    accountService.__seedDemoForTests?.();
  });

  it('renders heading, top actions, and floating add button', async () => {
    render(<AccountListPage />);

    await screen.findAllByRole('button', { name: 'Edit account' });

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

    await screen.findAllByRole('button', { name: 'Edit account' });

    fireEvent.click(screen.getByRole('button', { name: 'Add account' }));

    expect(window.location.hash).toBe('#add');
  });

  it('navigates to the settings page from the top action button', async () => {
    window.location.hash = '#accounts';

    render(<AccountListPage />);

    await screen.findAllByRole('button', { name: 'Edit account' });

    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));

    expect(window.location.hash).toBe('#settings');
  });

  it('opens the edit flow from the dedicated edit button', async () => {
    window.location.hash = '#accounts';
    render(<AccountListPage />);

    fireEvent.click(await screen.findAllByRole('button', { name: 'Edit account' }).then((items) => items[0]));

    await waitFor(() => {
      expect(window.location.hash).toBe('#detail/demo-1');
    });
  });
});
