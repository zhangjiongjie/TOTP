package com.totp.authenticator.data.vault

import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import java.security.GeneralSecurityException
import java.util.Base64
import javax.crypto.Cipher

class LocalVaultStorageException(
    message: String,
    cause: Throwable? = null
) : Exception(message, cause)

data class DecodedLocalVaultEnvelope(
    val envelope: EncryptedVaultEnvelope,
    val needsMigration: Boolean
)

class LocalVaultEnvelopeCodec(
    private val wrappingKeyProvider: WrappingKeyProvider
) {
    private val json = Json {
        encodeDefaults = true
        ignoreUnknownKeys = true
    }

    fun encodeForStorage(envelope: EncryptedVaultEnvelope): String {
        val cipher = Cipher.getInstance(AES_GCM)
        cipher.init(Cipher.ENCRYPT_MODE, wrappingKeyProvider.getOrCreateWrappingKey())
        val ciphertext = cipher.doFinal(VaultEnvelopeJson.encodeEnvelope(envelope).toByteArray(Charsets.UTF_8))
        return json.encodeToString(
            LocalKeystoreWrappedVaultDto(
                storageFormat = STORAGE_FORMAT,
                formatVersion = CURRENT_VERSION,
                wrapping = WRAPPING_NAME,
                keyAlias = KEY_ALIAS,
                iv = base64(cipher.iv),
                ciphertext = base64(ciphertext)
            )
        )
    }

    fun decodeFromStorage(value: String): DecodedLocalVaultEnvelope {
        val wrapped = runCatching {
            json.decodeFromString<LocalKeystoreWrappedVaultDto>(value)
        }.getOrNull()
        if (wrapped?.storageFormat == STORAGE_FORMAT) {
            return DecodedLocalVaultEnvelope(decodeWrapped(wrapped), needsMigration = false)
        }
        return DecodedLocalVaultEnvelope(VaultEnvelopeJson.decodeEnvelope(value), needsMigration = true)
    }

    private fun decodeWrapped(wrapped: LocalKeystoreWrappedVaultDto): EncryptedVaultEnvelope {
        if (wrapped.formatVersion != CURRENT_VERSION || wrapped.wrapping != WRAPPING_NAME) {
            throw LocalVaultStorageException("Unsupported local vault storage wrapper")
        }
        return try {
            val cipher = Cipher.getInstance(AES_GCM)
            cipher.init(Cipher.DECRYPT_MODE, wrappingKeyProvider.getOrCreateWrappingKey(), javax.crypto.spec.GCMParameterSpec(TAG_SIZE_BITS, unbase64(wrapped.iv)))
            val plaintext = cipher.doFinal(unbase64(wrapped.ciphertext)).toString(Charsets.UTF_8)
            VaultEnvelopeJson.decodeEnvelope(plaintext)
        } catch (error: IllegalArgumentException) {
            throw LocalVaultStorageException("Unable to unwrap local vault envelope", error)
        } catch (error: GeneralSecurityException) {
            throw LocalVaultStorageException("Unable to unwrap local vault envelope", error)
        }
    }

    private fun base64(bytes: ByteArray): String = Base64.getEncoder().encodeToString(bytes)

    private fun unbase64(value: String): ByteArray = Base64.getDecoder().decode(value)

    private companion object {
        const val AES_GCM = "AES/GCM/NoPadding"
        const val TAG_SIZE_BITS = 128
        const val CURRENT_VERSION = 1
        const val STORAGE_FORMAT = "totp.android.local-keystore-wrapped-vault"
        const val WRAPPING_NAME = "android-keystore-aes-gcm"
        const val KEY_ALIAS = "totp_local_vault_wrapping_key_v2"
    }
}

@Serializable
private data class LocalKeystoreWrappedVaultDto(
    val storageFormat: String,
    val formatVersion: Int,
    val wrapping: String,
    val keyAlias: String,
    val iv: String,
    val ciphertext: String
)
