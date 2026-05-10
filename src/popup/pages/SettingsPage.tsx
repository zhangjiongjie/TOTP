import { useEffect, useState } from 'react';
import { WebDavForm } from '../components/forms/WebDavForm';
import { ImportExportPanel } from '../components/forms/ImportExportPanel';
import { SyncConflictDialog } from '../components/dialogs/SyncConflictDialog';
import { PopupShell } from '../components/layout/PopupShell';
import { TopBar } from '../components/layout/TopBar';
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
  const [isSavingWebDav, setIsSavingWebDav] = useState(false);
  const [isImportExportBusy, setIsImportExportBusy] = useState(false);
  const [isResolvingConflict, setIsResolvingConflict] = useState(false);
  const [conflictOpen, setConflictOpen] = useState(false);

  useEffect(() => {
    void refreshSnapshot();
  }, []);

  async function refreshSnapshot() {
    setSnapshot(await settingsService.getSnapshot());
  }

  async function handleSaveWebDav(profile: WebDavProfile) {
    setIsSavingWebDav(true);
    setWebDavMessage('');

    try {
      const saved = await settingsService.saveWebDavProfile(profile);
      setSnapshot((current) => ({ ...current, webDavProfile: saved }));
      setWebDavMessage('WebDAV settings saved.');
    } catch (error) {
      setWebDavMessage(error instanceof Error ? error.message : 'Unable to save WebDAV settings.');
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
      setImportExportMessage(`Exported ${exported.filename}.`);
    } catch (error) {
      setImportExportMessage(error instanceof Error ? error.message : 'Unable to export backup.');
    } finally {
      setIsImportExportBusy(false);
    }
  }

  async function handleImport(file: File, options: { password?: string }) {
    setIsImportExportBusy(true);
    setImportExportMessage('');

    try {
      const result = await settingsService.importVault(file, options);
      setImportExportMessage(`Imported ${result.importedCount} accounts from ${result.mode} backup.`);
      await refreshSnapshot();
    } catch (error) {
      setImportExportMessage(error instanceof Error ? error.message : 'Unable to import backup.');
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
      setConflictMessage(choice === 'local' ? 'Local revision kept.' : 'Remote revision applied.');
    } catch (error) {
      setConflictMessage(
        error instanceof Error ? error.message : 'Unable to resolve sync conflict.'
      );
    } finally {
      setIsResolvingConflict(false);
    }
  }

  return (
    <>
      <PopupShell
        topBar={
          <TopBar
            eyebrow="Settings"
            title="Backup and sync"
            subtitle="Manage WebDAV sync, portable backups, and any pending sync conflicts from one place."
            actions={
              <button
                type="button"
                aria-label="Back"
                onClick={() => {
                  if (onBack) {
                    onBack();
                    return;
                  }

                  window.location.hash = '#accounts';
                }}
                style={topActionStyle}
              >
                Back
              </button>
            }
          />
        }
      >
        <div style={pageBodyStyle}>
          <WebDavForm
            profile={snapshot.webDavProfile}
            syncStatus={snapshot.syncMetadata}
            isSaving={isSavingWebDav}
            message={webDavMessage}
            onSubmit={handleSaveWebDav}
            onOpenConflict={() => setConflictOpen(true)}
          />
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
        resolutionAvailable={false}
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
