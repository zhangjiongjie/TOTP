import webDavVaultSyncAlgorithmsTest from './WebDavVaultSyncAlgorithms.test';
import masterPasswordChangeResultPolicyTest from './MasterPasswordChangeResultPolicy.test';
import remoteVaultCryptoServiceTest from './RemoteVaultCryptoService.test';
import webDavSyncTriggerPolicyTest from './WebDavSyncTriggerPolicy.test';
import webDavSyncDecisionTest from './WebDavSyncDecision.test';
import totpCodeGeneratorTest from './TotpCodeGenerator.test';
import vaultImportParserTest from './VaultImportParser.test';
import transientInlineMessagePolicyTest from './TransientInlineMessagePolicy.test';

export default function testsuite(): void {
  webDavVaultSyncAlgorithmsTest();
  masterPasswordChangeResultPolicyTest();
  remoteVaultCryptoServiceTest();
  webDavSyncTriggerPolicyTest();
  webDavSyncDecisionTest();
  totpCodeGeneratorTest();
  vaultImportParserTest();
  transientInlineMessagePolicyTest();
}

