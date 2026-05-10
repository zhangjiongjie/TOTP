import type { PendingSyncConflict } from '../../../core/sync/conflict';

interface SyncConflictDialogProps {
  open: boolean;
  conflict: PendingSyncConflict | null;
  isResolving?: boolean;
  message?: string;
  resolutionAvailable?: boolean;
  onClose: () => void;
  onResolve: (choice: 'local' | 'remote') => Promise<void> | void;
}

export function SyncConflictDialog({
  open,
  conflict,
  isResolving = false,
  message,
  resolutionAvailable = true,
  onClose,
  onResolve
}: SyncConflictDialogProps) {
  if (!open || !conflict) {
    return null;
  }

  return (
    <div style={backdropStyle} role="presentation">
      <section aria-modal="true" role="dialog" style={dialogStyle}>
        <div style={{ display: 'grid', gap: '10px' }}>
          <p style={eyebrowStyle}>Sync conflict</p>
          <h2 style={headingStyle}>Choose which vault revision wins</h2>
          <p style={helperStyle}>
            Both the local and remote vault changed since revision {conflict.baseRevision ?? 'N/A'}.
            Pick one source to keep and the sync engine will clear the pending conflict.
          </p>
          {!resolutionAvailable ? (
            <p style={messageStyle}>
              Conflict resolution is read-only in this popup demo until encrypted vault integration
              is finished.
            </p>
          ) : null}
        </div>
        <div style={choiceGridStyle}>
          <ChoiceCard
            title="Keep local copy"
            revision={conflict.local.revision}
            updatedAt={conflict.local.updatedAt}
            source="Local"
            disabled={isResolving || !resolutionAvailable}
            onClick={() => void onResolve('local')}
          />
          <ChoiceCard
            title="Use remote copy"
            revision={conflict.remote.revision}
            updatedAt={conflict.remote.updatedAt}
            source="Remote"
            disabled={isResolving || !resolutionAvailable}
            onClick={() => void onResolve('remote')}
          />
        </div>
        {message ? <p style={messageStyle}>{message}</p> : null}
        <button type="button" onClick={onClose} disabled={isResolving} style={closeButtonStyle}>
          Close
        </button>
      </section>
    </div>
  );
}

function ChoiceCard({
  title,
  source,
  revision,
  updatedAt,
  disabled,
  onClick
}: {
  title: string;
  source: string;
  revision: string;
  updatedAt: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} style={choiceCardStyle}>
      <strong style={{ fontSize: '16px' }}>{title}</strong>
      <span style={metaLineStyle}>{source} revision: {revision}</span>
      <span style={metaLineStyle}>Updated: {updatedAt}</span>
    </button>
  );
}

const backdropStyle = {
  position: 'fixed',
  inset: 0,
  display: 'grid',
  placeItems: 'center',
  padding: '20px',
  background: 'rgba(16, 24, 40, 0.36)'
} satisfies React.CSSProperties;

const dialogStyle = {
  width: 'min(560px, 100%)',
  display: 'grid',
  gap: '18px',
  padding: '22px',
  borderRadius: '24px',
  background: 'rgba(255, 255, 255, 0.98)',
  boxShadow: '0 26px 60px rgba(15, 23, 42, 0.18)'
} satisfies React.CSSProperties;

const eyebrowStyle = {
  margin: 0,
  fontSize: '12px',
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: 'var(--color-ink-soft)'
} satisfies React.CSSProperties;

const headingStyle = {
  margin: 0,
  fontSize: '24px',
  color: 'var(--color-ink-strong)'
} satisfies React.CSSProperties;

const helperStyle = {
  margin: 0,
  lineHeight: 1.6,
  color: 'var(--color-ink-soft)'
} satisfies React.CSSProperties;

const choiceGridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: '12px'
} satisfies React.CSSProperties;

const choiceCardStyle = {
  display: 'grid',
  gap: '8px',
  padding: '16px',
  borderRadius: '18px',
  background: 'rgba(244, 248, 251, 0.92)',
  border: '1px solid var(--color-line)',
  textAlign: 'left',
  cursor: 'pointer'
} satisfies React.CSSProperties;

const metaLineStyle = {
  lineHeight: 1.5,
  color: 'var(--color-ink-soft)'
} satisfies React.CSSProperties;

const closeButtonStyle = {
  justifySelf: 'end',
  minWidth: '88px',
  minHeight: '40px',
  padding: '0 14px',
  borderRadius: '12px',
  background: 'rgba(238, 244, 249, 0.96)',
  border: '1px solid var(--color-line)',
  color: 'var(--color-brand-strong)',
  cursor: 'pointer'
} satisfies React.CSSProperties;

const messageStyle = {
  margin: 0,
  lineHeight: 1.5,
  color: 'var(--color-ink-soft)'
} satisfies React.CSSProperties;
