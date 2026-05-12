import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { UnlockPage } from './UnlockPage';

describe('UnlockPage', () => {
  it('shows create master password copy in setup mode', () => {
    render(<UnlockPage mode="setup" onSubmit={() => undefined} />);

    expect(screen.getByText('创建主密码')).toBeInTheDocument();
  });
});
