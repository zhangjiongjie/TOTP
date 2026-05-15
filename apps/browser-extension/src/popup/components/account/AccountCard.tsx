import { resolveIconKey } from '../../../core/icons/icon-matchers';
import { iconRegistry, type IconKey } from '../../../core/icons/icon-registry';
import { CountdownRing } from './CountdownRing';

export interface DemoAccount {
  id: string;
  issuer: string;
  accountName: string;
  code: string;
  period: number;
  secondsRemaining: number;
  iconKey?: IconKey | null;
  groupLabel?: string;
}

export interface AccountCardProps {
  account: DemoAccount;
  onEdit?: (accountId: string) => void;
  onCopyResult?: (issuer: string, status: 'success' | 'error') => void;
}

export function AccountCard({
  account,
  onEdit,
  onCopyResult
}: AccountCardProps) {
  const resolvedIconKey = resolveIconKey({
    issuer: account.issuer,
    accountName: account.accountName
  });
  const iconKey = resolvedIconKey !== 'default' ? resolvedIconKey : account.iconKey ?? resolvedIconKey;
  const iconMarkup = iconRegistry[iconKey];

  async function handleCopy() {
    try {
      if (!navigator.clipboard?.writeText) {
        throw new Error('clipboard unavailable');
      }

      await navigator.clipboard.writeText(account.code.replace(/\s+/g, ''));
      onCopyResult?.(account.issuer, 'success');
    } catch {
      onCopyResult?.(account.issuer, 'error');
    }
  }

  return (
    <article
      data-testid="account-card-grid"
      style={{
        position: 'relative',
        display: 'grid',
        gridTemplateColumns: '48px minmax(0, 1fr) 36px 58px',
        gridTemplateRows: '30px 42px',
        alignItems: 'center',
        gap: '6px 8px',
        height: '104px',
        minHeight: '104px',
        padding: '12px 10px 12px 14px',
        borderRadius: 'var(--radius-card)',
        background: 'var(--color-card)',
        border: '1px solid var(--color-line)',
        boxShadow: 'var(--shadow-card)',
        overflow: 'hidden',
        flexShrink: 0
      }}
    >
      <div
        aria-hidden="true"
        style={{
          gridColumn: '1',
          gridRow: '1 / span 2',
          width: '48px',
          height: '48px',
          aspectRatio: '1 / 1',
          display: 'grid',
          placeItems: 'center',
          borderRadius: '16px',
          background: 'var(--color-card-muted)',
          border: '1px solid var(--color-line)'
        }}
      >
        <span className="brand-icon-plate" style={iconPlateStyle}>
          <span
            className="brand-icon-glyph"
            style={iconGlyphStyle}
            dangerouslySetInnerHTML={{ __html: iconMarkup }}
          />
        </span>
      </div>
      <div
        style={{
          gridColumn: '2',
          gridRow: '1 / span 2',
          minWidth: 0,
          alignSelf: 'center'
        }}
      >
          <h2
            style={{
              margin: 0,
              fontSize: '18px',
              lineHeight: 1.15,
              fontWeight: 800,
              color: 'var(--color-ink-strong)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}
          >
            {account.issuer}
          </h2>
          <p
            data-testid="account-name"
            style={{
              margin: '4px 0 0',
              color: 'var(--color-ink-soft)',
              fontSize: '14px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}
          >
            {account.accountName}
          </p>
          {account.groupLabel && account.groupLabel !== 'Default' ? (
            <p
              style={{
                margin: '6px 0 0',
                color: 'var(--color-brand-strong)',
                fontSize: '12px',
                fontWeight: 600,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}
            >
              {account.groupLabel}
            </p>
          ) : null}
          <p
            style={{
              margin: '7px 0 0',
              color: 'var(--color-brand)',
              fontSize: '27px',
              lineHeight: 1,
              fontWeight: 800,
              letterSpacing: '0.12em',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'clip',
              maxWidth: '100%'
            }}
          >
            {account.code}
          </p>
      </div>

      <button
        type="button"
        aria-label="Edit account"
        title="编辑账号"
        onClick={() => onEdit?.(account.id)}
        style={{
          gridColumn: '4',
          gridRow: '1',
          width: '34px',
          height: '34px',
          justifySelf: 'end',
          display: 'grid',
          placeItems: 'center',
          borderRadius: '50%',
          background: 'var(--color-card-muted)',
          border: '1px solid var(--color-line)',
          cursor: 'pointer'
        }}
      >
        <img src="icons/action_edit.svg" alt="" aria-hidden="true" style={{ width: '18px', height: '18px' }} />
      </button>
      <div
        style={{
          gridColumn: '3',
          gridRow: '2',
          display: 'grid',
          placeItems: 'center',
          justifySelf: 'end'
        }}
      >
        <CountdownRing
          secondsRemaining={account.secondsRemaining}
          period={account.period}
        />
      </div>
      <button
        type="button"
        aria-label={account.code}
        onClick={handleCopy}
        style={{
          gridColumn: '4',
          gridRow: '2',
          width: '58px',
          minHeight: '34px',
          padding: 0,
          borderRadius: 'var(--radius-pill)',
          background: 'var(--color-card-muted)',
          color: 'var(--color-brand)',
          fontWeight: 800,
          cursor: 'pointer'
        }}
      >
        复制
      </button>
    </article>
  );
}

const iconPlateStyle = {
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
} satisfies React.CSSProperties;

const iconGlyphStyle = {
  width: '20px',
  height: '20px',
  aspectRatio: '1 / 1',
  display: 'grid',
  placeItems: 'center'
} satisfies React.CSSProperties;
