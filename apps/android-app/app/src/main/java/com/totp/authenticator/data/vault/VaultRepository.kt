package com.totp.authenticator.data.vault

import android.content.Context

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
        val encoded = preferences.getString(KEY_ENCRYPTED_VAULT, null)
            ?: throw VaultNotFoundException()
        return vaultCipher.decrypt(VaultEnvelopeJson.decodeEnvelope(encoded), password)
    }

    fun save(vault: LocalVault, password: String): EncryptedVaultEnvelope {
        val envelope = vaultCipher.encrypt(vault, password)
        preferences.edit()
            .putString(KEY_ENCRYPTED_VAULT, VaultEnvelopeJson.encodeEnvelope(envelope))
            .apply()
        return envelope
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
