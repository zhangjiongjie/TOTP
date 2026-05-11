import { useEffect, useState } from 'react';
import { WebDavForm } from '../components/forms/WebDavForm';
import { ImportExportPanel } from '../components/forms/ImportExportPanel';
import { SyncConflictDialog } from '../components/dialogs/SyncConflictDialog';
import { PopupShell } from '../components/layout/PopupShell';
import { TopBar } from '../components/layout/TopBar';
import {
  loadSecurityPreferences,
  updateRememberSessionUntilBrowserRestart
} from '../../services/security-preferences-service';
import {
  settingsService,
  type SettingsSnapshot
} from '../../services/settings-service';
import type { PendingSyncConflict } from '../../core/sync/conflict';
import type { WebDavProfile } from '../../core/sync/webdav-client';

const emptySnapshot: SettingsSnapshot = {
  webDavProfile: null,
  syncMetadata: {
    lastStatus: null,
    lastSyncedAt: null,
    lastError: null,
    pendingConflict: null
  }
};

interface SettingsPageProps {
  onBack?: () => void;
}

export function SettingsPage({ onBack }: SettingsPageProps = {}) {
  const [snapshot, setSnapshot] = useState<SettingsSnapshot>(emptySnapshot);
  const [webDavMessage, setWebDavMessage] = useState('');
  const [importExportMessage, setImportExportMessage] = useState('');
  const [conflictMessage, setConflictMessage] = useState('');
  const [securityMessage, setSecurityMessage] = useState('');
  const [isSavingWebDav, setIsSavingWebDav] = useState(false);
  const [isImportExportBusy, setIsImportExportBusy] = useState(false);
  const [isResolvingConflict, setIsResolvingConflict] = useState(false);
  const [isSavingSecurity, setIsSavingSecurity] = useState(false);
  const [conflictOpen, setConflictOpen] = useState(false);
  const [rememberSessionUntilBrowserRestart, setRememberSessionUntilBrowserRestart] =
    useState(true);

  useEffect(() => {
    void refreshSnapshot();
    void refreshSecurityPreferences();
  }, []);

  async function refreshSnapshot() {
    setSnapshot(await settingsService.getSnapshot());
  }

  async function refreshSecurityPreferences() {
    const preferences = await loadSecurityPreferences();
    setRememberSessionUntilBrowserRestart(preferences.rememberSessionUntilBrowserRestart);
  }

  async function handleSaveWebDav(profile: WebDavProfile) {
    setIsSavingWebDav(true);
    setWebDavMessage('');

    try {
      await settingsService.saveWebDavProfile(profile);
      await refreshSnapshot();
      setWebDavMessage(
        profile.enabled
          ? 'WebDAV 设置已保存并启用。'
          : 'WebDAV 设置已保存，当前仍为本地模式。'
      );
    } catch (error) {
      setWebDavMessage(error instanceof Error ? error.message : '无法保存 WebDAV 设置。');
    } finally {
      setIsSavingWebDav(false);
    }
  }

  async function handleExport(options: { mode: 'plain' | 'encrypted'; password?: string }) {
    setIsImportExportBusy(true);
    setImportExportMessage('');

    try {
      const exported = await settingsService.exportVault(options);
      triggerDownload(exported.filename, exported.content);
      setImportExportMessage(`已导出 ${exported.filename}。`);
    } catch (error) {
      setImportExportMessage(error instanceof Error ? error.message : '无法导出备份。');
    } finally {
      setIsImportExportBusy(false);
    }
  }

  async function handleImport(file: File, options: { password?: string }) {
    setIsImportExportBusy(true);
    setImportExportMessage('');

    try {
      const result = await settingsService.importVault(file, options);
      setImportExportMessage(`已从${result.mode === 'encrypted' ? '加密' : '明文'}备份导入 ${result.importedCount} 个账号。`);
      await refreshSnapshot();
    } catch (error) {
      setImportExportMessage(error instanceof Error ? error.message : '无法导入备份。');
    } finally {
      setIsImportExportBusy(false);
    }
  }

  async function handleResolveConflict(choice: 'local' | 'remote') {
    const pendingConflict = snapshot.syncMetadata.pendingConflict;

    if (!pendingConflict) {
      return;
    }

    setIsResolvingConflict(true);
    setConflictMessage('');

    try {
      await settingsService.resolveConflict(pendingConflict, choice);
      await refreshSnapshot();
      setConflictOpen(false);
      setConflictMessage(choice === 'local' ? '已保留本地版本。' : '已应用远端版本。');
    } catch (error) {
      setConflictMessage(
        error instanceof Error ? error.message : '无法处理同步冲突。'
      );
    } finally {
      setIsResolvingConflict(false);
    }
  }

  async function handleRememberPreferenceChange(enabled: boolean) {
    setIsSavingSecurity(true);
    setSecurityMessage('');

    try {
      const preferences = await updateRememberSessionUntilBrowserRestart(enabled);
      setRememberSessionUntilBrowserRestart(preferences.rememberSessionUntilBrowserRestart);
      setSecurityMessage(
        enabled
          ? '已开启浏览器重启前保持解锁。'
          : '已关闭保持解锁，关闭弹窗后将再次要求输入主密码。'
      );
    } catch (error) {
      setSecurityMessage(error instanceof Error ? error.message : '无法更新解锁策略。');
    } finally {
      setIsSavingSecurity(false);
    }
  }

  return (
    <>
      <PopupShell
        topBar={
          <TopBar
            eyebrow="设置"
            title="备份与同步"
            subtitle="集中管理 WebDAV 同步、导入导出备份，以及浏览器内的解锁体验。"
            actions={
              <button
                type="button"
                aria-label="返回"
                onClick={() => {
                  if (onBack) {
                    onBack();
                    return;
                  }

                  window.location.hash = '#accounts';
                }}
                style={topActionStyle}
              >
                返回
              </button>
            }
          />
        }
      >
        <div style={pageBodyStyle}>
          <section style={panelStyle}>
            <div>
              <h2 style={panelHeadingStyle}>解锁策略</h2>
              <p style={panelHelperStyle}>
                默认会在浏览器重启后再次要求输入主密码；浏览器未重启时，可保持当前会话已解锁。
              </p>
            </div>
            <label style={securityToggleStyle}>
              <input
                type="checkbox"
                checked={rememberSessionUntilBrowserRestart}
                disabled={isSavingSecurity}
                onChange={(event) =>
                  void handleRememberPreferenceChange(event.target.checked)
                }
              />
              浏览器重启前保持解锁
            </label>
            {securityMessage ? <p style={panelMessageStyle}>{securityMessage}</p> : null}
          </section>
          <WebDavForm
            profile={snapshot.webDavProfile}
            syncStatus={snapshot.syncMetadata}
            isSaving={isSavingWebDav}
            message={webDavMessage}
            onSubmit={handleSaveWebDav}
            onOpenConflict={() => {
              setConflictMessage('');
              setConflictOpen(true);
            }}
          />
          {conflictMessage ? (
            <p style={panelMessageStyle}>{conflictMessage}</p>
          ) : null}
          <ImportExportPanel
            isBusy={isImportExportBusy}
            message={importExportMessage}
            onExport={handleExport}
            onImport={handleImport}
          />
        </div>
      </PopupShell>
      <SyncConflictDialog
        open={conflictOpen}
        conflict={snapshot.syncMetadata.pendingConflict as PendingSyncConflict | null}
        isResolving={isResolvingConflict}
        message={conflictMessage}
        resolutionAvailable
        onClose={() => setConflictOpen(false)}
        onResolve={handleResolveConflict}
      />
    </>
  );
}

function triggerDownload(filename: string, content: string) {
  if (typeof URL.createObjectURL !== 'function') {
    return;
  }

  const blob = new Blob([content], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

const pageBodyStyle = {
  width: '100%',
  display: 'grid',
  gap: '16px',
  flex: 1,
  minHeight: 0,
  paddingRight: '4px',
  overflowY: 'auto',
  alignContent: 'start'
} satisfies React.CSSProperties;

const topActionStyle = {
  minWidth: '74px',
  height: '36px',
  padding: '0 12px',
  borderRadius: '12px',
  background: 'rgba(238, 244, 249, 0.96)',
  border: '1px solid var(--color-line)',
  color: 'var(--color-brand-strong)',
  cursor: 'pointer'
} satisfies React.CSSProperties;

const panelStyle = {
  display: 'grid',
  gap: '14px',
  padding: '18px',
  borderRadius: '22px',
  background: 'rgba(250, 252, 255, 0.92)',
  border: '1px solid var(--color-line)'
} satisfies React.CSSProperties;

const panelHeadingStyle = {
  margin: 0,
  fontSize: '20px',
  color: 'var(--color-ink-strong)'
} satisfies React.CSSProperties;

const panelHelperStyle = {
  margin: '8px 0 0',
  lineHeight: 1.5,
  color: 'var(--color-ink-soft)'
} satisfies React.CSSProperties;

const securityToggleStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '10px',
  color: 'var(--color-brand-strong)',
  fontWeight: 600
} satisfies React.CSSProperties;

const panelMessageStyle = {
  margin: 0,
  lineHeight: 1.5,
  color: 'var(--color-ink-soft)'
} satisfies React.CSSProperties;
