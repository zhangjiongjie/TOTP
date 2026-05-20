package com.totp.authenticator.data.webdav

import com.totp.authenticator.core.account.TotpAccount
import com.totp.authenticator.core.totp.TotpAlgorithm
import com.totp.authenticator.data.vault.LocalVault
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class RemoteVaultCryptoTest {
    private val crypto = RemoteVaultCrypto()

    @Test
    fun encryptsRemoteVaultWithProvidedVaultKeyAndReturnsItOnPasswordDecrypt() {
        val vault = sampleVault()
        val vaultKey = ByteArray(32) { index -> (index + 1).toByte() }

        val encrypted = crypto.encrypt(vault, "master-password", vaultKey, "profile")
        val decrypted = crypto.decryptWithKey(encrypted, "master-password", "profile")

        assertEquals(vault, decrypted.vault)
        assertEquals(vaultKey.toList(), decrypted.vaultKey.toList())
        assertEquals(vault, crypto.decryptWithVaultKey(encrypted, vaultKey))
        assertTrue(crypto.canDecryptWithVaultKey(encrypted, vaultKey))
        assertFalse(crypto.canDecryptWithVaultKey(encrypted, ByteArray(32) { 9 }))
    }

    @Test
    fun rewrapsPasswordWithoutChangingEncryptedVaultPayload() {
        val vault = sampleVault()
        val vaultKey = ByteArray(32) { index -> (index + 1).toByte() }

        val encrypted = crypto.encrypt(vault, "old-password", vaultKey, "profile")
        val rewrapped = crypto.rewrapKeyEncryption(encrypted, "new-password", vaultKey, "profile")

        assertEquals(encrypted.vaultId, rewrapped.vaultId)
        assertEquals(encrypted.vaultEncryption, rewrapped.vaultEncryption)
        assertEquals(vault, crypto.decryptWithKey(rewrapped, "new-password", "profile").vault)
    }

    private fun sampleVault(): LocalVault {
        val now = 1_700_000_000_000L
        return LocalVault(
            schemaVersion = 1,
            accounts = listOf(
                TotpAccount(
                    id = "account-1",
                    issuer = "Example",
                    accountName = "alice@example.com",
                    secret = "JBSWY3DPEHPK3PXP",
                    algorithm = TotpAlgorithm.SHA1,
                    digits = 6,
                    period = 30,
                    group = "Default",
                    createdAt = now,
                    updatedAt = now
                )
            ),
            updatedAt = now
        )
    }
}
