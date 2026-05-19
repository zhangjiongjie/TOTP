package com.totp.authenticator.data.vault

import android.util.Base64 as AndroidBase64
import java.security.GeneralSecurityException
import java.security.SecureRandom
import java.util.UUID
import java.util.Base64 as JvmBase64
import javax.crypto.Cipher
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec
import javax.crypto.spec.SecretKeySpec

class VaultDecryptException(
    message: String,
    cause: Throwable? = null
) : Exception(message, cause)

class VaultCipher(
    private val keyDeriver: PasswordKeyDeriver = PasswordKeyDeriver(),
    private val secureRandom: SecureRandom = SecureRandom()
) {
    fun encrypt(vault: LocalVault, password: String): EncryptedVaultEnvelope {
        val salt = keyDeriver.generateSalt()
        val wrappingKey = keyDeriver.deriveKey(password, salt)
        val vaultKeyBytes = randomVaultKey()
        val vaultNonce = randomNonce()
        val vaultJson = VaultEnvelopeJson.encodeVault(vault).toByteArray(Charsets.UTF_8)
        val ciphertext = encryptAesGcm(SecretKeySpec(vaultKeyBytes, "AES"), vaultNonce, vaultJson)

        val wrappedKeyNonce = randomNonce()
        val wrappedVaultKey = encryptAesGcm(
            wrappingKey,
            wrappedKeyNonce,
            vaultKeyBytes
        )

        return EncryptedVaultEnvelope(
            formatVersion = CURRENT_ENVELOPE_VERSION,
            vaultId = UUID.randomUUID().toString(),
            kdf = VaultKdf(
                name = KDF_NAME,
                iterations = keyDeriver.iterations,
                hash = KDF_HASH,
                salt = base64(salt)
            ),
            keyEncryption = AesGcmPayload(
                cipher = CIPHER_NAME,
                iv = base64(wrappedKeyNonce),
                ciphertext = base64(wrappedVaultKey)
            ),
            vaultEncryption = AesGcmPayload(
                cipher = CIPHER_NAME,
                iv = base64(vaultNonce),
                ciphertext = base64(ciphertext)
            ),
            updatedAt = vault.updatedAt
        )
    }

    fun decrypt(envelope: EncryptedVaultEnvelope, password: String): LocalVault {
        return try {
            val vaultKey = deriveVaultKey(envelope, password)
            val plaintext = decryptAesGcm(
                vaultKey,
                unbase64(envelope.vaultEncryption.iv),
                unbase64(envelope.vaultEncryption.ciphertext)
            )
            VaultEnvelopeJson.decodeVault(plaintext.toString(Charsets.UTF_8))
        } catch (error: IllegalArgumentException) {
            throw VaultDecryptException("Unable to decrypt vault", error)
        } catch (error: GeneralSecurityException) {
            throw VaultDecryptException("Unable to decrypt vault", error)
        }
    }

    fun deriveVaultKey(envelope: EncryptedVaultEnvelope, password: String): SecretKey {
        return keyDeriver.deriveKey(
            password,
            unbase64(envelope.kdf.salt),
            iterations = envelope.kdf.iterations
        ).let { wrappingKey ->
            val vaultKeyBytes = decryptAesGcm(
                wrappingKey,
                unbase64(envelope.keyEncryption.iv),
                unbase64(envelope.keyEncryption.ciphertext)
            )
            SecretKeySpec(vaultKeyBytes, "AES")
        }
    }

    fun decryptWithVaultKey(envelope: EncryptedVaultEnvelope, vaultKeyBytes: ByteArray): LocalVault {
        return try {
            val plaintext = decryptAesGcm(
                SecretKeySpec(vaultKeyBytes, "AES"),
                unbase64(envelope.vaultEncryption.iv),
                unbase64(envelope.vaultEncryption.ciphertext)
            )
            VaultEnvelopeJson.decodeVault(plaintext.toString(Charsets.UTF_8))
        } catch (error: IllegalArgumentException) {
            throw VaultDecryptException("Unable to decrypt vault", error)
        } catch (error: GeneralSecurityException) {
            throw VaultDecryptException("Unable to decrypt vault", error)
        }
    }

    fun encryptWithVaultKey(
        vault: LocalVault,
        existingEnvelope: EncryptedVaultEnvelope,
        vaultKeyBytes: ByteArray
    ): EncryptedVaultEnvelope {
        val vaultNonce = randomNonce()
        val vaultJson = VaultEnvelopeJson.encodeVault(vault).toByteArray(Charsets.UTF_8)
        val ciphertext = encryptAesGcm(SecretKeySpec(vaultKeyBytes, "AES"), vaultNonce, vaultJson)
        return existingEnvelope.copy(
            vaultEncryption = AesGcmPayload(
                cipher = CIPHER_NAME,
                iv = base64(vaultNonce),
                ciphertext = base64(ciphertext)
            ),
            updatedAt = vault.updatedAt
        )
    }

    fun rewrapVaultKey(existingEnvelope: EncryptedVaultEnvelope, currentPassword: String, nextPassword: String): EncryptedVaultEnvelope {
        val vaultKeyBytes = deriveVaultKey(existingEnvelope, currentPassword).encoded
        val salt = keyDeriver.generateSalt()
        val wrappingKey = keyDeriver.deriveKey(nextPassword, salt)
        val wrappedKeyNonce = randomNonce()
        val wrappedVaultKey = encryptAesGcm(wrappingKey, wrappedKeyNonce, vaultKeyBytes)
        return existingEnvelope.copy(
            kdf = VaultKdf(
                name = KDF_NAME,
                iterations = keyDeriver.iterations,
                hash = KDF_HASH,
                salt = base64(salt)
            ),
            keyEncryption = AesGcmPayload(
                cipher = CIPHER_NAME,
                iv = base64(wrappedKeyNonce),
                ciphertext = base64(wrappedVaultKey)
            )
        )
    }

    fun warmUp() {
        Cipher.getInstance(AES_GCM)
        keyDeriver.warmUp()
    }

    private fun randomVaultKey(): ByteArray {
        return ByteArray(VAULT_KEY_SIZE_BYTES).also(secureRandom::nextBytes)
    }

    private fun randomNonce(): ByteArray {
        return ByteArray(NONCE_SIZE_BYTES).also(secureRandom::nextBytes)
    }

    private fun encryptAesGcm(key: SecretKey, nonce: ByteArray, plaintext: ByteArray): ByteArray {
        val cipher = Cipher.getInstance(AES_GCM)
        cipher.init(Cipher.ENCRYPT_MODE, key, GCMParameterSpec(TAG_SIZE_BITS, nonce))
        return cipher.doFinal(plaintext)
    }

    private fun decryptAesGcm(key: SecretKey, nonce: ByteArray, ciphertext: ByteArray): ByteArray {
        val cipher = Cipher.getInstance(AES_GCM)
        cipher.init(Cipher.DECRYPT_MODE, key, GCMParameterSpec(TAG_SIZE_BITS, nonce))
        return cipher.doFinal(ciphertext)
    }

    private fun base64(bytes: ByteArray): String {
        return try {
            AndroidBase64.encodeToString(bytes, AndroidBase64.NO_WRAP)
        } catch (error: RuntimeException) {
            if (error.message?.contains("not mocked") == true) {
                JvmBase64.getEncoder().encodeToString(bytes)
            } else {
                throw error
            }
        }
    }

    private fun unbase64(value: String): ByteArray {
        return try {
            AndroidBase64.decode(value, AndroidBase64.NO_WRAP)
        } catch (error: RuntimeException) {
            if (error.message?.contains("not mocked") == true) {
                JvmBase64.getDecoder().decode(value)
            } else {
                throw error
            }
        }
    }

    private companion object {
        const val CURRENT_ENVELOPE_VERSION = 2
        const val KDF_NAME = "PBKDF2"
        const val KDF_HASH = "SHA-256"
        const val CIPHER_NAME = "AES-GCM"
        const val AES_GCM = "AES/GCM/NoPadding"
        const val VAULT_KEY_SIZE_BYTES = 32
        const val NONCE_SIZE_BYTES = 12
        const val TAG_SIZE_BITS = 128
    }
}
