package com.totp.authenticator.data.vault

import android.content.Context
import android.os.SystemClock
import android.util.Log

class VaultRepository(
    context: Context,
    private val vaultCipher: VaultCipher = VaultCipher()
) {
    private val preferences = context.getSharedPreferences(PREFERENCES_NAME, Context.MODE_PRIVATE)

    fun hasVault(): Boolean {
        return preferences.contains(KEY_ENCRYPTED_VAULT)
    }

    fun warmUpCrypto() {
        vaultCipher.warmUp()
    }

    fun create(password: String): LocalVault {
        val vault = LocalVault(
            schemaVersion = CURRENT_SCHEMA_VERSION,
            accounts = emptyList(),
            updatedAt = System.currentTimeMillis()
        )
        save(vault, password)
        return vault
    }

    fun create(vault: LocalVault, password: String): EncryptedVaultEnvelope {
        return save(vault, password)
    }

    fun unlock(password: String): LocalVault {
        val startedAt = SystemClock.elapsedRealtime()
        val encoded = preferences.getString(KEY_ENCRYPTED_VAULT, null)
            ?: throw VaultNotFoundException()
        val readAt = SystemClock.elapsedRealtime()
        val envelope = VaultEnvelopeJson.decodeEnvelope(encoded)
        val envelopeDecodedAt = SystemClock.elapsedRealtime()
        return vaultCipher.decrypt(envelope, password).also {
            val finishedAt = SystemClock.elapsedRealtime()
            Log.d(
                "TotpUnlockPerf",
                "unlock total=${finishedAt - startedAt}ms read=${readAt - startedAt}ms decode=${envelopeDecodedAt - readAt}ms decrypt=${finishedAt - envelopeDecodedAt}ms"
            )
        }
    }

    fun exportVaultKey(password: String): ByteArray {
        val encoded = preferences.getString(KEY_ENCRYPTED_VAULT, null)
            ?: throw VaultNotFoundException()
        val envelope = VaultEnvelopeJson.decodeEnvelope(encoded)
        return vaultCipher.deriveVaultKey(envelope, password).encoded
    }

    fun unlockWithVaultKey(vaultKey: ByteArray): LocalVault {
        val startedAt = SystemClock.elapsedRealtime()
        val encoded = preferences.getString(KEY_ENCRYPTED_VAULT, null)
            ?: throw VaultNotFoundException()
        val readAt = SystemClock.elapsedRealtime()
        val envelope = VaultEnvelopeJson.decodeEnvelope(encoded)
        val envelopeDecodedAt = SystemClock.elapsedRealtime()
        return vaultCipher.decryptWithVaultKey(envelope, vaultKey).also {
            val finishedAt = SystemClock.elapsedRealtime()
            Log.d(
                "TotpUnlockPerf",
                "biometric unlock total=${finishedAt - startedAt}ms read=${readAt - startedAt}ms decode=${envelopeDecodedAt - readAt}ms decrypt=${finishedAt - envelopeDecodedAt}ms"
            )
        }
    }

    fun save(vault: LocalVault, password: String): EncryptedVaultEnvelope {
        val existingEnvelope = preferences.getString(KEY_ENCRYPTED_VAULT, null)
            ?.let { runCatching { VaultEnvelopeJson.decodeEnvelope(it) }.getOrNull() }
        val envelope = if (existingEnvelope == null) {
            vaultCipher.encrypt(vault, password)
        } else {
            val vaultKey = vaultCipher.deriveVaultKey(existingEnvelope, password)
            vaultCipher.encryptWithVaultKey(vault, existingEnvelope, vaultKey.encoded)
        }
        preferences.edit()
            .putString(KEY_ENCRYPTED_VAULT, VaultEnvelopeJson.encodeEnvelope(envelope))
            .apply()
        return envelope
    }

    fun changePassword(currentPassword: String, nextPassword: String): LocalVault {
        val encoded = preferences.getString(KEY_ENCRYPTED_VAULT, null)
            ?: throw VaultNotFoundException()
        val envelope = VaultEnvelopeJson.decodeEnvelope(encoded)
        val vault = vaultCipher.decrypt(envelope, currentPassword)
        val updatedEnvelope = vaultCipher.rewrapVaultKey(envelope, currentPassword, nextPassword)
        preferences.edit()
            .putString(KEY_ENCRYPTED_VAULT, VaultEnvelopeJson.encodeEnvelope(updatedEnvelope))
            .apply()
        return vault
    }

    fun clear() {
        preferences.edit()
            .remove(KEY_ENCRYPTED_VAULT)
            .apply()
    }

    private companion object {
        const val PREFERENCES_NAME = "totp_vault"
        const val KEY_ENCRYPTED_VAULT = "encrypted_vault"
        const val CURRENT_SCHEMA_VERSION = 1
    }
}

class VaultNotFoundException : IllegalStateException("No local vault exists")
