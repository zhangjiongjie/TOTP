import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { accountService } from '../../services/account-service';
import { __resetForTests } from '../../state/app-store';
import { AccountListPage, formatLastSyncLabel } from './AccountListPage';

describe('AccountListPage', () => {
  beforeEach(async () => {
    await __resetForTests();
    accountService.__seedDemoForTests?.();
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined)
      }
    });
  });

  it('renders heading, top actions, and floating add button', async () => {
    render(<AccountListPage />);

    await screen.findAllByRole('button', { name: 'Edit account' });

    expect(
      screen.getByRole('heading', { name: '身份验证器' })
    ).toBeInTheDocument();
    expect(screen.queryByText('Authenticator')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sync' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Settings' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add account' })).toBeInTheDocument();
    expect(screen.getByText('WebDAV 同步未开启，本地模式。')).toBeInTheDocument();
  });

  it('moves copy feedback into the persistent top banner', async () => {
    render(<AccountListPage />);

    fireEvent.click((await screen.findAllByText('复制'))[0]);

    expect(
      await screen.findByText(/已复制.+账号验证码到系统剪切板/)
    ).toBeInTheDocument();
    expect(screen.queryByText('已复制')).not.toBeInTheDocument();
  });

  it('formats the latest sync time like the mobile title summary', () => {
    expect(formatLastSyncLabel('pushed', '2026-05-15T01:35:00.000Z')).toBe(
      '最新同步：2026-05-15 09:35'
    );
    expect(formatLastSyncLabel(null, null)).toBe('最新同步：暂无');
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
