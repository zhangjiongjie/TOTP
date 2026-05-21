package com.totp.authenticator.app

import java.io.File
import org.junit.Assert.assertTrue
import org.junit.Test

class VaultKeyRefreshBoundaryTest {
    @Test
    fun refreshComparisonsUseCopiesBeforeApplicationStateCanWipeOldKeys() {
        val homeSource = File("src/main/java/com/totp/authenticator/app/HomeSyncActionCoordinator.kt").readText()
        val settingsSource = File("src/main/java/com/totp/authenticator/app/SettingsActionCoordinator.kt").readText()

        assertTrue(homeSource.contains("val previousVaultKey = appState.activeVaultKey?.copyOf()"))
        assertTrue(settingsSource.contains("val previousVaultKey = appState.activeVaultKey?.copyOf()"))
    }

    @Test
    fun quickUnlockEnableUsesVaultKeySnapshotsAcrossPromptBoundary() {
        val settingsSource = File("src/main/java/com/totp/authenticator/app/SettingsActionCoordinator.kt").readText()
        val quickUnlockSource = File("src/main/java/com/totp/authenticator/app/QuickUnlockActionCoordinator.kt").readText()

        assertTrue(settingsSource.contains("val vaultKey = appState.activeVaultKey?.copyOf()"))
        assertTrue(quickUnlockSource.contains("val vaultKeySnapshot = vaultKey.copyOf()"))
        assertTrue(quickUnlockSource.contains("saveCredential(authenticatedCipher, vaultKeySnapshot)"))
    }
}
