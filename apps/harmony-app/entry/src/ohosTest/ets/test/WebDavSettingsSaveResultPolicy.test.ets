import { describe, it, expect } from '@ohos/hypium';
import { LocalVault } from '../../../main/ets/model/LocalVault';
import { WebDavSettingsSaveOutcome, WebDavSettingsSaveResultPolicy } from '../../../main/ets/policies/WebDavSettingsSaveResultPolicy';
import { WebDavSyncResult } from '../../../main/ets/services/WebDavSyncService';

export default function webDavSettingsSaveResultPolicyTest(): void {
  describe('WebDavSettingsSaveResultPolicy', () => {
    it('returns synced vault when enabling WebDAV pulls remote data', 0, () => {
      let vault: LocalVault = new LocalVault(1, '2026-05-30T00:00:00.000Z', []);

      let outcome: WebDavSettingsSaveOutcome = WebDavSettingsSaveResultPolicy.resolve(
        true,
        new WebDavSyncResult('pulled', '已从 WebDAV 恢复远端版本。', vault)
      );

      expect(outcome.message).assertEqual('已从 WebDAV 恢复远端版本。');
      expect(outcome.syncedVault === vault).assertTrue();
      expect(outcome.alreadySynced).assertTrue();
    });

    it('marks disabled settings as not synced', 0, () => {
      let outcome: WebDavSettingsSaveOutcome = WebDavSettingsSaveResultPolicy.resolve(false, undefined);

      expect(outcome.message).assertEqual('WebDAV 同步未开启，本地模式。');
      expect(outcome.syncedVault === undefined).assertTrue();
      expect(outcome.alreadySynced).assertFalse();
    });
  });
}
