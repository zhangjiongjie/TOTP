import webDavVaultSyncAlgorithmsTest from './WebDavVaultSyncAlgorithms.test';
import masterPasswordChangeResultPolicyTest from './MasterPasswordChangeResultPolicy.test';
import remoteVaultCryptoServiceTest from './RemoteVaultCryptoService.test';

export default function testsuite(): void {
  webDavVaultSyncAlgorithmsTest();
  masterPasswordChangeResultPolicyTest();
  remoteVaultCryptoServiceTest();
}

