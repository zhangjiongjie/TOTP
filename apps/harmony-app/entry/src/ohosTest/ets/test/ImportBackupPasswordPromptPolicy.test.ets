import { describe, it, expect } from '@ohos/hypium';
import { ImportBackupPasswordPromptPolicy } from '../../../main/ets/policies/ImportBackupPasswordPromptPolicy';

export default function importBackupPasswordPromptPolicyTest(): void {
  describe('ImportBackupPasswordPromptPolicy', () => {
    it('prompts when encrypted backup cannot be decrypted with current password', 0, () => {
      expect(ImportBackupPasswordPromptPolicy.shouldPromptForPassword('导入加密备份失败：备份密码与当前主密码不匹配。')).assertTrue();
      expect(ImportBackupPasswordPromptPolicy.shouldPromptForPassword('解密 WebDAV 保管库失败：WebDAV AES-GCM 解密失败')).assertTrue();
    });

    it('does not prompt for non-decryption import failures', 0, () => {
      expect(ImportBackupPasswordPromptPolicy.shouldPromptForPassword('未选择备份文件。')).assertFalse();
      expect(ImportBackupPasswordPromptPolicy.shouldPromptForPassword('明文备份内容无效。')).assertFalse();
    });
  });
}
