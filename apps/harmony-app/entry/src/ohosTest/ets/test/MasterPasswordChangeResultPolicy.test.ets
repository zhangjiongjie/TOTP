import { describe, it, expect } from '@ohos/hypium';
import { LocalVault } from '../../../main/ets/model/LocalVault';
import { WebDavSyncResult } from '../../../main/ets/services/WebDavSyncService';
import { MasterPasswordChangeResultPolicy } from '../../../main/ets/policies/MasterPasswordChangeResultPolicy';

function captureErrorMessage(action: () => void): string {
  try {
    action();
  } catch (error) {
    let runtimeError: Error = error as Error;
    return runtimeError.message;
  }
  return '';
}

export default function masterPasswordChangeResultPolicyTest(): void {
  describe('MasterPasswordChangeResultPolicy', () => {
    it('treats conflict result as password change failure', 0, () => {
      let message: string = captureErrorMessage(() => {
        MasterPasswordChangeResultPolicy.resolveSuccessMessage(
          new WebDavSyncResult('conflict', '主密码未修改：本地和远端都发生了变化，请先解决冲突后再修改主密码。')
        );
      });

      expect(message).assertEqual('主密码未修改：本地和远端都发生了变化，请先解决冲突后再修改主密码。');
    });

    it('treats blocked result as password change failure', 0, () => {
      let message: string = captureErrorMessage(() => {
        MasterPasswordChangeResultPolicy.resolveSuccessMessage(
          new WebDavSyncResult('blocked', '远端保管库需要主密码验证后才能继续同步。')
        );
      });

      expect(message).assertEqual('远端保管库需要主密码验证后才能继续同步。');
    });

    it('keeps pushed result message as success text', 0, () => {
      let message: string = MasterPasswordChangeResultPolicy.resolveSuccessMessage(
        new WebDavSyncResult('pushed', '主密码已修改并同步到 WebDAV。')
      );

      expect(message).assertEqual('主密码已修改并同步到 WebDAV。');
    });

    it('keeps local result as local success text', 0, () => {
      let message: string = MasterPasswordChangeResultPolicy.resolveSuccessMessage(
        new WebDavSyncResult('local', '主密码已修改。')
      );

      expect(message).assertEqual('主密码已修改。');
    });

    it('returns changed vault from successful password sync result', 0, () => {
      let vault: LocalVault = new LocalVault(1, '2026-05-28T00:00:00.000Z', []);
      let changedVault: LocalVault | undefined = MasterPasswordChangeResultPolicy.resolveChangedVault(
        new WebDavSyncResult('pushed', '主密码已修改并同步到 WebDAV。', vault)
      );

      expect(changedVault === vault).assertTrue();
    });

    it('does not return changed vault when password change only rewrites local key', 0, () => {
      let changedVault: LocalVault | undefined = MasterPasswordChangeResultPolicy.resolveChangedVault(
        new WebDavSyncResult('local', '主密码已修改。')
      );

      expect(changedVault === undefined).assertTrue();
    });
  });
}
