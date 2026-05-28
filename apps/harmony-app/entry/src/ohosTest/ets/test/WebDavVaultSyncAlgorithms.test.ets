import { describe, it, expect } from '@ohos/hypium';
import { LocalVault } from '../../../main/ets/model/LocalVault';
import { TotpAccount } from '../../../main/ets/model/TotpAccount';
import { WebDavVaultSyncAlgorithms } from '../../../main/ets/services/WebDavVaultSyncAlgorithms';

function createAccount(id: string, issuer: string, updatedAt: string): TotpAccount {
  return new TotpAccount(id, issuer, `${issuer}-user`, `${issuer}-secret`, 6, 30, 'SHA1', 'Default', issuer, updatedAt);
}

function createVault(accounts: TotpAccount[]): LocalVault {
  return new LocalVault(1, '2026-05-28T00:00:00.000Z', accounts);
}

export default function webDavVaultSyncAlgorithmsTest(): void {
  describe('WebDavVaultSyncAlgorithms', () => {
    it('creates stable fingerprints independent of account order and timestamps', 0, () => {
      let first: LocalVault = createVault([
        createAccount('2', 'GitHub', '2026-05-28T00:00:02.000Z'),
        createAccount('1', 'OpenAI', '2026-05-28T00:00:01.000Z')
      ]);
      let second: LocalVault = createVault([
        createAccount('1', 'OpenAI', '2026-05-29T00:00:01.000Z'),
        createAccount('2', 'GitHub', '2026-05-29T00:00:02.000Z')
      ]);

      expect(WebDavVaultSyncAlgorithms.createFingerprint(first)).assertEqual(
        WebDavVaultSyncAlgorithms.createFingerprint(second)
      );
    });

    it('merges independent local and remote account additions', 0, () => {
      let baseVault: LocalVault = createVault([createAccount('base', 'Base', '2026-05-28T00:00:00.000Z')]);
      let localVault: LocalVault = createVault([
        createAccount('local', 'Local', '2026-05-28T00:01:00.000Z'),
        createAccount('base', 'Base', '2026-05-28T00:00:00.000Z')
      ]);
      let remoteVault: LocalVault = createVault([
        createAccount('remote', 'Remote', '2026-05-28T00:02:00.000Z'),
        createAccount('base', 'Base', '2026-05-28T00:00:00.000Z')
      ]);

      let mergedVault: LocalVault | undefined = WebDavVaultSyncAlgorithms.mergeAccountLevelChanges(
        baseVault,
        localVault,
        remoteVault
      );

      expect(mergedVault !== undefined).assertTrue();
      expect(mergedVault?.accounts.length).assertEqual(3);
      expect(mergedVault?.accounts[0].id).assertEqual('remote');
      expect(mergedVault?.accounts[1].id).assertEqual('local');
      expect(mergedVault?.accounts[2].id).assertEqual('base');
    });

    it('reports a conflict when the same field changes differently on both sides', 0, () => {
      let baseVault: LocalVault = createVault([createAccount('shared', 'Base', '2026-05-28T00:00:00.000Z')]);
      let localVault: LocalVault = createVault([createAccount('shared', 'Local', '2026-05-28T00:01:00.000Z')]);
      let remoteVault: LocalVault = createVault([createAccount('shared', 'Remote', '2026-05-28T00:02:00.000Z')]);

      let mergedVault: LocalVault | undefined = WebDavVaultSyncAlgorithms.mergeAccountLevelChanges(
        baseVault,
        localVault,
        remoteVault
      );

      expect(mergedVault === undefined).assertTrue();
    });
  });
}
