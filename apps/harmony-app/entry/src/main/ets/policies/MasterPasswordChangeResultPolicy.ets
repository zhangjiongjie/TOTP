import { LocalVault } from '../model/LocalVault';
import { WebDavSyncResult } from '../services/WebDavSyncService';
import { AppI18n } from '../utils/AppI18n';

export class MasterPasswordChangeResultPolicy {
  static resolveSuccessMessage(result: WebDavSyncResult): string {
    if (result.status === 'conflict' || result.status === 'blocked') {
      throw new Error(result.message);
    }
    if (result.status === 'pushed') {
      return result.message.length > 0 ? result.message : AppI18n.globalString($r('app.string.master_password_changed_webdav'), 'Master password changed and synced to WebDAV.');
    }
    if (result.status === 'local') {
      return result.message.length > 0 ? result.message : AppI18n.globalString($r('app.string.master_password_changed'), 'Master password changed.');
    }
    throw new Error(result.message.length > 0 ? result.message : AppI18n.globalString($r('app.string.error_master_password_change_failed'), 'Failed to change master password'));
  }

  static resolveChangedVault(result: WebDavSyncResult): LocalVault | undefined {
    if (result.status === 'pushed' && result.vault !== undefined) {
      return result.vault;
    }
    return undefined;
  }
}
