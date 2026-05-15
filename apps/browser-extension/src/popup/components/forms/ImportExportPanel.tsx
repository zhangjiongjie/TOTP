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

  return (
    <section style={sectionStyle}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <h2 style={headingStyle}>导入 / 导出</h2>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '10px' }}>
          <button
            type="button"
            aria-label="导出"
            title="导出"
            onClick={() => void onExport({ mode })}
            disabled={isBusy}
            style={iconButtonStyle}
          >
            <img src="icons/backup_export.svg" alt="" aria-hidden="true" style={{ width: '22px', height: '22px' }} />
          </button>
          <label style={fileLabelStyle} title="导入">
            <img src="icons/backup_import.svg" alt="" aria-hidden="true" style={{ width: '22px', height: '22px' }} />
            <input
              aria-label="导入"
              type="file"
              accept="application/json"
              disabled={isBusy}
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (!file) {
                  return;
                }

                void onImport(file, {});
                event.currentTarget.value = '';
              }}
              style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }}
            />
          </label>
        </div>
      </div>
      <label style={{ display: 'grid', gap: '8px' }}>
          <span style={labelStyle}>格式</span>
          <select
            aria-label="备份格式"
            value={mode}
            onChange={(event) => setMode(event.target.value as BackupMode)}
            style={inputStyle}
          >
            <option value="plain">明文 JSON</option>
            <option value="encrypted">加密 JSON</option>
          </select>
      </label>
      {message ? <p style={messageStyle}>{message}</p> : null}
    </section>
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

const headingStyle = {
  margin: 0,
  fontSize: '20px',
  color: 'var(--color-ink-strong)'
} satisfies React.CSSProperties;

const labelStyle = {
  fontSize: '13px',
  fontWeight: 600,
  color: 'var(--color-ink-soft)'
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

const iconButtonStyle = {
  width: '42px',
  height: '42px',
  display: 'grid',
  placeItems: 'center',
  borderRadius: '50%',
  background: 'var(--color-card-muted)',
  border: '1px solid var(--color-line)',
  cursor: 'pointer'
} satisfies React.CSSProperties;

const fileLabelStyle = {
  position: 'relative',
  width: '42px',
  height: '42px',
  display: 'grid',
  placeItems: 'center',
  borderRadius: '50%',
  background: 'var(--color-card-muted)',
  border: '1px solid var(--color-line)',
  cursor: 'pointer',
  overflow: 'hidden'
} satisfies React.CSSProperties;

const messageStyle = {
  margin: 0,
  lineHeight: 1.5,
  color: 'var(--color-ink-soft)'
} satisfies React.CSSProperties;
