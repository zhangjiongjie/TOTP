import type { PendingSyncConflict } from '@totp/sync';

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
        <div style={contentStyle}>
          <div style={{ display: 'grid', gap: '10px' }}>
          <p style={eyebrowStyle}>同步冲突</p>
          <h2 style={headingStyle}>选择保留哪个版本</h2>
          <p style={helperStyle}>
            从基线版本 {conflict.baseRevision ?? 'N/A'} 之后，本地和远端都发生了变化。
            选择要保留的一方后，会用该版本完成覆盖并清理当前同步冲突。
          </p>
          {!resolutionAvailable ? (
            <p style={messageStyle}>
              当前版本暂不支持在弹窗内直接处理冲突，请先检查同步配置。
            </p>
          ) : null}
          </div>
          <div style={choiceGridStyle}>
            <ChoiceCard
              title="保留本地版本"
              description="使用本地版本覆盖远端"
              revision={conflict.local.revision}
              updatedAt={conflict.local.updatedAt}
              source="本地"
              disabled={isResolving || !resolutionAvailable}
              onClick={() => void onResolve('local')}
            />
            <ChoiceCard
              title="使用远端版本"
              description="使用远端版本覆盖本地"
              revision={conflict.remote.revision}
              updatedAt={conflict.remote.updatedAt}
              source="远端"
              disabled={isResolving || !resolutionAvailable}
              onClick={() => void onResolve('remote')}
            />
          </div>
          {message ? <p style={messageStyle}>{message}</p> : null}
        </div>
        <button type="button" onClick={onClose} disabled={isResolving} style={closeButtonStyle}>
          关闭
        </button>
      </section>
    </div>
  );
}

function ChoiceCard({
  title,
  description,
  source,
  revision,
  updatedAt,
  disabled,
  onClick
}: {
  title: string;
  description: string;
  source: string;
  revision: string;
  updatedAt: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} style={choiceCardStyle}>
      <strong style={{ fontSize: '16px' }}>{title}</strong>
      <span style={descriptionStyle}>{description}</span>
      <span style={metaLineStyle}>
        <strong>{source}版本：</strong>
        <span>{revision}</span>
      </span>
      <span style={metaLineStyle}>更新时间：{updatedAt}</span>
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
  width: 'min(420px, calc(100vw - 24px))',
  display: 'grid',
  gap: '18px',
  padding: '22px',
  maxHeight: 'calc(100vh - 40px)',
  borderRadius: '24px',
  background: 'rgba(255, 255, 255, 0.98)',
  boxShadow: '0 26px 60px rgba(15, 23, 42, 0.18)',
  overflow: 'hidden'
} satisfies React.CSSProperties;

const contentStyle = {
  display: 'grid',
  gap: '18px',
  minHeight: 0,
  overflowY: 'auto',
  paddingRight: '4px'
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
  gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
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
  cursor: 'pointer',
  minWidth: 0
} satisfies React.CSSProperties;

const metaLineStyle = {
  display: 'grid',
  gap: '4px',
  lineHeight: 1.5,
  color: 'var(--color-ink-soft)',
  wordBreak: 'break-all'
} satisfies React.CSSProperties;

const descriptionStyle = {
  lineHeight: 1.5,
  color: 'var(--color-brand-strong)',
  fontSize: '13px',
  fontWeight: 600
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
