package com.totp.authenticator.data.vault

import android.content.Context
import android.os.SystemClock
import android.util.Log
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock

class VaultRepository(
    context: Context,
    private val vaultCipher: VaultCipher = VaultCipher()
) {
    private val preferences = context.getSharedPreferences(PREFERENCES_NAME, Context.MODE_PRIVATE)
    private val vaultMutex = Mutex()

    fun hasVault(): Boolean {
        return preferences.contains(KEY_ENCRYPTED_VAULT)
    }

    fun warmUpCrypto() {
        vaultCipher.warmUp()
    }

    suspend fun create(password: String): LocalVault = vaultMutex.withLock {
        val vault = LocalVault(
            schemaVersion = CURRENT_SCHEMA_VERSION,
            accounts = emptyList(),
            updatedAt = System.currentTimeMillis()
        )
        saveLocked(vault, password)
        return vault
    }

    suspend fun create(vault: LocalVault, password: String): EncryptedVaultEnvelope = vaultMutex.withLock {
        return saveLocked(vault, password)
    }

    suspend fun unlock(password: String): LocalVault = vaultMutex.withLock {
        return unlockLocked(password)
    }

    private fun unlockLocked(password: String): LocalVault {
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

    suspend fun exportVaultKey(password: String): ByteArray = vaultMutex.withLock {
        return exportVaultKeyLocked(password)
    }

    private fun exportVaultKeyLocked(password: String): ByteArray {
        val encoded = preferences.getString(KEY_ENCRYPTED_VAULT, null)
            ?: throw VaultNotFoundException()
        val envelope = VaultEnvelopeJson.decodeEnvelope(encoded)
        return vaultCipher.deriveVaultKey(envelope, password).encoded
    }

    suspend fun exportEncryptedEnvelope(): EncryptedVaultEnvelope = vaultMutex.withLock {
        return exportEncryptedEnvelopeLocked()
    }

    private fun exportEncryptedEnvelopeLocked(): EncryptedVaultEnvelope {
        val encoded = preferences.getString(KEY_ENCRYPTED_VAULT, null)
            ?: throw VaultNotFoundException()
        return VaultEnvelopeJson.decodeEnvelope(encoded)
    }

    suspend fun unlockWithVaultKey(vaultKey: ByteArray): LocalVault = vaultMutex.withLock {
        return unlockWithVaultKeyLocked(vaultKey)
    }

    private fun unlockWithVaultKeyLocked(vaultKey: ByteArray): LocalVault {
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

    suspend fun saveWithVaultKey(vault: LocalVault, vaultKey: ByteArray): EncryptedVaultEnvelope = vaultMutex.withLock {
        val existingEnvelope = preferences.getString(KEY_ENCRYPTED_VAULT, null)
            ?.let { VaultEnvelopeJson.decodeEnvelope(it) }
            ?: throw VaultNotFoundException()
        return saveWithVaultKeyEnvelopeLocked(vault, existingEnvelope, vaultKey)
    }

    suspend fun saveWithVaultKeyEnvelope(
        vault: LocalVault,
        keyEnvelope: EncryptedVaultEnvelope,
        vaultKey: ByteArray
    ): EncryptedVaultEnvelope = vaultMutex.withLock {
        return saveWithVaultKeyEnvelopeLocked(vault, keyEnvelope, vaultKey)
    }

    private fun saveWithVaultKeyEnvelopeLocked(
        vault: LocalVault,
        keyEnvelope: EncryptedVaultEnvelope,
        vaultKey: ByteArray
    ): EncryptedVaultEnvelope {
        val envelope = vaultCipher.encryptWithVaultKey(vault, keyEnvelope, vaultKey)
        preferences.edit()
            .putString(KEY_ENCRYPTED_VAULT, VaultEnvelopeJson.encodeEnvelope(envelope))
            .commit()
        return envelope
    }

    suspend fun save(vault: LocalVault, password: String): EncryptedVaultEnvelope = vaultMutex.withLock {
        return saveLocked(vault, password)
    }

    private fun saveLocked(vault: LocalVault, password: String, keyEnvelopeOverride: EncryptedVaultEnvelope? = null): EncryptedVaultEnvelope {
        val existingEnvelope = keyEnvelopeOverride ?: preferences.getString(KEY_ENCRYPTED_VAULT, null)
            ?.let { runCatching { VaultEnvelopeJson.decodeEnvelope(it) }.getOrNull() }
        val envelope = if (existingEnvelope == null) {
            vaultCipher.encrypt(vault, password)
        } else {
            val vaultKey = vaultCipher.deriveVaultKey(existingEnvelope, password)
            vaultCipher.encryptWithVaultKey(vault, existingEnvelope, vaultKey.encoded)
        }
        preferences.edit()
            .putString(KEY_ENCRYPTED_VAULT, VaultEnvelopeJson.encodeEnvelope(envelope))
            .commit()
        return envelope
    }

    suspend fun update(password: String, transform: (LocalVault) -> LocalVault): LocalVault = vaultMutex.withLock {
        val currentVault = unlockLocked(password)
        val updatedVault = transform(currentVault)
        saveLocked(updatedVault, password)
        return updatedVault
    }

    suspend fun updateWithVaultKey(vaultKey: ByteArray, transform: (LocalVault) -> LocalVault): LocalVault = vaultMutex.withLock {
        val currentVault = unlockWithVaultKeyLocked(vaultKey)
        val updatedVault = transform(currentVault)
        val existingEnvelope = preferences.getString(KEY_ENCRYPTED_VAULT, null)
            ?.let { VaultEnvelopeJson.decodeEnvelope(it) }
            ?: throw VaultNotFoundException()
        saveWithVaultKeyEnvelopeLocked(updatedVault, existingEnvelope, vaultKey)
        return updatedVault
    }

    suspend fun changePassword(currentPassword: String, nextPassword: String): LocalVault = vaultMutex.withLock {
        val encoded = preferences.getString(KEY_ENCRYPTED_VAULT, null)
            ?: throw VaultNotFoundException()
        val envelope = VaultEnvelopeJson.decodeEnvelope(encoded)
        val vault = vaultCipher.decrypt(envelope, currentPassword)
        val updatedEnvelope = vaultCipher.rewrapVaultKey(envelope, currentPassword, nextPassword)
        preferences.edit()
            .putString(KEY_ENCRYPTED_VAULT, VaultEnvelopeJson.encodeEnvelope(updatedEnvelope))
            .commit()
        return vault
    }

    suspend fun clear() = vaultMutex.withLock {
        preferences.edit()
            .remove(KEY_ENCRYPTED_VAULT)
            .commit()
    }

    private companion object {
        const val PREFERENCES_NAME = "totp_vault"
        const val KEY_ENCRYPTED_VAULT = "encrypted_vault"
        const val CURRENT_SCHEMA_VERSION = 1
    }
}

class VaultNotFoundException : IllegalStateException("No local vault exists")
