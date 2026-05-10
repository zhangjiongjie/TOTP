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

  return (
    <section style={sectionStyle}>
      <div style={sectionHeaderStyle}>
        <div>
          <h2 style={headingStyle}>WebDAV Sync</h2>
          <p style={helperStyle}>
            Configure a WebDAV endpoint for encrypted vault syncing. The current popup uses the
            sync metadata store already wired in this branch.
          </p>
        </div>
        <label style={toggleStyle}>
          <input
            type="checkbox"
            checked={formState.enabled}
            onChange={(event) => updateField('enabled', event.target.checked)}
          />
          Enable sync
        </label>
      </div>
      <div style={gridStyle}>
        <Field label="WebDAV server URL">
          <input
            aria-label="WebDAV server URL"
            value={formState.baseUrl}
            onChange={(event) => updateField('baseUrl', event.target.value)}
            placeholder="https://dav.example.com/remote.php/dav/files/user"
            style={inputStyle}
          />
        </Field>
        <Field label="Remote file path">
          <input
            aria-label="Remote file path"
            value={formState.filePath}
            onChange={(event) => updateField('filePath', event.target.value)}
            placeholder="/totp/vault.json"
            style={inputStyle}
          />
        </Field>
        <Field label="Username">
          <input
            aria-label="Username"
            value={formState.username ?? ''}
            onChange={(event) => updateField('username', event.target.value)}
            placeholder="alice"
            style={inputStyle}
          />
        </Field>
        <Field label="Password">
          <input
            aria-label="Password"
            type="password"
            value={formState.password ?? ''}
            onChange={(event) => updateField('password', event.target.value)}
            placeholder="App password"
            style={inputStyle}
          />
        </Field>
        <Field label="Sync interval (minutes)">
          <input
            aria-label="Sync interval (minutes)"
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
        <p style={statusLineStyle}>Last sync: {syncStatus.lastSyncedAt ?? 'Never'}</p>
        <p style={statusLineStyle}>Last status: {syncStatus.lastStatus ?? 'idle'}</p>
        {syncStatus.lastError ? (
          <p style={{ ...statusLineStyle, color: '#9d4156' }}>Last error: {syncStatus.lastError}</p>
        ) : null}
        {syncStatus.pendingConflict ? (
          <button type="button" onClick={onOpenConflict} style={secondaryButtonStyle}>
            Review sync conflict
          </button>
        ) : null}
      </div>
      <button
        type="button"
        onClick={() => void onSubmit(formState)}
        disabled={isSaving}
        style={primaryButtonStyle}
      >
        {isSaving ? 'Saving...' : 'Save WebDAV settings'}
      </button>
      {message ? <p style={messageStyle}>{message}</p> : null}
    </section>
  );
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
  borderRadius: '22px',
  background: 'rgba(250, 252, 255, 0.92)',
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
  display: 'inline-flex',
  gap: '8px',
  alignItems: 'center',
  fontWeight: 600,
  color: 'var(--color-brand-strong)'
} satisfies React.CSSProperties;

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
  background: 'rgba(248, 251, 254, 0.94)',
  color: 'var(--color-ink-strong)'
} satisfies React.CSSProperties;

const statusCardStyle = {
  display: 'grid',
  gap: '8px',
  padding: '14px',
  borderRadius: '16px',
  background: 'rgba(238, 244, 249, 0.72)'
} satisfies React.CSSProperties;

const statusLineStyle = {
  margin: 0,
  lineHeight: 1.5,
  color: 'var(--color-ink-soft)'
} satisfies React.CSSProperties;

const primaryButtonStyle = {
  justifySelf: 'start',
  minWidth: '180px',
  padding: '13px 18px',
  borderRadius: '999px',
  background: 'linear-gradient(180deg, #386897 0%, #2c557d 100%)',
  color: '#f8fbff',
  fontWeight: 600,
  cursor: 'pointer'
} satisfies React.CSSProperties;

const secondaryButtonStyle = {
  justifySelf: 'start',
  minWidth: '180px',
  minHeight: '38px',
  padding: '0 14px',
  borderRadius: '12px',
  background: 'rgba(255, 255, 255, 0.9)',
  border: '1px solid var(--color-line)',
  color: 'var(--color-brand-strong)',
  cursor: 'pointer'
} satisfies React.CSSProperties;

const messageStyle = {
  margin: 0,
  lineHeight: 1.5,
  color: 'var(--color-ink-soft)'
} satisfies React.CSSProperties;
