package com.totp.authenticator.data.vault

import com.totp.authenticator.core.account.TotpAccount
import com.totp.authenticator.core.totp.TotpAlgorithm
import org.junit.Assert.assertEquals
import org.junit.Test

class VaultCipherTest {
    private val cipher = VaultCipher(
        keyDeriver = PasswordKeyDeriver()
    )

    @Test
    fun encryptsAndDecryptsVaultWithPassword() {
        val vault = sampleVault()

        val envelope = cipher.encrypt(vault, "correct horse battery staple")
        val decrypted = cipher.decrypt(envelope, "correct horse battery staple")

        assertEquals(vault, decrypted)
    }

    @Test
    fun decryptsVaultWithExportedVaultKey() {
        val vault = sampleVault()
        val envelope = cipher.encrypt(vault, "correct horse battery staple")
        val vaultKey = cipher.deriveVaultKey(envelope, "correct horse battery staple")

        val decrypted = cipher.decryptWithVaultKey(envelope, vaultKey.encoded)

        assertEquals(vault, decrypted)
    }

    @Test
    fun reEncryptsUpdatedVaultWithExistingVaultKey() {
        val vault = sampleVault()
        val envelope = cipher.encrypt(vault, "correct horse battery staple")
        val vaultKey = cipher.deriveVaultKey(envelope, "correct horse battery staple")
        val updatedVault = vault.copy(accounts = emptyList(), updatedAt = vault.updatedAt + 1)

        val updatedEnvelope = cipher.encryptWithVaultKey(updatedVault, envelope, vaultKey.encoded)
        val decrypted = cipher.decryptWithVaultKey(updatedEnvelope, vaultKey.encoded)

        assertEquals(updatedVault, decrypted)
        assertEquals(envelope.kdf, updatedEnvelope.kdf)
        assertEquals(envelope.keyEncryption, updatedEnvelope.keyEncryption)
    }

    @Test
    fun rewrapsVaultKeyWhenPasswordChanges() {
        val vault = sampleVault()
        val envelope = cipher.encrypt(vault, "correct horse battery staple")
        val vaultKey = cipher.deriveVaultKey(envelope, "correct horse battery staple")

        val rewrapped = cipher.rewrapVaultKey(envelope, "correct horse battery staple", "new correct horse battery staple")
        val rewrappedVaultKey = cipher.deriveVaultKey(rewrapped, "new correct horse battery staple")

        assertEquals(vault, cipher.decrypt(rewrapped, "new correct horse battery staple"))
        assertEquals(vaultKey.encoded.toList(), rewrappedVaultKey.encoded.toList())
        assertEquals(envelope.vaultEncryption, rewrapped.vaultEncryption)
    }

    @Test(expected = VaultDecryptException::class)
    fun rejectsWrongExportedVaultKey() {
        val envelope = cipher.encrypt(sampleVault(), "correct horse battery staple")

        cipher.decryptWithVaultKey(envelope, ByteArray(32) { 9 })
    }

    @Test(expected = VaultDecryptException::class)
    fun rejectsWrongPassword() {
        val envelope = cipher.encrypt(sampleVault(), "correct horse battery staple")

        cipher.decrypt(envelope, "wrong password")
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
                    algorithm = TotpAlgorithm.SHA256,
                    digits = 6,
                    period = 30,
                    group = "Work",
                    createdAt = now,
                    updatedAt = now
                )
            ),
            updatedAt = now
        )
    }
}
