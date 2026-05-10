import { useState } from 'react';
import type { BackupMode } from '../../../services/settings-service';

interface ImportExportPanelProps {
  isBusy?: boolean;
  message?: string;
  onExport: (options: { mode: BackupMode; password?: string }) => Promise<void> | void;
  onImport: (file: File, options: { password?: string }) => Promise<void> | void;
}

export function ImportExportPanel({
  isBusy = false,
  message,
  onExport,
  onImport
}: ImportExportPanelProps) {
  const [mode, setMode] = useState<BackupMode>('plain');
  const [password, setPassword] = useState('');

  return (
    <section style={sectionStyle}>
      <div>
        <h2 style={headingStyle}>Import / Export</h2>
        <p style={helperStyle}>
          Create a portable JSON backup or restore accounts from a previous export. Encrypted mode
          reuses the vault bundle helpers already present in the core layer.
        </p>
      </div>
      <div style={gridStyle}>
        <label style={{ display: 'grid', gap: '8px' }}>
          <span style={labelStyle}>Backup format</span>
          <select
            aria-label="Backup format"
            value={mode}
            onChange={(event) => setMode(event.target.value as BackupMode)}
            style={inputStyle}
          >
            <option value="plain">Plain JSON</option>
            <option value="encrypted">Encrypted JSON</option>
          </select>
        </label>
        <label style={{ display: 'grid', gap: '8px' }}>
          <span style={labelStyle}>Backup password</span>
          <input
            aria-label="Backup password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder={mode === 'encrypted' ? 'Required for encrypted backups' : 'Optional'}
            style={inputStyle}
          />
        </label>
      </div>
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={() => void onExport({ mode, password: password || undefined })}
          disabled={isBusy}
          style={primaryButtonStyle}
        >
          Export backup
        </button>
        <label style={fileLabelStyle}>
          <span>{isBusy ? 'Importing...' : 'Import backup file'}</span>
          <input
            aria-label="Import backup file"
            type="file"
            accept="application/json"
            disabled={isBusy}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (!file) {
                return;
              }

              void onImport(file, { password: password || undefined });
              event.currentTarget.value = '';
            }}
            style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }}
          />
        </label>
      </div>
      {message ? <p style={messageStyle}>{message}</p> : null}
    </section>
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

const labelStyle = {
  fontSize: '13px',
  fontWeight: 600,
  color: 'var(--color-ink-soft)'
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

const primaryButtonStyle = {
  minWidth: '160px',
  minHeight: '42px',
  padding: '0 16px',
  borderRadius: '999px',
  background: 'linear-gradient(180deg, #386897 0%, #2c557d 100%)',
  color: '#f8fbff',
  fontWeight: 600,
  cursor: 'pointer'
} satisfies React.CSSProperties;

const fileLabelStyle = {
  position: 'relative',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minWidth: '180px',
  minHeight: '42px',
  padding: '0 16px',
  borderRadius: '999px',
  background: 'rgba(238, 244, 249, 0.92)',
  border: '1px solid var(--color-line)',
  color: 'var(--color-brand-strong)',
  fontWeight: 600,
  cursor: 'pointer',
  overflow: 'hidden'
} satisfies React.CSSProperties;

const messageStyle = {
  margin: 0,
  lineHeight: 1.5,
  color: 'var(--color-ink-soft)'
} satisfies React.CSSProperties;
