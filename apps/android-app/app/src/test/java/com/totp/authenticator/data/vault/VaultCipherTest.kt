package com.totp.authenticator.data.vault

import com.totp.authenticator.core.account.TotpAccount
import com.totp.authenticator.core.totp.TotpAlgorithm
import javax.crypto.SecretKey
import javax.crypto.spec.SecretKeySpec
import org.junit.Assert.assertEquals
import org.junit.Test

class VaultCipherTest {
    private val wrappingKeyProvider = object : WrappingKeyProvider {
        override fun getOrCreateWrappingKey(): SecretKey {
            return SecretKeySpec(ByteArray(32) { 7 }, "AES")
        }
    }

    private val cipher = VaultCipher(
        keyDeriver = PasswordKeyDeriver(),
        wrappingKeyProvider = wrappingKeyProvider
    )

    @Test
    fun encryptsAndDecryptsVaultWithPassword() {
        val vault = sampleVault()

        val envelope = cipher.encrypt(vault, "correct horse battery staple")
        val decrypted = cipher.decrypt(envelope, "correct horse battery staple")

        assertEquals(vault, decrypted)
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
