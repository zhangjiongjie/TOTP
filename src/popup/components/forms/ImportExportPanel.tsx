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
        <h2 style={headingStyle}>导入 / 导出</h2>
        <p style={helperStyle}>
          导出便携 JSON 备份，或从已有备份中恢复账号。加密模式会使用主密码保护备份文件。
        </p>
      </div>
      <div style={gridStyle}>
        <label style={{ display: 'grid', gap: '8px' }}>
          <span style={labelStyle}>备份格式</span>
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
        <label style={{ display: 'grid', gap: '8px' }}>
          <span style={labelStyle}>备份密码</span>
          <input
            aria-label="备份密码"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder={mode === 'encrypted' ? '加密备份时必填' : '可选'}
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
          导出备份
        </button>
        <label style={fileLabelStyle}>
          <span>{isBusy ? '导入中...' : '导入备份文件'}</span>
          <input
            aria-label="导入备份文件"
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
