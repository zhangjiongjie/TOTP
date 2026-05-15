import { useState } from 'react';

export type UnlockMode = 'setup' | 'unlock';

interface UnlockFormProps {
  mode: UnlockMode;
  onSubmit?: (password: string) => void;
  children?: React.ReactNode;
}

export function UnlockForm({ mode, onSubmit, children }: UnlockFormProps) {
  const [password, setPassword] = useState('');

  const copy =
    mode === 'setup'
      ? {
          title: '创建主密码',
          action: '创建并继续'
        }
      : {
          title: '输入主密码',
          action: '解锁'
        };

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit?.(password);
      }}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '18px',
        padding: '24px',
        borderRadius: 'var(--radius-card)',
        background: 'var(--color-card)',
        border: '1px solid var(--color-line)',
        boxShadow: 'var(--shadow-card)'
      }}
    >
      <div>
        <h2
          style={{
            margin: 0,
            fontSize: '24px',
            lineHeight: 1.2,
            color: 'var(--color-ink-strong)'
          }}
        >
          {copy.title}
        </h2>
      </div>

      <label
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          color: 'var(--color-ink)',
          fontWeight: 600
        }}
      >
        主密码
        <input
          type="password"
          placeholder={mode === 'setup' ? '至少 12 位' : '输入你的主密码'}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          style={{
            height: '48px',
            padding: '0 14px',
            borderRadius: '16px',
            border: '1px solid var(--color-line)',
            background: 'var(--color-input)',
            color: 'var(--color-ink-strong)',
            outline: 'none'
          }}
        />
      </label>

      <button
        type="submit"
        style={{
          height: '48px',
          borderRadius: '999px',
          background: 'var(--color-brand)',
          color: '#f7fbff',
          fontWeight: 600,
          cursor: 'pointer'
        }}
      >
        {copy.action}
      </button>
      {children}
    </form>
  );
}
