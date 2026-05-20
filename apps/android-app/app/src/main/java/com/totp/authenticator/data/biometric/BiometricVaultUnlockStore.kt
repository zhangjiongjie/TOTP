package com.totp.authenticator.data.biometric

import android.content.Context
import android.os.Build
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyPermanentlyInvalidatedException
import android.security.keystore.KeyProperties
import android.util.Base64
import androidx.biometric.BiometricManager
import androidx.biometric.BiometricManager.Authenticators.BIOMETRIC_STRONG
import androidx.biometric.BiometricManager.Authenticators.DEVICE_CREDENTIAL
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json

class BiometricVaultUnlockStore(context: Context) {
    private val appContext = context.applicationContext
    private val preferences = appContext.getSharedPreferences(PREFERENCES_NAME, Context.MODE_PRIVATE)

    fun canUseBiometricUnlock(): Boolean {
        return quickUnlockStatus() == QuickUnlockAvailability.Available
    }

    fun quickUnlockStatus(): QuickUnlockAvailability {
        return when (BiometricManager.from(appContext).canAuthenticate(QUICK_UNLOCK_AUTHENTICATORS)) {
            BiometricManager.BIOMETRIC_SUCCESS -> QuickUnlockAvailability.Available
            BiometricManager.BIOMETRIC_ERROR_NONE_ENROLLED -> QuickUnlockAvailability.NeedsSystemCredential
            else -> QuickUnlockAvailability.Unsupported
        }
    }

    fun hasStrongBiometric(): Boolean {
        return BiometricManager.from(appContext).canAuthenticate(BIOMETRIC_STRONG) == BiometricManager.BIOMETRIC_SUCCESS
    }

    fun isEnabled(): Boolean = loadRecord() != null

    fun createSetupCipher(): Cipher {
        val cipher = Cipher.getInstance(AES_GCM)
        cipher.init(Cipher.ENCRYPT_MODE, getOrCreateKey())
        return cipher
    }

    fun createUnlockCipher(): Cipher? {
        val record = loadRecord() ?: return null
        return try {
            Cipher.getInstance(AES_GCM).apply {
                init(Cipher.DECRYPT_MODE, getOrCreateKey(), GCMParameterSpec(TAG_SIZE_BITS, unbase64(record.iv)))
            }
        } catch (error: KeyPermanentlyInvalidatedException) {
            null
        }
    }

    fun saveCredential(cipher: Cipher, vaultKey: ByteArray) {
        val payload = BiometricCredentialPayloadDto(
            vaultKey = base64(vaultKey)
        )
        val ciphertext = cipher.doFinal(json.encodeToString(payload).toByteArray(Charsets.UTF_8))
        val record = BiometricCredentialRecordDto(
            iv = base64(cipher.iv),
            ciphertext = base64(ciphertext)
        )
        preferences.edit()
            .putString(KEY_CREDENTIAL, json.encodeToString(record))
            .apply()
    }

    fun readCredential(cipher: Cipher): BiometricVaultCredential {
        val record = loadRecord() ?: throw BiometricCredentialException("Biometric unlock is not enabled")
        val plaintext = cipher.doFinal(unbase64(record.ciphertext)).toString(Charsets.UTF_8)
        val payload = json.decodeFromString<BiometricCredentialPayloadDto>(plaintext)
        return BiometricVaultCredential(
            vaultKey = unbase64(payload.vaultKey)
        )
    }

    fun disable() {
        preferences.edit().remove(KEY_CREDENTIAL).apply()
        runCatching {
            KeyStore.getInstance(ANDROID_KEYSTORE).apply { load(null) }.deleteEntry(KEY_ALIAS)
        }
    }

    private fun loadRecord(): BiometricCredentialRecordDto? {
        val payload = preferences.getString(KEY_CREDENTIAL, null) ?: return null
        return runCatching { json.decodeFromString<BiometricCredentialRecordDto>(payload) }
            .getOrNull()
    }

    private fun getOrCreateKey(): SecretKey {
        val keyStore = KeyStore.getInstance(ANDROID_KEYSTORE).apply { load(null) }
        keyStore.getKey(KEY_ALIAS, null)?.let { return it as SecretKey }

        val keyGenerator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, ANDROID_KEYSTORE)
        val keyAuthenticators = if (hasStrongBiometric()) {
            KeyProperties.AUTH_BIOMETRIC_STRONG or KeyProperties.AUTH_DEVICE_CREDENTIAL
        } else {
            KeyProperties.AUTH_DEVICE_CREDENTIAL
        }
        keyGenerator.init(
            KeyGenParameterSpec.Builder(
                KEY_ALIAS,
                KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT
            )
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setKeySize(256)
                .setUserAuthenticationRequired(true)
                .apply {
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                        setUserAuthenticationParameters(AUTH_VALIDITY_SECONDS, keyAuthenticators)
                    } else {
                        @Suppress("DEPRECATION")
                        setUserAuthenticationValidityDurationSeconds(AUTH_VALIDITY_SECONDS)
                    }
                }
                .setInvalidatedByBiometricEnrollment(true)
                .build()
        )
        return keyGenerator.generateKey()
    }

    private fun base64(bytes: ByteArray): String = Base64.encodeToString(bytes, Base64.NO_WRAP)

    private fun unbase64(value: String): ByteArray = Base64.decode(value, Base64.NO_WRAP)

    private companion object {
        const val PREFERENCES_NAME = "totp_biometric_unlock"
        const val KEY_CREDENTIAL = "biometric.credential.v2"
        const val KEY_ALIAS = "totp_biometric_unlock_key_v2"
        const val ANDROID_KEYSTORE = "AndroidKeyStore"
        const val AES_GCM = "AES/GCM/NoPadding"
        const val TAG_SIZE_BITS = 128
        const val AUTH_VALIDITY_SECONDS = 30
        const val QUICK_UNLOCK_AUTHENTICATORS = BIOMETRIC_STRONG or DEVICE_CREDENTIAL

        val json = Json {
            encodeDefaults = true
            ignoreUnknownKeys = true
        }
    }
}

data class BiometricVaultCredential(
    val vaultKey: ByteArray
)

class BiometricCredentialException(message: String, cause: Throwable? = null) : Exception(message, cause)

enum class QuickUnlockAvailability {
    Available,
    NeedsSystemCredential,
    Unsupported
}

@Serializable
private data class BiometricCredentialRecordDto(
    val version: Int = 1,
    val iv: String,
    val ciphertext: String
)

@Serializable
private data class BiometricCredentialPayloadDto(
    val version: Int = 2,
    val vaultKey: String
)
