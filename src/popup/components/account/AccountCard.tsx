import { useEffect, useState } from 'react';
import { resolveIconKey } from '../../../core/icons/icon-matchers';
import { iconRegistry } from '../../../core/icons/icon-registry';
import { CountdownRing } from './CountdownRing';
import { CopyButton } from './CopyButton';
import { AccountMenu } from './AccountMenu';

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
  onEdit?: (accountId: string) => void;
  onMoveGroup?: (accountId: string) => void;
  onDelete?: (accountId: string) => void;
}

export function AccountCard({
  account,
  onOpenDetails,
  onEdit,
  onMoveGroup,
  onDelete
}: AccountCardProps) {
  const [copied, setCopied] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState('点击验证码即可复制');
  const [copyStatus, setCopyStatus] = useState<'idle' | 'success' | 'error'>(
    'idle'
  );
  const [menuOpen, setMenuOpen] = useState(false);
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
    <>
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
    </>
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
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
        {onOpenDetails ? (
          <button
            type="button"
            onClick={() => onOpenDetails(account.id)}
            aria-label={`${account.issuer} ${account.accountName}`}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
              padding: 0,
              textAlign: 'left',
              cursor: 'pointer'
            }}
          >
            {headerContent}
          </button>
        ) : (
          <div
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px'
            }}
          >
            {headerContent}
          </div>
        )}
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <button
            type="button"
            aria-label="More actions"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((current) => !current)}
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
            <span aria-hidden="true" style={{ fontSize: '20px', lineHeight: 1 }}>
              ···
            </span>
          </button>
          <AccountMenu
            open={menuOpen}
            onEdit={() => {
              setMenuOpen(false);
              onEdit?.(account.id);
            }}
            onMoveGroup={() => {
              setMenuOpen(false);
              onMoveGroup?.(account.id);
            }}
            onDelete={() => {
              setMenuOpen(false);
              onDelete?.(account.id);
            }}
          />
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
