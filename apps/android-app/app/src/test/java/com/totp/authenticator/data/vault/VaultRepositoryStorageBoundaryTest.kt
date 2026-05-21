package com.totp.authenticator.data.vault

import java.io.File
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class VaultRepositoryStorageBoundaryTest {
    @Test
    fun vaultBlobIsStoredInPrivateFileInsteadOfSharedPreferencesString() {
        val source = File("src/main/java/com/totp/authenticator/data/vault/VaultRepository.kt").readText()

        assertTrue("VaultRepository should use file-backed storage for the encrypted vault blob", source.contains("FileLocalVaultStorage"))
        assertFalse("VaultRepository should not write the encrypted vault blob into SharedPreferences", source.contains(".putString(KEY_ENCRYPTED_VAULT"))
    }

    @Test
    fun fileStorageRechecksParentDirectoryAfterMkdirs() {
        val source = File("src/main/java/com/totp/authenticator/data/vault/LocalVaultFileStorage.kt").readText()

        assertTrue("File storage should tolerate parent directories created concurrently", source.contains("!parent.isDirectory && !parent.mkdirs() && !parent.isDirectory"))
    }

    @Test
    fun saveLockedDoesNotKeepUnusedKeyEnvelopeOverrideParameter() {
        val source = File("src/main/java/com/totp/authenticator/data/vault/VaultRepository.kt").readText()

        assertFalse("Unused keyEnvelopeOverride parameter should not remain in saveLocked", source.contains("keyEnvelopeOverride"))
    }
}
