package com.totp.authenticator.data.webdav

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import android.util.Log
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json

class RemoteVaultKeyCacheStore(context: Context) {
    private val preferences = context.getSharedPreferences(PREFERENCES_NAME, Context.MODE_PRIVATE)

    fun load(
        profileKey: String,
        iterations: Int,
        salt: String? = null,
        passwordVerifier: String? = null
    ): RemoteVaultPersistentKey? {
        val record = loadRecord() ?: return null
        if (record.profileKey != profileKey || record.iterations != iterations) return null
        if (salt != null && record.salt != salt) return null
        if (passwordVerifier != null && record.passwordVerifier != passwordVerifier) return null
        return runCatching {
            RemoteVaultPersistentKey(
                salt = record.salt,
                iterations = record.iterations,
                passwordVerifier = record.passwordVerifier,
                keyBytes = decrypt(record.iv, record.ciphertext)
            )
        }.getOrElse { error ->
            Log.w("TotpWebDavPerf", "Could not read persisted remote key cache", error)
            clear()
            null
        }
    }

    fun save(profileKey: String, salt: String, iterations: Int, passwordVerifier: String, keyBytes: ByteArray) {
        runCatching {
            val encrypted = encrypt(keyBytes)
            val record = RemoteVaultKeyCacheRecordDto(
                profileKey = profileKey,
                salt = salt,
                iterations = iterations,
                passwordVerifier = passwordVerifier,
                iv = encrypted.iv,
                ciphertext = encrypted.ciphertext,
                updatedAt = System.currentTimeMillis()
            )
            preferences.edit().putString(KEY_RECORD, json.encodeToString(record)).apply()
        }.onFailure { error ->
            Log.w("TotpWebDavPerf", "Could not persist remote key cache", error)
        }
    }

    fun clear() {
        preferences.edit().remove(KEY_RECORD).apply()
    }

    private fun loadRecord(): RemoteVaultKeyCacheRecordDto? {
        val payload = preferences.getString(KEY_RECORD, null) ?: return null
        return runCatching { json.decodeFromString<RemoteVaultKeyCacheRecordDto>(payload) }.getOrNull()
    }

    private fun encrypt(plaintext: ByteArray): EncryptedPayload {
        val cipher = Cipher.getInstance(AES_GCM)
        cipher.init(Cipher.ENCRYPT_MODE, getOrCreateSecretKey())
        return EncryptedPayload(iv = base64(cipher.iv), ciphertext = base64(cipher.doFinal(plaintext)))
    }

    private fun decrypt(iv: String, ciphertext: String): ByteArray {
        val cipher = Cipher.getInstance(AES_GCM)
        cipher.init(Cipher.DECRYPT_MODE, getOrCreateSecretKey(), GCMParameterSpec(TAG_SIZE_BITS, unbase64(iv)))
        return cipher.doFinal(unbase64(ciphertext))
    }

    private fun getOrCreateSecretKey(): SecretKey {
        val keyStore = KeyStore.getInstance(ANDROID_KEYSTORE).also { it.load(null) }
        (keyStore.getKey(KEY_ALIAS, null) as? SecretKey)?.let { return it }

        val keyGenerator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, ANDROID_KEYSTORE)
        val spec = KeyGenParameterSpec.Builder(
            KEY_ALIAS,
            KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT
        )
            .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
            .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
            .setKeySize(KEY_SIZE_BITS)
            .build()
        keyGenerator.init(spec)
        return keyGenerator.generateKey()
    }

    private fun base64(bytes: ByteArray): String = Base64.encodeToString(bytes, Base64.NO_WRAP)

    private fun unbase64(value: String): ByteArray = Base64.decode(value, Base64.NO_WRAP)

    private companion object {
        const val PREFERENCES_NAME = "totp_webdav_remote_key_cache"
        const val KEY_RECORD = "remote.key.cache.record"
        const val ANDROID_KEYSTORE = "AndroidKeyStore"
        const val KEY_ALIAS = "totp_webdav_remote_key_cache_v1"
        const val AES_GCM = "AES/GCM/NoPadding"
        const val TAG_SIZE_BITS = 128
        const val KEY_SIZE_BITS = 256

        val json = Json {
            encodeDefaults = true
            ignoreUnknownKeys = true
        }
    }
}

data class RemoteVaultPersistentKey(
    val salt: String,
    val iterations: Int,
    val passwordVerifier: String,
    val keyBytes: ByteArray
)

@Serializable
private data class RemoteVaultKeyCacheRecordDto(
    val profileKey: String,
    val salt: String,
    val iterations: Int,
    val passwordVerifier: String,
    val iv: String,
    val ciphertext: String,
    val updatedAt: Long
)

private data class EncryptedPayload(
    val iv: String,
    val ciphertext: String
)
