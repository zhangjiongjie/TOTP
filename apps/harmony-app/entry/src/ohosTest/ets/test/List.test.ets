import webDavVaultSyncAlgorithmsTest from './WebDavVaultSyncAlgorithms.test';
import masterPasswordChangeResultPolicyTest from './MasterPasswordChangeResultPolicy.test';
import remoteVaultCryptoServiceTest from './RemoteVaultCryptoService.test';
import webDavSyncTriggerPolicyTest from './WebDavSyncTriggerPolicy.test';
import webDavSyncDecisionTest from './WebDavSyncDecision.test';
import totpCodeGeneratorTest from './TotpCodeGenerator.test';
import vaultImportParserTest from './VaultImportParser.test';
import transientInlineMessagePolicyTest from './TransientInlineMessagePolicy.test';
import webDavSettingsSaveResultPolicyTest from './WebDavSettingsSaveResultPolicy.test';
import syncResultPresentationPolicyTest from './SyncResultPresentationPolicy.test';
import homeStatusPresentationPolicyTest from './HomeStatusPresentationPolicy.test';
import homeRoutePolicyTest from './HomeRoutePolicy.test';
import webDavSyncCoordinatorTest from './WebDavSyncCoordinator.test';
import accountCopyPresentationPolicyTest from './AccountCopyPresentationPolicy.test';
import homeSyncUiStatePolicyTest from './HomeSyncUiStatePolicy.test';
import importBackupPasswordPromptPolicyTest from './ImportBackupPasswordPromptPolicy.test';
import homeTabsCompatibilityPolicyTest from './HomeTabsCompatibilityPolicy.test';
import appI18nTest from './AppI18n.test';
import settingsCheckboxVisualPolicyTest from './SettingsCheckboxVisualPolicy.test';

export default function testsuite(): void {
  webDavVaultSyncAlgorithmsTest();
  masterPasswordChangeResultPolicyTest();
  remoteVaultCryptoServiceTest();
  webDavSyncTriggerPolicyTest();
  webDavSyncDecisionTest();
  totpCodeGeneratorTest();
  vaultImportParserTest();
  transientInlineMessagePolicyTest();
  webDavSettingsSaveResultPolicyTest();
  syncResultPresentationPolicyTest();
  homeStatusPresentationPolicyTest();
  homeRoutePolicyTest();
  webDavSyncCoordinatorTest();
  accountCopyPresentationPolicyTest();
  homeSyncUiStatePolicyTest();
  importBackupPasswordPromptPolicyTest();
  homeTabsCompatibilityPolicyTest();
  appI18nTest();
}

