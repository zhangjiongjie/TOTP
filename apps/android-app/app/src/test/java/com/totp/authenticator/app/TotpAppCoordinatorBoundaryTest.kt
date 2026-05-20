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
            "var autoQuickUnlockAttempted"
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
