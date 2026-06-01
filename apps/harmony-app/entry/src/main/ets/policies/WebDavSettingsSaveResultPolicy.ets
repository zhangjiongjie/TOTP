import { LocalVault } from '../model/LocalVault';
import { WebDavSyncResult } from '../services/WebDavSyncService';
import { AppI18n } from '../utils/AppI18n';

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
      return new WebDavSettingsSaveOutcome('disabled', AppI18n.globalString($r('app.string.home_sync_disabled_status'), 'WebDAV sync is off. Local mode.'), undefined, false);
    }
    if (syncResult === undefined) {
      return new WebDavSettingsSaveOutcome('enabled', AppI18n.globalString($r('app.string.webdav_sync_enabled'), 'WebDAV sync enabled'), undefined, false);
    }
    return new WebDavSettingsSaveOutcome(syncResult.status, syncResult.message, syncResult.vault, true);
  }
}
