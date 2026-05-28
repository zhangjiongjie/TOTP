import { WebDavSyncResult } from './WebDavSyncService';

export class MasterPasswordChangeResultPolicy {
  static resolveSuccessMessage(result: WebDavSyncResult): string {
    if (result.status === 'conflict' || result.status === 'blocked') {
      throw new Error(result.message);
    }
    if (result.status === 'pushed') {
      return result.message.length > 0 ? result.message : '主密码已修改并同步到 WebDAV。';
    }
    if (result.status === 'local') {
      return result.message.length > 0 ? result.message : '主密码已修改。';
    }
    throw new Error(result.message.length > 0 ? result.message : '主密码修改失败');
  }
}
