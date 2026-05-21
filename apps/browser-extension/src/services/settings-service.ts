import { importExportOps } from './import-export-service';
import { passwordOps } from './password-service';
import { webDavSettingsOps } from './webdav-settings-service';
import { syncSettingsOps } from './sync-settings-service';

export { type BackupMode, type SettingsSnapshot, type ExportVaultResult, type ImportVaultResult } from './settings-types';

export const settingsService = {
  getSnapshot: webDavSettingsOps.getSnapshot,
  saveWebDavProfile: webDavSettingsOps.saveWebDavProfile,
  exportVault: importExportOps.exportVault,
  importVault: importExportOps.importVault,
  runManualSync: syncSettingsOps.runManualSync,
  resolveConflict: syncSettingsOps.resolveConflict,
  changeMasterPassword: passwordOps.changeMasterPassword,
  verifyRemoteMasterPassword: passwordOps.verifyRemoteMasterPassword
};
