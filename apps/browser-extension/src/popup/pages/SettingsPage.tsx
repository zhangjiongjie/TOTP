import { useEffect, useState } from 'react';
import { WebDavForm } from '../components/forms/WebDavForm';
import { ImportExportPanel } from '../components/forms/ImportExportPanel';
import { SyncConflictDialog } from '../components/dialogs/SyncConflictDialog';
import { PopupShell } from '../components/layout/PopupShell';
import { TopBar } from '../components/layout/TopBar';
import {
  canRegisterWebAuthnUnlock,
  disableWebAuthnUnlock,
  enableWebAuthnUnlock,
  loadSecurityPreferences,
  updateRememberSessionUntilBrowserRestart
} from '../../services/security-preferences-service';
import {
  settingsService,
  type SettingsSnapshot
} from '../../services/settings-service';
import { getCurrentMasterPassword } from '../../state/master-password-store';
import { refreshAppSyncSnapshot } from '../../state/app-store';
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
  const [webAuthnUnlockEnabled, setWebAuthnUnlockEnabled] = useState(false);

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
    setWebAuthnUnlockEnabled(preferences.webAuthnUnlockEnabled);
  }

  async function handleSaveWebDav(profile: WebDavProfile) {
    setIsSavingWebDav(true);
    setWebDavMessage('');

    try {
      await settingsService.saveWebDavProfile(profile);
      await refreshAppSyncSnapshot();
      await refreshSnapshot();
      setWebDavMessage(
        profile.enabled
          ? '已启用 WebDAV 同步'
          : '已关闭 WebDAV 同步'
      );
    } catch (error) {
      setWebDavMessage(error instanceof Error ? error.message : '保存失败。');
    } finally {
      setIsSavingWebDav(false);
    }
  }

  async function handleExport(options: { mode: 'plain' | 'encrypted'; password?: string }) {
    setIsImportExportBusy(true);
    setImportExportMessage('');

    try {
      const exported = await settingsService.exportVault({
        ...options,
        password: resolveBackupPassword(options.mode)
      });
      triggerDownload(exported.filename, exported.content);
      setImportExportMessage('已导出');
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
      const result = await settingsService.importVault(file, {
        ...options,
        password: getCurrentMasterPassword() ?? undefined
      });
      setImportExportMessage(`已导入 ${result.importedCount} 个账号`);
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

  async function handleWebAuthnPreferenceChange(enabled: boolean) {
    setIsSavingSecurity(true);
    setSecurityMessage('');

    try {
      const preferences = enabled
        ? await enableWebAuthnUnlock(resolveCurrentMasterPassword())
        : await disableWebAuthnUnlock();

      setRememberSessionUntilBrowserRestart(preferences.rememberSessionUntilBrowserRestart);
      setWebAuthnUnlockEnabled(preferences.webAuthnUnlockEnabled);
      setSecurityMessage(
        enabled ? '已开启 Windows Hello 解锁。' : '已关闭 Windows Hello 解锁。'
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
            title="设置"
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
                <img src="icons/action_back.svg" alt="" aria-hidden="true" style={{ width: '22px', height: '22px' }} />
              </button>
            }
          />
        }
      >
        <div style={pageBodyStyle}>
          <section style={panelStyle}>
            <div>
              <h2 style={panelHeadingStyle}>保持解锁</h2>
              <p style={panelHelperStyle}>浏览器重启前无需再次输入主密码。</p>
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
              启用
            </label>
          </section>
          <section style={panelStyle}>
            <div>
              <h2 style={panelHeadingStyle}>Windows Hello 解锁</h2>
              <p style={panelHelperStyle}>开启后可用 PIN、人脸或指纹解锁。</p>
            </div>
            <label
              style={{
                ...securityToggleStyle,
                color: webAuthnUnlockEnabled
                  ? 'var(--color-brand-strong)'
                  : 'var(--color-ink-soft)'
              }}
            >
              <input
                type="checkbox"
                checked={webAuthnUnlockEnabled}
                disabled={
                  isSavingSecurity ||
                  (!webAuthnUnlockEnabled && !canRegisterWebAuthnUnlock())
                }
                onChange={(event) =>
                  void handleWebAuthnPreferenceChange(event.target.checked)
                }
              />
              {webAuthnUnlockEnabled ? '已启用' : '未启用'}
            </label>
            {!webAuthnUnlockEnabled && !canRegisterWebAuthnUnlock() ? (
              <p style={panelMessageStyle}>当前浏览器不支持。</p>
            ) : null}
          </section>
          {securityMessage ? <p style={panelMessageStyle}>{securityMessage}</p> : null}
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

function resolveBackupPassword(mode: 'plain' | 'encrypted') {
  if (mode === 'plain') {
    return undefined;
  }

  const password = getCurrentMasterPassword();
  if (!password) {
    throw new Error('请先解锁');
  }

  return password;
}

function resolveCurrentMasterPassword() {
  const password = getCurrentMasterPassword();

  if (!password) {
    throw new Error('请先解锁');
  }

  return password;
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
  width: '42px',
  height: '42px',
  display: 'grid',
  placeItems: 'center',
  borderRadius: '50%',
  background: 'var(--color-card-muted)',
  border: '1px solid var(--color-line)',
  cursor: 'pointer'
} satisfies React.CSSProperties;

const panelStyle = {
  display: 'grid',
  gap: '14px',
  padding: '18px',
  borderRadius: 'var(--radius-card)',
  background: 'var(--color-card)',
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
