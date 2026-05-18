package com.totp.authenticator.data.vault

import android.util.Base64 as AndroidBase64
import java.security.GeneralSecurityException
import java.security.SecureRandom
import java.util.Base64 as JvmBase64
import javax.crypto.Cipher
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

class VaultDecryptException(
    message: String,
    cause: Throwable? = null
) : Exception(message, cause)

class VaultCipher(
    private val keyDeriver: PasswordKeyDeriver = PasswordKeyDeriver(),
    private val wrappingKeyProvider: WrappingKeyProvider = AndroidKeystoreWrappingKeyProvider(),
    private val secureRandom: SecureRandom = SecureRandom()
) {
    fun encrypt(vault: LocalVault, password: String): EncryptedVaultEnvelope {
        val salt = keyDeriver.generateSalt()
        val vaultKey = keyDeriver.deriveKey(password, salt)
        val vaultNonce = randomNonce()
        val vaultJson = VaultEnvelopeJson.encodeVault(vault).toByteArray(Charsets.UTF_8)
        val ciphertext = encryptAesGcm(vaultKey, vaultNonce, vaultJson)

        val wrappedKeyNonce = randomNonce()
        val wrappedVaultKey = encryptAesGcm(
            wrappingKeyProvider.getOrCreateWrappingKey(),
            wrappedKeyNonce,
            vaultKey.encoded
        )

        return EncryptedVaultEnvelope(
            schemaVersion = vault.schemaVersion,
            kdf = keyDeriver.kdfLabel,
            salt = base64(salt),
            nonce = base64(vaultNonce),
            wrappedKeyNonce = base64(wrappedKeyNonce),
            wrappedVaultKey = base64(wrappedVaultKey),
            ciphertext = base64(ciphertext),
            updatedAt = vault.updatedAt
        )
    }

    fun decrypt(envelope: EncryptedVaultEnvelope, password: String): LocalVault {
        return try {
            val vaultKey = keyDeriver.deriveKey(
                password,
                unbase64(envelope.salt),
                iterations = iterationsFromKdfLabel(envelope.kdf)
            )
            val plaintext = decryptAesGcm(
                vaultKey,
                unbase64(envelope.nonce),
                unbase64(envelope.ciphertext)
            )
            VaultEnvelopeJson.decodeVault(plaintext.toString(Charsets.UTF_8))
        } catch (error: IllegalArgumentException) {
            throw VaultDecryptException("Unable to decrypt vault", error)
        } catch (error: GeneralSecurityException) {
            throw VaultDecryptException("Unable to decrypt vault", error)
        }
    }

    fun warmUp() {
        Cipher.getInstance(AES_GCM)
        keyDeriver.warmUp()
        wrappingKeyProvider.getOrCreateWrappingKey()
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

    private fun iterationsFromKdfLabel(kdfLabel: String): Int {
        val parts = kdfLabel.split(":")
        return parts.getOrNull(1)?.toIntOrNull()?.takeIf { it > 0 } ?: keyDeriver.iterations
    }

    private companion object {
        const val AES_GCM = "AES/GCM/NoPadding"
        const val NONCE_SIZE_BYTES = 12
        const val TAG_SIZE_BITS = 128
    }
}
