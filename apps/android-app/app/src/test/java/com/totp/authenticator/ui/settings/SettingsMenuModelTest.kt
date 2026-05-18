package com.totp.authenticator.ui.settings

import org.junit.Assert.assertEquals
import org.junit.Test

class SettingsMenuModelTest {
    @Test
    fun keepsSettingsOrderAlignedWithOtherClients() {
        assertEquals(
            listOf(
                "Biometric unlock",
                "WebDAV sync",
                "Import / Export",
                "Clear local vault",
                "Lock vault"
            ),
            settingsMenuItems().map { it.title }
        )
    }
}
