import { useState } from 'react';

export type UnlockMode = 'setup' | 'unlock';

interface UnlockFormProps {
  mode: UnlockMode;
  onSubmit?: (password: string) => void;
}

export function UnlockForm({ mode, onSubmit }: UnlockFormProps) {
  const [password, setPassword] = useState('');

  const copy =
    mode === 'setup'
      ? {
          title: '创建主密码',
          body: '设置一个仅保存在本地的主密码，用来解锁验证码与同步信息。',
          action: '创建并继续'
        }
      : {
          title: '输入主密码',
          body: '使用主密码解锁保管库，继续查看当前设备上的验证码列表。',
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
        background: 'var(--color-surface)',
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
        <p
          style={{
            margin: '10px 0 0',
            lineHeight: 1.6,
            color: 'var(--color-ink-soft)'
          }}
        >
          {copy.body}
        </p>
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
            background: '#fff',
            color: 'var(--color-ink-strong)',
            outline: 'none'
          }}
        />
      </label>

      <button
        type="submit"
        style={{
          height: '48px',
          borderRadius: '16px',
          background: 'linear-gradient(180deg, #315e8d 0%, #244c76 100%)',
          color: '#f7fbff',
          fontWeight: 600,
          cursor: 'pointer'
        }}
      >
        {copy.action}
      </button>
    </form>
  );
}
