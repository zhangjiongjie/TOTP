import { describe, it, expect } from '@ohos/hypium';
import {
  VAULT_IMPORT_FORMAT_ENCRYPTED_V1,
  VAULT_IMPORT_FORMAT_LOCAL_JSON,
  VAULT_IMPORT_FORMAT_PLAIN,
  VAULT_IMPORT_FORMAT_REMOTE_V2,
  VaultImportParser,
  VaultImportParseResult
} from '../../../main/ets/services/VaultImportParser';

export default function vaultImportParserTest(): void {
  describe('VaultImportParser', () => {
    it('parses plain export fixture', 0, () => {
      let raw: string = '{"mode":"plain","vault":{"version":1,"accounts":[{"id":"plain-1","issuer":"GitHub","accountName":"alice@example.com","secret":"JBSWY3DPEHPK3PXP","digits":6,"period":30,"algorithm":"SHA1","tags":["Work"],"iconKey":"github","updatedAt":"2026-05-28T00:00:00.000Z"}]}}';

      let parsed: VaultImportParseResult = VaultImportParser.parse(raw);

      expect(parsed.format).assertEqual(VAULT_IMPORT_FORMAT_PLAIN);
      expect(parsed.vault?.accounts.length).assertEqual(1);
      expect(parsed.vault?.accounts[0].groupName).assertEqual('Work');
    });

    it('parses local vault json fixture', 0, () => {
      let raw: string = '{"schemaVersion":1,"updatedAt":"2026-05-28T00:00:00.000Z","accounts":[]}';

      let parsed: VaultImportParseResult = VaultImportParser.parse(raw);

      expect(parsed.format).assertEqual(VAULT_IMPORT_FORMAT_LOCAL_JSON);
      expect(parsed.vault?.accounts.length).assertEqual(0);
    });

    it('recognizes encrypted v1 export metadata', 0, () => {
      let raw: string = '{"mode":"encrypted","encryptedVault":{"formatVersion":1,"kdf":{"name":"PBKDF2","iterations":310000,"hash":"SHA-256"},"cipher":"AES-GCM","salt":"salt","iv":"iv","ciphertext":"ciphertext","passwordVerifier":"verifier"}}';

      let parsed: VaultImportParseResult = VaultImportParser.parse(raw);

      expect(parsed.format).assertEqual(VAULT_IMPORT_FORMAT_ENCRYPTED_V1);
      expect(parsed.encryptedVault !== undefined).assertTrue();
    });

    it('recognizes remote v2 export metadata', 0, () => {
      let raw: string = '{"mode":"encrypted","encryptedVault":{"formatVersion":2,"vaultId":"remote-vault","kdf":{"name":"PBKDF2","iterations":310000,"hash":"SHA-256","salt":"salt"},"keyEncryption":{"cipher":"AES-GCM","iv":"key-iv","ciphertext":"key-ciphertext"},"vaultEncryption":{"cipher":"AES-GCM","iv":"vault-iv","ciphertext":"vault-ciphertext"}}}';

      let parsed: VaultImportParseResult = VaultImportParser.parse(raw);

      expect(parsed.format).assertEqual(VAULT_IMPORT_FORMAT_REMOTE_V2);
      expect(parsed.encryptedVault !== undefined).assertTrue();
    });
  });
}
