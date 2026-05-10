import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PopupRoutes, readRoute, routesEqual } from './routes';
import { AccountListPage } from './pages/AccountListPage';
import { SettingsPage } from './pages/SettingsPage';

describe('PopupRoutes', () => {
  it('submits the setup form through the app-level unlock handler', async () => {
    let submittedPassword = '';

    render(
      <PopupRoutes
        route={{ name: 'setup' }}
        onUnlock={(password) => {
          submittedPassword = password;
        }}
        onNavigate={() => undefined}
      />
    );

    fireEvent.change(screen.getByLabelText('主密码'), {
      target: { value: 'very-secure-password' }
    });
    fireEvent.click(screen.getByRole('button', { name: '创建并继续' }));

    expect(submittedPassword).toBe('very-secure-password');
  });

  it('renders the settings page and requests accounts navigation on back', async () => {
    const navigations: unknown[] = [];

    render(
      <PopupRoutes
        route={{ name: 'settings' }}
        onUnlock={() => undefined}
        onNavigate={(route) => {
          navigations.push(route);
        }}
      />
    );

    expect(await screen.findByRole('heading', { name: 'Backup and sync' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Back' }));

    expect(routesEqual(navigations[0] as ReturnType<typeof readRoute>, { name: 'accounts' })).toBe(
      true
    );
  });
});

describe('Navigation Injection', () => {
  it('does not mutate window hash when AccountListPage receives injected navigation handlers', async () => {
    window.location.hash = '#accounts';

    render(
      <AccountListPage
        onOpenAdd={() => undefined}
        onOpenSettings={() => undefined}
        onOpenDetails={() => undefined}
      />
    );

    await screen.findAllByRole('button', { name: 'More actions' });

    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add account' }));
    fireEvent.click(screen.getByRole('button', { name: /GitHub alice@company.com/i }));

    expect(window.location.hash).toBe('#accounts');
  });

  it('does not mutate window hash when SettingsPage receives an injected back handler', async () => {
    window.location.hash = '#settings';

    render(<SettingsPage onBack={() => undefined} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Back' }));

    expect(window.location.hash).toBe('#settings');
  });
});
