import { useEffect, useState } from 'react';
import type { WebDavProfile } from '../../../core/sync/webdav-client';
import type { PendingSyncConflict } from '../../../core/sync/conflict';

interface WebDavFormProps {
  profile: WebDavProfile | null;
  syncStatus: {
    lastStatus: string | null;
    lastSyncedAt: string | null;
    lastError: string | null;
    pendingConflict: PendingSyncConflict | null;
  };
  isSaving?: boolean;
  message?: string;
  onSubmit: (profile: WebDavProfile) => Promise<void> | void;
  onOpenConflict?: () => void;
}

const defaultProfile: WebDavProfile = {
  id: 'webdav-primary',
  enabled: false,
  baseUrl: '',
  filePath: '/totp/vault.json',
  username: '',
  password: '',
  syncIntervalMs: 300000
};

export function WebDavForm({
  profile,
  syncStatus,
  isSaving = false,
  message,
  onSubmit,
  onOpenConflict
}: WebDavFormProps) {
  const [formState, setFormState] = useState<WebDavProfile>(profile ?? defaultProfile);

  useEffect(() => {
    setFormState(profile ?? defaultProfile);
  }, [profile]);

  function updateField<Key extends keyof WebDavProfile>(field: Key, value: WebDavProfile[Key]) {
    setFormState((current) => ({ ...current, [field]: value }));
  }

  function handleEnabledChange(enabled: boolean) {
    const nextProfile = { ...formState, enabled };
    setFormState(nextProfile);
    void onSubmit(nextProfile);
  }

  return (
    <section style={sectionStyle}>
      <div style={sectionHeaderStyle}>
        <div>
          <h2 style={headingStyle}>WebDAV 同步</h2>
          <p style={helperStyle}>{message || formatSavedLabel(syncStatus.lastSyncedAt)}</p>
        </div>
        <label style={toggleStyle}>
          <input
            data-testid="webdav-enabled-checkbox"
            aria-label="启用同步"
            type="checkbox"
            checked={formState.enabled}
            disabled={isSaving}
            onChange={(event) => handleEnabledChange(event.target.checked)}
            style={checkboxStyle}
          />
          <span data-testid="webdav-enabled-caption" style={toggleCaptionStyle(formState.enabled)}>{formState.enabled ? '已启用' : '未启用'}</span>
        </label>
      </div>
      <div style={gridStyle}>
        <Field label="WebDAV 服务地址">
          <input
            aria-label="WebDAV 服务地址"
            value={formState.baseUrl}
            onChange={(event) => updateField('baseUrl', event.target.value)}
            placeholder="https://dav.example.com/remote.php/dav/files/user"
            style={inputStyle}
          />
        </Field>
        <Field label="远端文件路径">
          <input
            aria-label="远端文件路径"
            value={formState.filePath}
            onChange={(event) => updateField('filePath', event.target.value)}
            placeholder="/totp/vault.json"
            style={inputStyle}
          />
        </Field>
        <Field label="用户名">
          <input
            aria-label="用户名"
            value={formState.username ?? ''}
            onChange={(event) => updateField('username', event.target.value)}
            placeholder="alice"
            style={inputStyle}
          />
        </Field>
        <Field label="密码">
          <input
            aria-label="密码"
            type="password"
            value={formState.password ?? ''}
            onChange={(event) => updateField('password', event.target.value)}
            placeholder="应用专用密码"
            style={inputStyle}
          />
        </Field>
        <Field label="同步间隔（分钟）">
          <input
            aria-label="同步间隔（分钟）"
            type="number"
            min={1}
            value={String(Math.max(1, Math.round((formState.syncIntervalMs ?? 300000) / 60000)))}
            onChange={(event) =>
              updateField(
                'syncIntervalMs',
                Math.max(1, Number(event.target.value || '5')) * 60_000
              )
            }
            style={inputStyle}
          />
        </Field>
      </div>
      <div style={statusCardStyle}>
        <p style={statusLineStyle}>{formatSyncStatus(syncStatus.lastStatus)}</p>
        {syncStatus.lastError ? (
          <p style={{ ...statusLineStyle, color: 'var(--color-danger)' }}>{syncStatus.lastError}</p>
        ) : null}
        {syncStatus.pendingConflict ? (
          <button type="button" onClick={onOpenConflict} style={secondaryButtonStyle}>
            查看同步冲突
          </button>
        ) : null}
      </div>
    </section>
  );
}

function formatSavedLabel(value: string | null) {
  return value ? `已保存 ${formatDateLabel(value)}` : '';
}

function formatSyncStatus(status: string | null) {
  switch (status) {
    case 'disabled':
      return '未启用';
    case 'noop':
      return '已是最新';
    case 'local-cache':
      return '已使用本地缓存';
    case 'pulled':
      return '已同步';
    case 'pushed':
      return '已同步';
    case 'conflict':
      return '存在冲突';
    case 'download-error':
      return '下载失败';
    case 'upload-error':
      return '上传失败';
    case 'validation-error':
      return '数据校验失败';
    default:
      return '空闲';
  }
}

function formatDateLabel(isoText: string): string {
  const date = new Date(isoText);
  if (Number.isNaN(date.getTime())) {
    return isoText;
  }

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function pad(value: number): string {
  return value < 10 ? `0${value}` : `${value}`;
}

function Field({
  label,
  children
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label style={{ display: 'grid', gap: '8px' }}>
      <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-ink-soft)' }}>
        {label}
      </span>
      {children}
    </label>
  );
}

const sectionStyle = {
  display: 'grid',
  gap: '16px',
  padding: '18px',
  borderRadius: 'var(--radius-card)',
  background: 'var(--color-card)',
  border: '1px solid var(--color-line)'
} satisfies React.CSSProperties;

const sectionHeaderStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  gap: '12px'
} satisfies React.CSSProperties;

const headingStyle = {
  margin: 0,
  fontSize: '20px',
  color: 'var(--color-ink-strong)'
} satisfies React.CSSProperties;

const helperStyle = {
  margin: '8px 0 0',
  lineHeight: 1.5,
  color: 'var(--color-ink-soft)'
} satisfies React.CSSProperties;

const toggleStyle = {
  display: 'grid',
  justifyItems: 'center',
  gap: '6px',
  fontWeight: 600,
  color: 'var(--color-ink-soft)'
} satisfies React.CSSProperties;

const checkboxStyle = {
  width: '16px',
  height: '16px',
  accentColor: 'var(--color-brand)',
  cursor: 'pointer'
} satisfies React.CSSProperties;

function toggleCaptionStyle(enabled: boolean): React.CSSProperties {
  return {
    fontSize: '12px',
    color: enabled ? 'var(--color-brand)' : 'var(--color-ink-soft)'
  };
}

const gridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: '12px'
} satisfies React.CSSProperties;

const inputStyle = {
  width: '100%',
  minHeight: '42px',
  padding: '10px 12px',
  borderRadius: '14px',
  border: '1px solid var(--color-line)',
  background: 'var(--color-input)',
  color: 'var(--color-ink-strong)'
} satisfies React.CSSProperties;

const statusCardStyle = {
  display: 'grid',
  gap: '8px',
  padding: '14px',
  borderRadius: '16px',
  background: 'var(--color-card-muted)'
} satisfies React.CSSProperties;

const statusLineStyle = {
  margin: 0,
  lineHeight: 1.5,
  color: 'var(--color-ink-soft)'
} satisfies React.CSSProperties;

const secondaryButtonStyle = {
  justifySelf: 'start',
  minWidth: '180px',
  minHeight: '38px',
  padding: '0 14px',
  borderRadius: '12px',
  background: 'var(--color-card)',
  border: '1px solid var(--color-line)',
  color: 'var(--color-brand-strong)',
  cursor: 'pointer'
} satisfies React.CSSProperties;

