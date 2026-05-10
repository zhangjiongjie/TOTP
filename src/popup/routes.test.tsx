import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PopupRoutes } from './routes';

describe('PopupRoutes', () => {
  it('navigates to accounts by updating the hash after unlock submit', async () => {
    window.location.hash = '#setup';

    render(<PopupRoutes />);

    fireEvent.change(screen.getByLabelText('主密码'), {
      target: { value: 'very-secure-password' }
    });
    fireEvent.click(screen.getByRole('button', { name: '创建并继续' }));

    expect(window.location.hash).toBe('#accounts');
    expect(await screen.findByRole('heading', { name: 'TOTP Authenticator' })).toBeInTheDocument();
  });

  it('renders the settings page from the settings hash and can navigate back', async () => {
    window.location.hash = '#settings';

    render(<PopupRoutes />);

    expect(await screen.findByRole('heading', { name: 'Backup and sync' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Back' }));

    expect(window.location.hash).toBe('#accounts');
    expect(await screen.findByRole('heading', { name: 'TOTP Authenticator' })).toBeInTheDocument();
  });
});
