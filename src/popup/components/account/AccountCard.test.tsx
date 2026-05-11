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

  it('shows failure feedback when clipboard write fails', async () => {
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockRejectedValue(new Error('clipboard denied'))
      }
    });

    render(<AccountCard {...baseProps} />);

    fireEvent.click(screen.getByRole('button', { name: /123 456/i }));

    expect(await screen.findByText('复制失败，请手动复制')).toBeInTheDocument();
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
});
