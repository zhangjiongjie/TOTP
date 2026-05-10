import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AccountListPage } from './AccountListPage';

describe('AccountListPage', () => {
  it('renders heading, top actions, and floating add button', () => {
    render(<AccountListPage />);

    expect(screen.getByRole('heading', { name: '验证码' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sync' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Settings' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add account' })).toBeInTheDocument();
  });
});
