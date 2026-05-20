package com.totp.authenticator.data.vault

import javax.crypto.spec.SecretKeySpec
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class LocalVaultEnvelopeCodecTest {
    private val wrappingKey = SecretKeySpec(ByteArray(32) { index -> index.toByte() }, "AES")
    private val codec = LocalVaultEnvelopeCodec(
        wrappingKeyProvider = object : WrappingKeyProvider {
            override fun getOrCreateWrappingKey() = wrappingKey
        }
    )

    @Test
    fun wrapsPortableEnvelopeForLocalStorage() {
        val envelope = sampleEnvelope()
        val portableJson = VaultEnvelopeJson.encodeEnvelope(envelope)

        val stored = codec.encodeForStorage(envelope)

        assertNotEquals(portableJson, stored)

        val decoded = codec.decodeFromStorage(stored)
        assertEquals(envelope, decoded.envelope)
        assertFalse(decoded.needsMigration)
    }

    @Test
    fun readsLegacyPortableEnvelopeAndMarksForMigration() {
        val envelope = sampleEnvelope()
        val legacyStored = VaultEnvelopeJson.encodeEnvelope(envelope)

        val decoded = codec.decodeFromStorage(legacyStored)

        assertEquals(envelope, decoded.envelope)
        assertTrue(decoded.needsMigration)
    }

    @Test(expected = LocalVaultStorageException::class)
    fun rejectsWrappedPayloadWhenWrappingKeyDoesNotMatch() {
        val stored = codec.encodeForStorage(sampleEnvelope())
        val wrongCodec = LocalVaultEnvelopeCodec(
            wrappingKeyProvider = object : WrappingKeyProvider {
                override fun getOrCreateWrappingKey() = SecretKeySpec(ByteArray(32) { 9 }, "AES")
            }
        )

        wrongCodec.decodeFromStorage(stored)
    }

    private fun sampleEnvelope(): EncryptedVaultEnvelope {
        return EncryptedVaultEnvelope(
            formatVersion = 2,
            vaultId = "vault-id",
            kdf = VaultKdf(
                name = "PBKDF2",
                iterations = 100,
                hash = "SHA-256",
                salt = "salt"
            ),
            keyEncryption = AesGcmPayload(
                cipher = "AES-GCM",
                iv = "key-iv",
                ciphertext = "wrapped-key"
            ),
            vaultEncryption = AesGcmPayload(
                cipher = "AES-GCM",
                iv = "vault-iv",
                ciphertext = "vault-ciphertext"
            ),
            updatedAt = 123L
        )
    }
}
