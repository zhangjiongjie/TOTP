import { fireEvent, render, screen } from '@testing-library/react';
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

  it('shows copy feedback after clicking the code area', async () => {
    render(<AccountCard {...baseProps} />);

    fireEvent.click(screen.getByRole('button', { name: /123 456/i }));

    expect(await screen.findByText('已复制到剪贴板')).toBeInTheDocument();
  });
});
