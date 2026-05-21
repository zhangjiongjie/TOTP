package com.totp.authenticator.data.vault

import android.content.Context
import android.os.SystemClock
import android.util.Log
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import java.io.File

class VaultRepository(
    context: Context,
    private val vaultCipher: VaultCipher = VaultCipher(),
    private val localEnvelopeCodec: LocalVaultEnvelopeCodec = LocalVaultEnvelopeCodec(AndroidKeystoreWrappingKeyProvider()),
    private val localVaultStorage: LocalVaultStorage = FileLocalVaultStorage(
        File(context.filesDir, "vault/local_vault_envelope.json")
    )
) {
    private val legacyPreferences = context.getSharedPreferences(PREFERENCES_NAME, Context.MODE_PRIVATE)
    private val vaultMutex = Mutex()

    fun hasVault(): Boolean {
        return localVaultStorage.exists() || legacyPreferences.contains(KEY_ENCRYPTED_VAULT)
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
        val decodedEnvelope = readLocalEnvelopeLocked()
        val readAt = SystemClock.elapsedRealtime()
        val envelope = decodedEnvelope.envelope
        val envelopeDecodedAt = SystemClock.elapsedRealtime()
        return vaultCipher.decrypt(envelope, password).also {
            migrateLocalEnvelopeIfNeeded(decodedEnvelope)
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
        val decodedEnvelope = readLocalEnvelopeLocked()
        return vaultCipher.deriveVaultKey(decodedEnvelope.envelope, password).encoded.also {
            migrateLocalEnvelopeIfNeeded(decodedEnvelope)
        }
    }

    suspend fun exportEncryptedEnvelope(): EncryptedVaultEnvelope = vaultMutex.withLock {
        return exportEncryptedEnvelopeLocked()
    }

    private fun exportEncryptedEnvelopeLocked(): EncryptedVaultEnvelope {
        return readLocalEnvelopeLocked().envelope
    }

    suspend fun unlockWithVaultKey(vaultKey: ByteArray): LocalVault = vaultMutex.withLock {
        return unlockWithVaultKeyLocked(vaultKey)
    }

    private fun unlockWithVaultKeyLocked(vaultKey: ByteArray): LocalVault {
        val startedAt = SystemClock.elapsedRealtime()
        val decodedEnvelope = readLocalEnvelopeLocked()
        val readAt = SystemClock.elapsedRealtime()
        val envelope = decodedEnvelope.envelope
        val envelopeDecodedAt = SystemClock.elapsedRealtime()
        return vaultCipher.decryptWithVaultKey(envelope, vaultKey).also {
            migrateLocalEnvelopeIfNeeded(decodedEnvelope)
            val finishedAt = SystemClock.elapsedRealtime()
            Log.d(
                "TotpUnlockPerf",
                "biometric unlock total=${finishedAt - startedAt}ms read=${readAt - startedAt}ms decode=${envelopeDecodedAt - readAt}ms decrypt=${finishedAt - envelopeDecodedAt}ms"
            )
        }
    }

    suspend fun saveWithVaultKey(vault: LocalVault, vaultKey: ByteArray): EncryptedVaultEnvelope = vaultMutex.withLock {
        val existingEnvelope = readLocalEnvelopeLocked().envelope
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
        writeLocalEnvelopeLocked(envelope)
        return envelope
    }

    suspend fun save(vault: LocalVault, password: String): EncryptedVaultEnvelope = vaultMutex.withLock {
        return saveLocked(vault, password)
    }

    private fun saveLocked(vault: LocalVault, password: String): EncryptedVaultEnvelope {
        val existingEnvelope = readLocalEnvelopeStorageLocked()
            ?.let { localEnvelopeCodec.decodeFromStorage(it).envelope }
        val envelope = if (existingEnvelope == null) {
            vaultCipher.encrypt(vault, password)
        } else {
            val vaultKey = vaultCipher.deriveVaultKey(existingEnvelope, password)
            vaultCipher.encryptWithVaultKey(vault, existingEnvelope, vaultKey.encoded)
        }
        writeLocalEnvelopeLocked(envelope)
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
        val existingEnvelope = readLocalEnvelopeLocked().envelope
        saveWithVaultKeyEnvelopeLocked(updatedVault, existingEnvelope, vaultKey)
        return updatedVault
    }

    suspend fun changePassword(currentPassword: String, nextPassword: String): LocalVault = vaultMutex.withLock {
        val envelope = readLocalEnvelopeLocked().envelope
        val vault = vaultCipher.decrypt(envelope, currentPassword)
        val updatedEnvelope = vaultCipher.rewrapVaultKey(envelope, currentPassword, nextPassword)
        writeLocalEnvelopeLocked(updatedEnvelope)
        return vault
    }

    suspend fun clear() = vaultMutex.withLock {
        localVaultStorage.delete()
        legacyPreferences.edit()
            .remove(KEY_ENCRYPTED_VAULT)
            .commit()
    }

    private companion object {
        const val PREFERENCES_NAME = "totp_vault"
        const val KEY_ENCRYPTED_VAULT = "encrypted_vault"
        const val CURRENT_SCHEMA_VERSION = 1
    }

    private fun readLocalEnvelopeLocked(): DecodedLocalVaultEnvelope {
        val encoded = readLocalEnvelopeStorageLocked()
            ?: throw VaultNotFoundException()
        return localEnvelopeCodec.decodeFromStorage(encoded)
    }

    private fun readLocalEnvelopeStorageLocked(): String? {
        val stored = localVaultStorage.read()
        if (stored != null) {
            return stored
        }
        val legacyStored = legacyPreferences.getString(KEY_ENCRYPTED_VAULT, null) ?: return null
        localVaultStorage.write(legacyStored)
        legacyPreferences.edit()
            .remove(KEY_ENCRYPTED_VAULT)
            .apply()
        return legacyStored
    }

    private fun writeLocalEnvelopeLocked(envelope: EncryptedVaultEnvelope) {
        localVaultStorage.write(localEnvelopeCodec.encodeForStorage(envelope))
    }

    private fun migrateLocalEnvelopeLocked(envelope: EncryptedVaultEnvelope) {
        localVaultStorage.write(localEnvelopeCodec.encodeForStorage(envelope))
    }

    private fun migrateLocalEnvelopeIfNeeded(decodedEnvelope: DecodedLocalVaultEnvelope) {
        if (decodedEnvelope.needsMigration) {
            migrateLocalEnvelopeLocked(decodedEnvelope.envelope)
        }
    }
}

class VaultNotFoundException : IllegalStateException("No local vault exists")
