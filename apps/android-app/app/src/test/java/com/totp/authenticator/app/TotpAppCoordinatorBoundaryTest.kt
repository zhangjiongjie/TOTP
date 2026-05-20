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
            "fun syncWebDavWithPassword(",
            "fun syncWebDavAfterUnlock(",
            "fun syncWebDavAfterLocalChange(",
            "fun syncWebDavFromHome(",
            "fun startBiometricUnlock(",
            "fun enableBiometricUnlock(",
            "fun disableBiometricUnlock(",
            "fun refreshQuickUnlockCredentialIfNeeded("
        ).forEach { functionName ->
            assertFalse("$functionName should live outside TotpApp", source.contains(functionName))
        }

        listOf(
            "webDavSyncService.saveSettings(",
            "webDavSyncService.testConnection(",
            "webDavSyncService.syncPasswordChange(",
            "repository.changePassword(",
            "repository.exportVaultKey(nextPassword)"
        ).forEach { businessCall ->
            assertFalse("$businessCall should live in a coordinator", source.contains(businessCall))
        }
    }

    @Test
    fun coordinatorFilesOwnBusinessFlowBoundaries() {
        val appDir = File("src/main/java/com/totp/authenticator/app")

        assertTrue(File(appDir, "BackupFlowCoordinator.kt").exists())
        assertTrue(File(appDir, "WebDavFlowCoordinator.kt").exists())
        assertTrue(File(appDir, "QuickUnlockCoordinator.kt").exists())
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
            "var documentPickerActive"
        ).forEach { stateDeclaration ->
            assertFalse("$stateDeclaration should live in a dedicated ViewModel", source.contains(stateDeclaration))
        }
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
    fun qrImportServiceUsesApplicationContext() {
        val source = File("src/main/java/com/totp/authenticator/app/TotpApp.kt").readText()

        assertFalse(
            "QrImportService should not retain Activity context",
            source.contains("QrImportService(activityContext)")
        )
        assertTrue(
            "QrImportService should be created with applicationContext",
            source.contains("QrImportService(context.applicationContext)")
        )
    }
}
