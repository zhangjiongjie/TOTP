package com.totp.authenticator.data.webdav

import java.io.File
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class WebDavSettingsStoreSecurityBoundaryTest {
    @Test
    fun settingsAreStoredInEncryptedSharedPreferencesWithLegacyMigration() {
        val source = File("src/main/java/com/totp/authenticator/data/webdav/WebDavSettingsStore.kt").readText()

        assertTrue(source.contains("EncryptedSharedPreferences"))
        assertTrue(source.contains("MasterKey"))
        assertTrue("Existing plaintext settings should be migrated once", source.contains("legacyPreferences"))
        assertFalse("Encrypted WebDAV settings should not use the old plaintext preferences name", source.contains("getSharedPreferences(PREFERENCES_NAME"))
    }
}
