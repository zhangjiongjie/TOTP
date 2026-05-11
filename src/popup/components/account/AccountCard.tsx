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
  groupLabel?: string;
}

export interface AccountCardProps {
  account: DemoAccount;
  onEdit?: (accountId: string) => void;
}

export function AccountCard({
  account,
  onEdit
}: AccountCardProps) {
  const [copied, setCopied] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState('点击验证码即可复制');
  const [copyStatus, setCopyStatus] = useState<'idle' | 'success' | 'error'>(
    'idle'
  );
  const iconKey = resolveIconKey({
    issuer: account.issuer,
    accountName: account.accountName
  });
  const iconMarkup = iconKey ? iconRegistry[iconKey] : null;

  useEffect(() => {
    if (!copied) {
      return undefined;
    }

    const timer = window.setTimeout(() => {
      setCopied(false);
      setCopyStatus('idle');
      setCopyFeedback('点击验证码即可复制');
    }, 1600);
    return () => window.clearTimeout(timer);
  }, [copied]);

  async function handleCopy() {
    try {
      if (!navigator.clipboard?.writeText) {
        throw new Error('clipboard unavailable');
      }

      await navigator.clipboard.writeText(account.code.replace(/\s+/g, ''));
      setCopyStatus('success');
      setCopyFeedback('已复制到剪贴板');
      setCopied(true);
    } catch {
      setCopied(false);
      setCopyStatus('error');
      setCopyFeedback('复制失败，请手动复制');
    }
  }

  const headerContent = (
    <div
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px'
      }}
    >
      <div
        style={{
          flex: '1 1 auto',
          minWidth: 0,
          display: 'flex',
          alignItems: 'center',
          gap: '14px'
        }}
      >
        <div
          aria-hidden="true"
          style={{
            width: '48px',
            minWidth: '48px',
            height: '48px',
            aspectRatio: '1 / 1',
            display: 'grid',
            placeItems: 'center',
            borderRadius: '14px',
            background: 'var(--color-surface-muted)',
            border: '1px solid var(--color-line)'
          }}
        >
          {iconMarkup ? (
            <span
              className="brand-icon-plate"
              style={{
                width: '32px',
                minWidth: '32px',
                height: '32px',
                aspectRatio: '1 / 1',
                display: 'grid',
                placeItems: 'center',
                borderRadius: '10px',
                overflow: 'hidden',
                background: 'rgba(255, 255, 255, 0.98)',
                boxShadow: 'inset 0 0 0 1px rgba(109, 133, 161, 0.12)'
              }}
            >
              <span
                className="brand-icon-glyph"
                style={{
                  width: '20px',
                  height: '20px',
                  aspectRatio: '1 / 1',
                  display: 'grid',
                  placeItems: 'center'
                }}
                dangerouslySetInnerHTML={{ __html: iconMarkup }}
              />
            </span>
          ) : (
            <span
              className="brand-icon-plate"
              style={{
                width: '32px',
                minWidth: '32px',
                height: '32px',
                aspectRatio: '1 / 1',
                display: 'grid',
                placeItems: 'center',
                borderRadius: '10px',
                overflow: 'hidden',
                background: 'rgba(255, 255, 255, 0.98)',
                boxShadow: 'inset 0 0 0 1px rgba(109, 133, 161, 0.12)',
                color: 'var(--color-brand-strong)',
                fontSize: '15px',
                fontWeight: 700
              }}
            >
              {account.issuer.slice(0, 1)}
            </span>
          )}
        </div>
        <div style={{ minWidth: 0 }}>
          <h2
            style={{
              margin: 0,
              fontSize: '18px',
              lineHeight: 1.15,
              color: 'var(--color-ink-strong)'
            }}
          >
            {account.issuer}
          </h2>
          <p
            style={{
              margin: '4px 0 0',
              color: 'var(--color-ink-soft)',
              fontSize: '14px',
              overflowWrap: 'anywhere'
            }}
          >
            {account.accountName}
          </p>
          {account.groupLabel ? (
            <p
              style={{
                margin: '6px 0 0',
                color: 'var(--color-brand-strong)',
                fontSize: '12px',
                fontWeight: 600,
                overflowWrap: 'anywhere'
              }}
            >
              {`Group: ${account.groupLabel}`}
            </p>
          ) : null}
        </div>
      </div>
      <div style={{ flexShrink: 0, display: 'grid', placeItems: 'center' }}>
        <CountdownRing
          secondsRemaining={account.secondsRemaining}
          period={account.period}
        />
      </div>
    </div>
  );

  return (
    <article
      style={{
        position: 'relative',
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
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'stretch'
          }}
        >
          {headerContent}
        </div>
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <button
            type="button"
            aria-label="Edit account"
            title="编辑账号"
            onClick={() => onEdit?.(account.id)}
            style={{
              width: '34px',
              height: '34px',
              display: 'grid',
              placeItems: 'center',
              borderRadius: '12px',
              background: 'rgba(238, 244, 249, 0.92)',
              border: '1px solid var(--color-line)',
              color: 'var(--color-ink-soft)',
              cursor: 'pointer'
            }}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 20 20"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <path
                d="M4.5 13.7v1.8h1.8l7.26-7.26-1.8-1.8L4.5 13.7Z"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinejoin="round"
              />
              <path
                d="M10.98 5.88 12.78 4.08a1.27 1.27 0 0 1 1.8 0l1.34 1.34a1.27 1.27 0 0 1 0 1.8l-1.8 1.8"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>
      </div>

      <div>
        <CopyButton code={account.code} copied={copied} onCopy={handleCopy} />
        <p
          aria-live="polite"
          style={{
            minHeight: '20px',
            margin: '10px 0 0',
            color:
              copyStatus === 'success'
                ? 'var(--color-success)'
                : copyStatus === 'error'
                  ? '#8a4452'
                  : 'var(--color-ink-soft)',
            fontSize: '13px'
          }}
        >
          {copyFeedback}
        </p>
      </div>
    </article>
  );
}
