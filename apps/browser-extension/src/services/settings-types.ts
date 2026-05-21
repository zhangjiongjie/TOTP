import { type WebDavProfile } from '@totp/sync';
import { type SyncMetadataSnapshot } from '@totp/sync';

export type BackupMode = 'plain' | 'encrypted';

export interface SettingsSnapshot {
  webDavProfile: WebDavProfile | null;
  syncMetadata: Pick<
    SyncMetadataSnapshot,
    'lastStatus' | 'lastSyncedAt' | 'lastError' | 'pendingConflict'
  >;
}

export interface ExportVaultResult {
  filename: string;
  content: string;
  mode: BackupMode;
}

export interface ImportVaultResult {
  importedCount: number;
  mode: BackupMode;
}
