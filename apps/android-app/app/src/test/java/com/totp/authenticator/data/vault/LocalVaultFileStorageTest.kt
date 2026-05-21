package com.totp.authenticator.data.vault

import java.nio.file.Files
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class LocalVaultFileStorageTest {
    @Test
    fun writesReadsAndReplacesVaultEnvelope() {
        val dir = Files.createTempDirectory("totp-vault-storage").toFile()
        val storage = FileLocalVaultStorage(dir.resolve("vault.json"))

        storage.write("first")
        assertTrue(storage.exists())
        assertEquals("first", storage.read())

        storage.write("second")
        assertEquals("second", storage.read())
    }

    @Test
    fun createsMissingParentDirectoryBeforeWriting() {
        val dir = Files.createTempDirectory("totp-vault-storage").toFile()
        val storage = FileLocalVaultStorage(dir.resolve("nested").resolve("vault.json"))

        storage.write("payload")

        assertEquals("payload", storage.read())
    }

    @Test
    fun deleteRemovesStoredEnvelope() {
        val dir = Files.createTempDirectory("totp-vault-storage").toFile()
        val storage = FileLocalVaultStorage(dir.resolve("vault.json"))

        storage.write("payload")
        storage.delete()

        assertFalse(storage.exists())
        assertNull(storage.read())
    }
}
