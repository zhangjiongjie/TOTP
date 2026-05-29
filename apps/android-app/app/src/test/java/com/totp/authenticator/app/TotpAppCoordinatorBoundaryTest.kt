package com.totp.authenticator.app

import java.io.File
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class TotpAppCoordinatorBoundaryTest {
    @Test
    fun totpAppDoesNotOwnHeavyBusinessFlowFunctions() {
        val source = File("src/main/java/com/totp/authenticator/app/TotpApp.kt").readText()

        listOf(
            "fun exportBackupWithPassword(",
            "fun exportBackupWithVaultKey(",
            "fun importBackupFromUri(",
            "fun importBackupFromContent(",
            "fun syncWebDavWithPassword(",
            "fun syncWebDavAfterUnlock(",
            "fun syncWebDavAfterLocalChange(",
            "fun syncWebDavFromHome(",
            "fun startBiometricUnlock(",
            "fun enableBiometricUnlock(",
            "fun disableBiometricUnlock(",
            "fun refreshQuickUnlockCredentialIfNeeded(",
            "fun saveAccount(",
            "fun deleteAccount(",
            "val syncWebDavWithPassword:",
            "val exportBackupWithPassword:",
            "val exportBackupWithVaultKey:",
            "lateinit var importBackupFromContent",
            "lateinit var quickUnlockActions",
            "val syncWebDavAfterUnlock:",
            "val syncWebDavAfterLocalChange:",
            "val syncWebDavFromHome:",
            "val startBiometricUnlock:",
            "val enableBiometricUnlock:",
            "val disableBiometricUnlock:",
            "val refreshQuickUnlockCredentialIfNeeded:"
        ).forEach { functionName ->
            assertFalse("$functionName should live outside TotpApp", source.contains(functionName))
        }

        listOf(
            "webDavSyncService.saveSettings(",
            "webDavSyncService.testConnection(",
            "webDavSyncService.syncPasswordChange(",
            "repository.changePassword(",
            "repository.exportVaultKey(nextPassword)",
            "repository.update(",
            "repository.updateWithVaultKey("
        ).forEach { businessCall ->
            assertFalse("$businessCall should live in a coordinator", source.contains(businessCall))
        }
    }

    @Test
    fun coordinatorFilesOwnBusinessFlowBoundaries() {
        val appDir = File("src/main/java/com/totp/authenticator/app")

        assertTrue(File(appDir, "BackupFlowCoordinator.kt").exists())
        assertTrue(File(appDir, "BackupActionCoordinator.kt").exists())
        assertTrue(File(appDir, "BackupPickerBridge.kt").exists())
        assertTrue(File(appDir, "WebDavFlowCoordinator.kt").exists())
        assertTrue(File(appDir, "QuickUnlockCoordinator.kt").exists())
        assertTrue(File(appDir, "QuickUnlockActionCoordinator.kt").exists())
        assertTrue(File(appDir, "QuickUnlockCredentialRefresher.kt").exists())
        assertTrue(File(appDir, "QuickUnlockPromptBridge.kt").exists())
        assertTrue(File(appDir, "QrImportBridge.kt").exists())
        assertTrue(File(appDir, "HomeSyncActionCoordinator.kt").exists())
        assertTrue(File(appDir, "UnlockActionCoordinator.kt").exists())
        assertTrue(File(appDir, "VaultAccountActionCoordinator.kt").exists())
        assertTrue(File(appDir, "VaultAccountViewModel.kt").exists())
        assertTrue(File(appDir, "BackupViewModel.kt").exists())
        assertTrue(File(appDir, "SyncViewModel.kt").exists())
        assertTrue(File(appDir, "QuickUnlockViewModel.kt").exists())
        assertTrue(File(appDir, "SettingsViewModel.kt").exists())
        assertTrue(File(appDir, "SettingsActionCoordinator.kt").exists())
        assertTrue(File(appDir, "PasswordChangeViewModel.kt").exists())
        assertTrue(File(appDir, "UnlockViewModel.kt").exists())
    }

    @Test
    fun webDavUiStateLivesInSyncViewModel() {
        val source = File("src/main/java/com/totp/authenticator/app/TotpApp.kt").readText()

        listOf(
            "var webDavSettings",
            "var webDavMetadata",
            "var webDavBusy",
            "var homeCopyStatusMessage",
            "var homeErrorStatusMessage",
            "var webDavStatusMessage",
            "var webDavStatusIsError",
            "var hasSyncedAfterUnlock"
        ).forEach { stateDeclaration ->
            assertFalse("$stateDeclaration should live in SyncViewModel", source.contains(stateDeclaration))
        }

        assertTrue(File("src/main/java/com/totp/authenticator/app/SyncViewModel.kt").exists())
    }

    @Test
    fun backupAndQuickUnlockUiStateLiveInViewModels() {
        val source = File("src/main/java/com/totp/authenticator/app/TotpApp.kt").readText()

        listOf(
            "var backupStatusMessage",
            "var backupErrorMessage",
            "var backupBusy",
            "var biometricUnlockEnabled",
            "var quickUnlockAvailability",
            "var biometricUnlockAvailable",
            "var hasStrongBiometric",
            "var biometricBusy",
            "var autoQuickUnlockAttempted",
            "var passwordChangeDialogVisible",
            "var passwordChangeInProgress",
            "var passwordChangeDialogMessage",
            "var passwordChangeDialogIsError",
            "var masterPasswordErrorMessage",
            "var errorMessage",
            "var unlockBusy",
            "var pendingExportContent",
            "var pendingImportUri",
            "var pendingBackupPasswordAction",
            "var documentPickerActive",
            "var externalPickerActive"
        ).forEach { stateDeclaration ->
            assertFalse("$stateDeclaration should live in a dedicated ViewModel", source.contains(stateDeclaration))
        }
    }

    @Test
    fun backupPickerCallbacksDoNotUseLateBoundActionRefs() {
        val source = File("src/main/java/com/totp/authenticator/app/TotpApp.kt").readText()
        val backupViewModelSource = File("src/main/java/com/totp/authenticator/app/BackupViewModel.kt").readText()
        val pickerBridgeSource = File("src/main/java/com/totp/authenticator/app/BackupPickerBridge.kt").readText()

        assertFalse("Backup actions should not be bridged through a single-element ref array", source.contains("backupActionsRef"))
        listOf(
            "ActivityResultContracts.CreateDocument",
            "ActivityResultContracts.OpenDocument",
            "fun readTextFromUri(",
            "fun writeTextToUri(",
            "consumePendingExportContent()",
            "prepareReadyImport("
        ).forEach { platformDetail ->
            assertFalse("$platformDetail should live in BackupPickerBridge", source.contains(platformDetail))
        }
        assertTrue("Backup imports selected by the picker should be handed off through BackupViewModel state", backupViewModelSource.contains("pendingReadyImport"))
        assertTrue(pickerBridgeSource.contains("ActivityResultContracts.CreateDocument"))
        assertTrue(pickerBridgeSource.contains("ActivityResultContracts.OpenDocument"))
    }

    @Test
    fun backupPickerReadsAndWritesDocumentsInsideIoTasks() {
        val source = File("src/main/java/com/totp/authenticator/app/BackupPickerBridge.kt").readText()
        val exportCallback = source.substringAfter("val backupExportLauncher").substringBefore("val backupImportLauncher")
        val importCallback = source.substringAfter("val backupImportLauncher").substringBefore("LaunchedEffect(backupState.pendingExportFilename)")

        assertTrue("Backup export document writes should run inside BackupViewModel.launchTask", exportCallback.contains("backupState.launchTask("))
        assertTrue("Backup export document writes should use Dispatchers.IO", exportCallback.contains("withContext(Dispatchers.IO)"))
        assertTrue("Backup import document reads should run inside BackupViewModel.launchTask", importCallback.contains("backupState.launchTask("))
        assertTrue("Backup import document reads should use Dispatchers.IO", importCallback.contains("withContext(Dispatchers.IO)"))
        assertFalse("Backup import callback should not synchronously read the selected document before launching a task", importCallback.contains("val content = runCatching { readTextFromUri(uri) }"))
    }

    @Test
    fun backupImportSuccessMessageMatchesHarmonyCopy() {
        val source = File("src/main/java/com/totp/authenticator/app/BackupActionCoordinator.kt").readText()

        assertTrue(source.contains("backupState.showSuccess(\"已导入 \${result.vault.accounts.size} 个账号\")"))
        assertFalse(source.contains("backupState.showSuccess(\"已导入 \${result.vault.accounts.size} 个账号。\")"))
    }

    @Test
    fun backupImportSuccessMessageIsPublishedBeforeLocalChangeHook() {
        val source = File("src/main/java/com/totp/authenticator/app/BackupActionCoordinator.kt").readText()
        val importSource = source.substringAfter("fun importContent").substringBefore("onFailure = { error ->")

        assertTrue(
            "Import success should stay visible even when local-change sync side effects run afterwards",
            importSource.indexOf("backupState.showSuccess(\"已导入 \${result.vault.accounts.size} 个账号\")") <
                importSource.indexOf("onLocalChange(result.vault, password, result.vaultKey)")
        )
    }

    @Test
    fun backupImportShowsImmediateProgressBeforeRunningTask() {
        val source = File("src/main/java/com/totp/authenticator/app/BackupActionCoordinator.kt").readText()
        val importSource = source.substringAfter("fun importContent").substringBefore("fun exportWithPassword", missingDelimiterValue = source.substringAfter("fun importContent"))

        assertTrue(importSource.contains("backupState.showSuccess(\"正在导入...\")"))
        assertTrue(
            "Import progress should be visible before the async import task starts",
            importSource.indexOf("backupState.showSuccess(\"正在导入...\")") < importSource.indexOf("backupState.launchTask(")
        )
    }

    @Test
    fun backupExportSuccessMessageMatchesHarmonyCopy() {
        val source = File("src/main/java/com/totp/authenticator/app/BackupPickerBridge.kt").readText()

        assertTrue(source.contains("backupState.showSuccess(\"已导出 \${appState.vault?.accounts?.size ?: 0} 个账号：\${payload.filename}\")"))
        assertFalse(source.contains("backupState.showSuccess(\"已导出 \${appState.vault?.accounts?.size ?: 0} 个账号。\")"))
    }

    @Test
    fun passwordUnlockFlowLivesOutsideTotpApp() {
        val source = File("src/main/java/com/totp/authenticator/app/TotpApp.kt").readText()

        assertFalse("Creating a vault should be owned by UnlockActionCoordinator", source.contains("repository.create(password"))
        assertFalse("Unlocking a vault should be owned by UnlockActionCoordinator", source.contains("repository.unlock(password"))
        assertFalse("Exporting a vault key after password unlock should be owned by UnlockActionCoordinator", source.contains("repository.exportVaultKey(password"))
        assertFalse("UnlockScreen should not define inline create-password flow", source.contains("onCreatePassword = { password ->"))
        assertFalse("UnlockScreen should not define inline password-unlock flow", source.contains("onUnlock = { password ->"))
    }

    @Test
    fun qrImportAndBiometricPromptBridgesLiveOutsideTotpApp() {
        val source = File("src/main/java/com/totp/authenticator/app/TotpApp.kt").readText()
        val qrBridgeSource = File("src/main/java/com/totp/authenticator/app/QrImportBridge.kt").readText()
        val promptBridgeSource = File("src/main/java/com/totp/authenticator/app/QuickUnlockPromptBridge.kt").readText()

        listOf(
            "BiometricPrompt",
            "fun authenticateQuickUnlock(",
            "ActivityResultContracts.PickVisualMedia",
            "ActivityResultContracts.RequestPermission",
            "PickVisualMediaRequest(",
            "fun startQrImageImport(",
            "fun startQrScan(",
            "qrImportService.decodeImage(",
            "ContextCompat.checkSelfPermission(activityContext, Manifest.permission.CAMERA)"
        ).forEach { platformDetail ->
            assertFalse("$platformDetail should live in a focused bridge", source.contains(platformDetail))
        }

        assertTrue(qrBridgeSource.contains("QrImportService(context.applicationContext)"))
        assertTrue(qrBridgeSource.contains("ActivityResultContracts.PickVisualMedia"))
        assertTrue(qrBridgeSource.contains("ActivityResultContracts.RequestPermission"))
        assertTrue(promptBridgeSource.contains("BiometricPrompt"))
    }

    @Test
    fun backupViewModelDoesNotHoldPendingImportUri() {
        val source = File("src/main/java/com/totp/authenticator/app/BackupViewModel.kt").readText()

        assertFalse("BackupViewModel should cache import content instead of a temporary Uri", source.contains("android.net.Uri"))
        assertFalse("BackupViewModel should not keep pending import Uri state", source.contains("pendingImportUri"))
        assertTrue(source.contains("pendingImportContent"))
    }

    @Test
    fun settingsDisplayLogicLivesOutsideComposableScreen() {
        val source = File("src/main/java/com/totp/authenticator/ui/settings/SettingsScreen.kt").readText()

        listOf(
            "fun resolveWebDavStatus(",
            "fun webDavSummary(",
            "fun biometricSummary("
        ).forEach { functionName ->
            assertFalse("$functionName should live in SettingsUiModel", source.contains(functionName))
        }

        assertTrue(File("src/main/java/com/totp/authenticator/ui/settings/SettingsUiModel.kt").exists())
    }

    @Test
    fun settingsScreenReceivesAggregatedState() {
        val source = File("src/main/java/com/totp/authenticator/ui/settings/SettingsScreen.kt").readText()
        val signature = source.substringAfter("fun SettingsScreen(").substringBefore(") {")

        assertTrue("SettingsScreen should receive one aggregated screen state", signature.contains("state: SettingsScreenState"))
        assertTrue("SettingsScreen should receive one actions object", signature.contains("actions: SettingsScreenActions"))
        listOf(
            "biometricUnlockEnabled:",
            "webDavSettings:",
            "isWebDavBusy:",
            "settingsUiModel:",
            "isPasswordChangeBusy:",
            "masterPasswordErrorMessage:",
            "onSaveWebDavSettings:",
            "onTestWebDav:",
            "onSyncWebDav:",
            "onBiometricUnlockChanged:",
            "onChangeMasterPassword:",
            "onExportBackup:",
            "onImportBackup:"
        ).forEach { parameter ->
            assertFalse("$parameter should be part of SettingsScreenState or SettingsScreenActions", signature.contains(parameter))
        }
    }

    @Test
    fun settingsActionsLiveOutsideTotpApp() {
        val source = File("src/main/java/com/totp/authenticator/app/TotpApp.kt").readText()

        assertFalse(
            "SettingsScreenActions should be built by SettingsActionCoordinator",
            source.contains("SettingsScreenActions(")
        )
        listOf(
            "onSaveWebDavSettings = {",
            "onTestWebDav = {",
            "onSyncWebDav =",
            "onBiometricUnlockChanged = {",
            "onChangeMasterPassword = {"
        ).forEach { inlineAction ->
            assertFalse("$inlineAction should live outside TotpApp", source.contains(inlineAction))
        }
    }

    @Test
    fun settingsActionsAreRemembered() {
        val source = File("src/main/java/com/totp/authenticator/app/TotpApp.kt").readText()
        val settingsRouteSource = source.substringAfter("TotpRoute.Settings ->").substringBefore("modifier = Modifier.padding(padding)")

        assertTrue(
            "Settings actions should be remembered to avoid recreating callbacks on every recomposition",
            settingsRouteSource.contains("val settingsActions = remember(")
        )
        assertTrue(settingsRouteSource.contains("SettingsActionCoordinator("))
    }

    @Test
    fun settingsActionCoordinatorDoesNotUseComposableScope() {
        val source = File("src/main/java/com/totp/authenticator/app/SettingsActionCoordinator.kt").readText()

        assertFalse("Settings actions should use ViewModel scopes, not rememberCoroutineScope", source.contains("CoroutineScope"))
        assertFalse("Settings actions should not receive appScope", source.contains("appScope"))
        assertFalse("Settings actions should not launch directly from appScope", source.contains(".launch { changePassword() }"))
    }

    @Test
    fun passwordChangeRefreshesQuickUnlockCredentialInsteadOfDisablingIt() {
        val source = File("src/main/java/com/totp/authenticator/app/SettingsActionCoordinator.kt").readText()
        val applyPasswordChangeSource = source
            .substringAfter("private fun applyPasswordChangeResult")
            .substringBefore("private fun showSyncResult")

        assertTrue(applyPasswordChangeSource.contains("previousVaultKey = appState.activeVaultKey?.copyOf()"))
        assertTrue(applyPasswordChangeSource.contains("onRefreshQuickUnlockCredentialIfNeeded(previousVaultKey, result.vaultKey)"))
        assertFalse(applyPasswordChangeSource.contains("disable()"))
        assertFalse(source.contains("onResetQuickUnlockAfterPasswordChange"))
        assertFalse(source.contains("需要重新开启"))
    }

    @Test
    fun vaultAccountActionsUseViewModelScopeAndValidateDeletes() {
        val source = File("src/main/java/com/totp/authenticator/app/VaultAccountActionCoordinator.kt").readText()

        assertFalse("Account persistence actions should not use a composable CoroutineScope", source.contains("CoroutineScope"))
        assertFalse("Account persistence actions should not receive appScope", source.contains("appScope"))
        assertTrue("Account persistence actions should launch from VaultAccountViewModel", source.contains("VaultAccountViewModel"))
        assertTrue("Deleting a missing account should be treated as a no-op failure before writing", source.contains("MissingAccountException"))
        assertTrue("Delete transforms should check account existence before writing", source.contains("none { it.id == accountId }"))
    }

    @Test
    fun backupImportDoesNotTriggerWebDavSyncDirectly() {
        val source = File("src/main/java/com/totp/authenticator/app/BackupFlowCoordinator.kt").readText()

        listOf(
            "syncLocalChange(",
            "syncLocalChangeWithVaultKey(",
            "syncNow(",
            "syncNowWithVaultKey("
        ).forEach { syncCall ->
            assertFalse("Backup import should return a sync request instead of calling $syncCall directly", source.contains(syncCall))
        }
    }

    @Test
    fun remotePasswordSyncDoesNotExportLocalVaultKeyWhenStillBlocked() {
        val source = File("src/main/java/com/totp/authenticator/app/WebDavFlowCoordinator.kt").readText()
        val syncWithPasswordSource = source
            .substringAfter("suspend fun syncWithPassword")
            .substringBefore("suspend fun syncUnlocked")

        assertTrue(syncWithPasswordSource.contains("webDavSyncService.syncNowWithRemotePassword(currentVault, password)"))
        assertFalse(syncWithPasswordSource.contains("webDavSyncService.syncNow(password)"))
        assertTrue(syncWithPasswordSource.indexOf("needsMasterPassword(result)") in 1 until syncWithPasswordSource.indexOf("repository.exportVaultKey(password)"))
    }

    @Test
    fun unlockedLocalChangeSyncPrefersVaultKeyBeforePasswordKdf() {
        val source = File("src/main/java/com/totp/authenticator/app/WebDavFlowCoordinator.kt").readText()
        val syncUnlockedSource = source
            .substringAfter("suspend fun syncUnlocked")
            .substringBefore("suspend fun saveSettingsAndSyncIfUnlocked")
        val fastPathIndex = syncUnlockedSource.indexOf("vaultKey != null && localChange -> webDavSyncService.syncLocalChangeWithVaultKey(vaultKey)")
        val passwordPathIndex = syncUnlockedSource.indexOf("password != null && localChange -> webDavSyncService.syncLocalChange(password)")

        assertTrue("Local-change sync should try the current vaultKey before falling back to password KDF", fastPathIndex >= 0)
        assertTrue("Vault-key sync should be attempted before the password KDF path", fastPathIndex < passwordPathIndex)
        assertFalse("Fast sync should not require a cached remote ETag before trying the current vaultKey", syncUnlockedSource.contains("canUseFastSync(vaultKey) && localChange"))
    }

    @Test
    fun unlockedSyncTriesVaultKeyEvenWhenPreviousMetadataWasBlocked() {
        val source = File("src/main/java/com/totp/authenticator/app/WebDavFlowCoordinator.kt").readText()
        val canUseFastSyncSource = source
            .substringAfter("fun canUseFastSync")
            .substringBefore("fun needsMasterPassword")

        assertTrue(canUseFastSyncSource.contains("return vaultKey != null"))
        assertFalse("Previous blocked metadata should not force password KDF before trying the current vaultKey", canUseFastSyncSource.contains("lastStatus"))
    }

    @Test
    fun vaultKeyWebDavSyncAttemptsDecryptBeforeRemotePasswordPrompt() {
        val source = File("src/main/java/com/totp/authenticator/data/webdav/WebDavSyncService.kt").readText()
        val syncWithVaultKeySource = source
            .substringAfter("private suspend fun syncCoreWithVaultKeyChecked")
            .substringBefore("private suspend fun syncLocalChangeWithVaultKeyChecked")

        assertTrue(
            "Vault-key sync should try decrypting the remote vault with the current vault key",
            syncWithVaultKeySource.contains("crypto.decryptWithVaultKey(remote.vaultEnvelope.encryptedVault, vaultKey)")
        )
        assertTrue(
            "Vault-key sync should only check local and remote key-encryption envelopes after trying the vault key",
            syncWithVaultKeySource.indexOf("remoteKeyEnvelopeMatchesLocal(remote.vaultEnvelope.encryptedVault)") >
                syncWithVaultKeySource.indexOf("crypto.decryptWithVaultKey(remote.vaultEnvelope.encryptedVault, vaultKey)")
        )
    }

    @Test
    fun vaultKeyWebDavSyncBlocksAfterDecryptWhenRemotePasswordEnvelopeChanged() {
        val source = File("src/main/java/com/totp/authenticator/data/webdav/WebDavSyncService.kt").readText()
        val syncWithVaultKeySource = source
            .substringAfter("private suspend fun syncCoreWithVaultKeyChecked")
            .substringBefore("private suspend fun syncLocalChangeWithVaultKeyChecked")
        val decryptIndex = syncWithVaultKeySource.indexOf("crypto.decryptWithVaultKey(remote.vaultEnvelope.encryptedVault, vaultKey)")
        val envelopeCheckIndex = syncWithVaultKeySource.indexOf("remoteKeyEnvelopeMatchesLocal(remote.vaultEnvelope.encryptedVault)")
        val blockedIndex = syncWithVaultKeySource.indexOf("远端保管库需要主密码验证后才能继续同步。", startIndex = envelopeCheckIndex.coerceAtLeast(0))

        assertTrue("Vault-key sync should decrypt remote data before checking password envelope drift", decryptIndex >= 0)
        assertTrue("Vault-key sync should check for remote password envelope drift after decrypt succeeds", envelopeCheckIndex > decryptIndex)
        assertTrue("Remote password envelope drift should block and prompt for remote password verification", blockedIndex > envelopeCheckIndex)
    }

    @Test
    fun staleRemotePasswordBlockDoesNotOpenPasswordDialogBeforeFastSyncRetry() {
        val source = File("src/main/java/com/totp/authenticator/app/TotpApp.kt").readText()

        assertFalse(
            "A persisted blocked WebDAV status should not immediately open the remote password dialog before vault-key sync can retry",
            source.contains("syncState.isRemotePasswordBlocked &&\n            backupState.pendingPasswordAction != BackupPasswordAction.WebDavSync")
        )
    }

    @Test
    fun manualWebDavSyncRetriesVaultKeyWhenPreviousMetadataWasBlocked() {
        val homeSource = File("src/main/java/com/totp/authenticator/app/HomeSyncActionCoordinator.kt").readText()
        val settingsSource = File("src/main/java/com/totp/authenticator/app/SettingsActionCoordinator.kt").readText()

        assertFalse(
            "Home sync should not open the remote password dialog from stale blocked metadata before retrying vault-key sync",
            homeSource.substringAfter("fun syncFromHome").substringBefore("syncState.launchExclusiveSyncTask(").contains("syncState.isRemotePasswordBlocked")
        )
        assertFalse(
            "Settings sync should not open the remote password dialog from stale blocked metadata before retrying vault-key sync",
            settingsSource.substringAfter("private fun syncWebDav").substringBefore("syncState.launchExclusiveSyncTask(").contains("syncState.isRemotePasswordBlocked")
        )
    }

    @Test
    fun qrImportServiceUsesApplicationContext() {
        val source = File("src/main/java/com/totp/authenticator/app/TotpApp.kt").readText()
        val bridgeSource = File("src/main/java/com/totp/authenticator/app/QrImportBridge.kt").readText()

        assertFalse(
            "QrImportService should not retain Activity context",
            source.contains("QrImportService(activityContext)")
        )
        assertTrue(
            "QrImportService should be created with applicationContext",
            bridgeSource.contains("QrImportService(context.applicationContext)")
        )
    }
}
