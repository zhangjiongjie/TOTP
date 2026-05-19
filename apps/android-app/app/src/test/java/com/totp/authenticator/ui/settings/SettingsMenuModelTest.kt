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
                "Import / Export"
            ),
            settingsMenuItems().map { it.title }
        )
    }
}
