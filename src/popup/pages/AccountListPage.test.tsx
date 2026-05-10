import { render, screen } from '@testing-library/react';
import { fireEvent } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AccountListPage } from './AccountListPage';

describe('AccountListPage', () => {
  it('renders heading, top actions, and floating add button', () => {
    render(<AccountListPage />);

    expect(
      screen.getByRole('heading', { name: 'TOTP Authenticator' })
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sync' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Settings' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add account' })).toBeInTheDocument();
  });

  it('navigates to the add account flow from the floating action button', () => {
    window.location.hash = '#accounts';

    render(<AccountListPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Add account' }));

    expect(window.location.hash).toBe('#add');
  });

  it('shows a delete confirmation dialog when deleting an account', () => {
    render(<AccountListPage />);

    fireEvent.click(screen.getAllByRole('button', { name: 'More actions' })[0]);
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    expect(
      screen.getByRole('heading', { name: 'Delete account?' })
    ).toBeInTheDocument();
    expect(
      screen.getByText('This action removes the account from the local demo vault.')
    ).toBeInTheDocument();
  });
});
