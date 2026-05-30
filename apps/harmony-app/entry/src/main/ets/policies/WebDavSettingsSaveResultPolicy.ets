import { LocalVault } from '../model/LocalVault';
import { WebDavSyncResult } from '../services/WebDavSyncService';

export class WebDavSettingsSaveOutcome {
  status: string;
  message: string;
  syncedVault: LocalVault | undefined;
  alreadySynced: boolean;

  constructor(status: string, message: string, syncedVault: LocalVault | undefined, alreadySynced: boolean) {
    this.status = status;
    this.message = message;
    this.syncedVault = syncedVault;
    this.alreadySynced = alreadySynced;
  }
}

export class WebDavSettingsSaveResultPolicy {
  static resolve(enabled: boolean, syncResult: WebDavSyncResult | undefined): WebDavSettingsSaveOutcome {
    if (!enabled) {
      return new WebDavSettingsSaveOutcome('disabled', 'WebDAV 同步未开启，本地模式。', undefined, false);
    }
    if (syncResult === undefined) {
      return new WebDavSettingsSaveOutcome('enabled', '已启用 WebDAV 同步', undefined, false);
    }
    return new WebDavSettingsSaveOutcome(syncResult.status, syncResult.message, syncResult.vault, true);
  }
}
