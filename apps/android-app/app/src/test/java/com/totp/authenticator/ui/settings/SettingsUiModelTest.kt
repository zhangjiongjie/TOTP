package com.totp.authenticator.ui.settings

import com.totp.authenticator.data.webdav.WebDavSettings
import com.totp.authenticator.data.webdav.WebDavSyncMetadata
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class SettingsUiModelTest {
    @Test
    fun disabledWebDavShowsLocalMode() {
        val model = SettingsUiModel.from(
            biometricUnlockEnabled = false,
            biometricUnlockAvailable = true,
            quickUnlockSetupRequired = false,
            hasStrongBiometric = false,
            isBiometricBusy = false,
            webDavSettings = WebDavSettings(enabled = false),
            webDavMetadata = WebDavSyncMetadata(),
            isWebDavBusy = false,
            webDavStatusMessage = "",
            webDavStatusIsError = false,
            backupStatusMessage = "",
            backupErrorMessage = "",
            isBackupBusy = false
        )

        assertEquals("系统凭证解锁", model.quickUnlockTitle)
        assertEquals("WebDAV 同步未开启，本地模式。", model.webDavStatus.message)
        assertEquals(SettingsStatusTone.Idle, model.webDavStatus.tone)
        assertTrue(model.showWebDavEnableHint)
    }

    @Test
    fun transientWebDavErrorOverridesPersistedStatus() {
        val model = SettingsUiModel.from(
            biometricUnlockEnabled = true,
            biometricUnlockAvailable = true,
            quickUnlockSetupRequired = false,
            hasStrongBiometric = true,
            isBiometricBusy = false,
            webDavSettings = WebDavSettings(enabled = true),
            webDavMetadata = WebDavSyncMetadata(lastStatus = "synced"),
            isWebDavBusy = false,
            webDavStatusMessage = "连接失败",
            webDavStatusIsError = true,
            backupStatusMessage = "",
            backupErrorMessage = "",
            isBackupBusy = false
        )

        assertEquals("生物识别解锁", model.quickUnlockTitle)
        assertEquals("连接失败", model.webDavStatus.message)
        assertEquals(SettingsStatusTone.Error, model.webDavStatus.tone)
        assertFalse(model.showWebDavEnableHint)
    }
}
