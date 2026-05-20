import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { WebDavForm } from './WebDavForm';
import type { WebDavProfile } from '@totp/sync';

const baseProfile: WebDavProfile = {
  id: 'webdav-primary',
  enabled: true,
  baseUrl: 'https://example.com/dav',
  filePath: '/totp/vault.json',
  username: 'alice',
  password: 'secret',
  syncIntervalMs: 300000
};

const syncStatus = {
  lastStatus: null,
  lastSyncedAt: null,
  lastError: null,
  pendingConflict: null
};

describe('WebDavForm', () => {
  it('uses a compact checkbox and blue enabled caption', () => {
    render(<WebDavForm profile={baseProfile} syncStatus={syncStatus} onSubmit={vi.fn()} />);

    expect(screen.getByTestId('webdav-enabled-checkbox')).toHaveStyle({
      width: '16px',
      height: '16px'
    });
    expect(screen.getByTestId('webdav-enabled-caption')).toHaveStyle({
      color: 'var(--color-brand)'
    });
  });

  it('uses a muted caption when WebDAV is disabled', () => {
    render(
      <WebDavForm
        profile={{ ...baseProfile, enabled: false }}
        syncStatus={syncStatus}
        onSubmit={vi.fn()}
      />
    );

    expect(screen.getByTestId('webdav-enabled-caption')).toHaveTextContent('未启用');
    expect(screen.getByTestId('webdav-enabled-caption')).toHaveStyle({
      color: 'var(--color-ink-soft)'
    });
  });

  it('hides stale remote password errors after sync succeeds', () => {
    render(
      <WebDavForm
        profile={baseProfile}
        syncStatus={{
          lastStatus: 'pushed',
          lastSyncedAt: '2026-05-20T01:29:56.051Z',
          lastError: '远端保管库需要主密码验证后才能继续同步。',
          pendingConflict: null
        }}
        onSubmit={vi.fn()}
      />
    );

    expect(screen.getByText('已同步')).toBeInTheDocument();
    expect(screen.queryByText('远端保管库需要主密码验证后才能继续同步。')).not.toBeInTheDocument();
  });
});
