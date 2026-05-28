import { describe, it, expect } from '@ohos/hypium';
import { LocalVault } from '../../../main/ets/model/LocalVault';
import { TotpAccount } from '../../../main/ets/model/TotpAccount';
import { EncryptedRemoteVaultBlob, RemoteVaultCryptoService, RemoteVaultDecryption } from '../../../main/ets/services/RemoteVaultCryptoService';

function createVault(): LocalVault {
  return new LocalVault(1, '2026-05-28T00:00:00.000Z', [
    new TotpAccount('account-1', 'OpenAI', 'user@example.com', 'JBSWY3DPEHPK3PXP', 6, 30, 'SHA1', 'Default', 'openai', '2026-05-28T00:00:00.000Z')
  ]);
}

function createVaultKey(): Uint8Array {
  let key: Uint8Array = new Uint8Array(32);
  for (let index: number = 0; index < key.length; index++) {
    key[index] = index + 1;
  }
  return key;
}

function captureErrorMessage(action: () => void): string {
  try {
    action();
  } catch (error) {
    let runtimeError: Error = error as Error;
    return runtimeError.message;
  }
  return '';
}

export default function remoteVaultCryptoServiceTest(): void {
  describe('RemoteVaultCryptoService', () => {
    it('encrypts a remote vault with an explicit password and existing vault key', 0, () => {
      let service: RemoteVaultCryptoService = new RemoteVaultCryptoService();
      let vaultKey: Uint8Array = createVaultKey();

      let encrypted: EncryptedRemoteVaultBlob = service.encryptWithPasswordAndVaultKey(createVault(), 'next-password', vaultKey);
      let decrypted: RemoteVaultDecryption = service.decryptWithPassword(encrypted, 'next-password');

      expect(decrypted.vault.accounts.length).assertEqual(1);
      expect(decrypted.vault.accounts[0].id).assertEqual('account-1');
      expect(decrypted.vaultKey.length).assertEqual(vaultKey.length);
      expect(decrypted.vaultKey[0]).assertEqual(vaultKey[0]);
      expect(decrypted.vaultKey[31]).assertEqual(vaultKey[31]);
    });

    it('does not allow the previous password to decrypt the new remote envelope', 0, () => {
      let service: RemoteVaultCryptoService = new RemoteVaultCryptoService();
      let encrypted: EncryptedRemoteVaultBlob = service.encryptWithPasswordAndVaultKey(createVault(), 'next-password', createVaultKey());

      let message: string = captureErrorMessage(() => {
        service.decryptWithPassword(encrypted, 'current-password');
      });

      expect(message.indexOf('解密 WebDAV 保管库失败') >= 0).assertTrue();
    });
  });
}