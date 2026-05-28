import webDavVaultSyncAlgorithmsTest from './WebDavVaultSyncAlgorithms.test';
import masterPasswordChangeResultPolicyTest from './MasterPasswordChangeResultPolicy.test';
import remoteVaultCryptoServiceTest from './RemoteVaultCryptoService.test';
import webDavSyncTriggerPolicyTest from './WebDavSyncTriggerPolicy.test';
import webDavSyncDecisionTest from './WebDavSyncDecision.test';

export default function testsuite(): void {
  webDavVaultSyncAlgorithmsTest();
  masterPasswordChangeResultPolicyTest();
  remoteVaultCryptoServiceTest();
  webDavSyncTriggerPolicyTest();
  webDavSyncDecisionTest();
}

