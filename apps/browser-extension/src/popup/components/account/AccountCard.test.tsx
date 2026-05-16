import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AccountCard, type AccountCardProps } from './AccountCard';

const baseProps: AccountCardProps = {
  account: {
    id: 'github-alice',
    issuer: 'GitHub',
    accountName: 'alice@company.com',
    code: '123 456',
    period: 30,
    secondsRemaining: 12
  }
};

describe('AccountCard', () => {
  beforeEach(() => {
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined)
      }
    });
  });

  it('reports copy success after clicking the code area', async () => {
    const onCopyResult = vi.fn();

    render(<AccountCard {...baseProps} onCopyResult={onCopyResult} />);

    fireEvent.click(screen.getByRole('button', { name: /123 456/i }));

    await waitFor(() => {
      expect(onCopyResult).toHaveBeenCalledWith('GitHub', 'success');
    });
  });

  it('reports copy failure when clipboard write fails', async () => {
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockRejectedValue(new Error('clipboard denied'))
      }
    });
    const onCopyResult = vi.fn();

    render(<AccountCard {...baseProps} onCopyResult={onCopyResult} />);

    fireEvent.click(screen.getByRole('button', { name: /123 456/i }));

    await waitFor(() => {
      expect(onCopyResult).toHaveBeenCalledWith('GitHub', 'error');
    });
  });

  it('does not render a dead header button without details callback', () => {
    render(<AccountCard {...baseProps} />);

    expect(
      screen.queryByRole('button', { name: /GitHub alice@company.com/i })
    ).not.toBeInTheDocument();
  });

  it('renders an explicit edit button and forwards the account id', () => {
    const onEdit = vi.fn();

    render(<AccountCard {...baseProps} onEdit={onEdit} />);

    fireEvent.click(screen.getByRole('button', { name: 'Edit account' }));

    expect(onEdit).toHaveBeenCalledWith('github-alice');
    expect(onEdit).toHaveBeenCalledTimes(1);
  });

  it('keeps a fixed mobile-style grid and truncates long account names', () => {
    render(
      <AccountCard
        account={{
          ...baseProps.account,
          accountName: 'very-long-account-name-that-should-not-push-actions@example.com'
        }}
      />
    );

    expect(screen.getByTestId('account-card-grid')).toHaveStyle({
      gridTemplateColumns: '48px minmax(0, 1fr) 36px 58px',
      height: '104px'
    });
    expect(screen.getByTestId('account-name')).toHaveStyle({
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap'
    });
  });

  it('prefers the issuer brand over a stale stored icon key', () => {
    render(
      <AccountCard
        account={{
          ...baseProps.account,
          issuer: 'Bitwarden',
          iconKey: 'microsoft'
        }}
      />
    );

    expect(document.querySelector('.brand-icon-glyph')?.innerHTML).toContain(
      '#175DDC'
    );
  });

  it('prefers PayPal issuer over a stale microsoft icon key', () => {
    render(
      <AccountCard
        account={{
          ...baseProps.account,
          issuer: 'PayPAL',
          iconKey: 'microsoft'
        }}
      />
    );

    expect(document.querySelector('.brand-icon-glyph')?.innerHTML).toContain(
      '#002991'
    );
  });

  it('matches Mobiwire GitLab issuer in the card', () => {
    render(
      <AccountCard
        account={{
          ...baseProps.account,
          issuer: 'git01.mobiwire.com'
        }}
      />
    );

    expect(document.querySelector('.brand-icon-glyph')?.innerHTML).toContain(
      '#FC6D26'
    );
  });
});
