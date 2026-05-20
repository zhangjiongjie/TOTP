package com.totp.authenticator.app

import com.totp.authenticator.data.biometric.QuickUnlockAvailability
import com.totp.authenticator.data.webdav.WebDavSettings
import com.totp.authenticator.data.webdav.WebDavSyncMetadata
import com.totp.authenticator.ui.settings.SettingsStatusTone
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class SettingsViewModelTest {
    @Test
    fun buildsSettingsUiModelFromFeatureViewModels() {
        val syncState = SyncViewModel(
            initialSettings = WebDavSettings(enabled = true),
            initialMetadata = WebDavSyncMetadata(lastStatus = "blocked")
        )
        val backupState = BackupViewModel()
        val quickUnlockState = QuickUnlockViewModel(
            QuickUnlockState(
                enabled = true,
                availability = QuickUnlockAvailability.Available,
                available = true,
                hasStrongBiometric = true
            )
        )
        val viewModel = SettingsViewModel()

        backupState.showSuccess("已导出 1 个账号。")
        val uiModel = viewModel.buildUiModel(syncState, backupState, quickUnlockState)

        assertEquals("生物识别解锁", uiModel.quickUnlockTitle)
        assertEquals("远端保管库需要主密码验证后才能继续同步。", uiModel.webDavStatus.message)
        assertEquals(SettingsStatusTone.Error, uiModel.webDavStatus.tone)
        assertEquals("已导出 1 个账号。", uiModel.backupStatusMessage)
        assertTrue(uiModel.quickUnlockToggleEnabled)
    }

    @Test
    fun buildsSettingsScreenStateFromFeatureViewModels() {
        val syncState = SyncViewModel(
            initialSettings = WebDavSettings(enabled = true, serverUrl = "https://dav.example.com"),
            initialMetadata = WebDavSyncMetadata(lastStatus = "synced")
        )
        val backupState = BackupViewModel()
        val quickUnlockState = QuickUnlockViewModel(
            QuickUnlockState(
                enabled = true,
                availability = QuickUnlockAvailability.Available,
                available = true,
                hasStrongBiometric = true
            )
        )
        val passwordChangeState = PasswordChangeViewModel()
        val viewModel = SettingsViewModel()

        passwordChangeState.start()
        val screenState = viewModel.buildScreenState(
            syncState = syncState,
            backupState = backupState,
            quickUnlockState = quickUnlockState,
            passwordChangeState = passwordChangeState
        )

        assertEquals(syncState.webDavSettings, screenState.webDavSettings)
        assertEquals(true, screenState.biometricUnlockEnabled)
        assertEquals(false, screenState.isWebDavBusy)
        assertEquals(true, screenState.isPasswordChangeBusy)
        assertEquals("", screenState.masterPasswordErrorMessage)
        assertEquals("生物识别解锁", screenState.uiModel.quickUnlockTitle)
    }
}
