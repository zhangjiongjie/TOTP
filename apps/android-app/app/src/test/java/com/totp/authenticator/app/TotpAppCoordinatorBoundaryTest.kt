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
    }
}
