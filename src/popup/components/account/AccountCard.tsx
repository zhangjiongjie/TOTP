import { useEffect, useState } from 'react';
import { resolveIconKey } from '../../../core/icons/icon-matchers';
import { iconRegistry } from '../../../core/icons/icon-registry';
import { CountdownRing } from './CountdownRing';
import { CopyButton } from './CopyButton';

export interface DemoAccount {
  id: string;
  issuer: string;
  accountName: string;
  code: string;
  period: number;
  secondsRemaining: number;
}

export interface AccountCardProps {
  account: DemoAccount;
  onOpenDetails?: (accountId: string) => void;
}

export function AccountCard({ account, onOpenDetails }: AccountCardProps) {
  const [copied, setCopied] = useState(false);
  const iconKey = resolveIconKey({
    issuer: account.issuer,
    accountName: account.accountName
  });
  const iconMarkup = iconKey ? iconRegistry[iconKey] : null;

  useEffect(() => {
    if (!copied) {
      return undefined;
    }

    const timer = window.setTimeout(() => setCopied(false), 1600);
    return () => window.clearTimeout(timer);
  }, [copied]);

  async function handleCopy() {
    await navigator.clipboard?.writeText(account.code.replace(/\s+/g, ''));
    setCopied(true);
  }

  return (
    <article
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        padding: '18px',
        borderRadius: 'var(--radius-card)',
        background: 'rgba(255, 255, 255, 0.98)',
        border: '1px solid var(--color-line)',
        boxShadow: 'var(--shadow-card)'
      }}
    >
      <button
        type="button"
        onClick={() => onOpenDetails?.(account.id)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          padding: 0,
          textAlign: 'left',
          cursor: onOpenDetails ? 'pointer' : 'default'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div
            aria-hidden="true"
            style={{
              width: '48px',
              height: '48px',
              display: 'grid',
              placeItems: 'center',
              borderRadius: '16px',
              background: 'var(--color-surface-muted)',
              border: '1px solid var(--color-line)'
            }}
          >
            {iconMarkup ? (
              <span
                style={{ width: '24px', height: '24px', display: 'block' }}
                dangerouslySetInnerHTML={{ __html: iconMarkup }}
              />
            ) : (
              <strong>{account.issuer.slice(0, 1)}</strong>
            )}
          </div>
          <div>
            <h2
              style={{
                margin: 0,
                fontSize: '18px',
                color: 'var(--color-ink-strong)'
              }}
            >
              {account.issuer}
            </h2>
            <p
              style={{
                margin: '4px 0 0',
                color: 'var(--color-ink-soft)',
                fontSize: '14px'
              }}
            >
              {account.accountName}
            </p>
          </div>
        </div>
        <CountdownRing
          secondsRemaining={account.secondsRemaining}
          period={account.period}
        />
      </button>

      <div>
        <CopyButton code={account.code} copied={copied} onCopy={handleCopy} />
        <p
          aria-live="polite"
          style={{
            minHeight: '20px',
            margin: '10px 0 0',
            color: copied ? 'var(--color-success)' : 'var(--color-ink-soft)',
            fontSize: '13px'
          }}
        >
          {copied ? '已复制到剪贴板' : '点击验证码即可复制'}
        </p>
      </div>
    </article>
  );
}
