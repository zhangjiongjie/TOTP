package com.totp.authenticator.app

import com.totp.authenticator.data.biometric.BiometricVaultUnlockStore
import com.totp.authenticator.data.biometric.QuickUnlockAvailability
import com.totp.authenticator.data.vault.LocalVault
import com.totp.authenticator.data.vault.VaultRepository
import javax.crypto.Cipher

class QuickUnlockCoordinator(
    private val unlockStore: BiometricVaultUnlockStore,
    private val repository: VaultRepository
) {
    fun availability(): QuickUnlockState {
        val status = unlockStore.quickUnlockStatus()
        return QuickUnlockState(
            enabled = unlockStore.isEnabled(),
            availability = status,
            available = status == QuickUnlockAvailability.Available,
            hasStrongBiometric = unlockStore.hasStrongBiometric()
        )
    }

    fun createSetupCipher(): Cipher = unlockStore.createSetupCipher()

    fun createUnlockCipher(): Cipher? = unlockStore.createUnlockCipher()

    fun saveCredential(cipher: Cipher, vaultKey: ByteArray) {
        unlockStore.saveCredential(cipher, vaultKey)
    }

    suspend fun unlock(cipher: Cipher): QuickUnlockResult {
        val credential = unlockStore.readCredential(cipher)
        return QuickUnlockResult(
            vault = repository.unlockWithVaultKey(credential.vaultKey),
            vaultKey = credential.vaultKey
        )
    }

    fun disable() {
        unlockStore.disable()
    }

    fun shouldRefreshCredential(enabled: Boolean, previousVaultKey: ByteArray?, nextVaultKey: ByteArray): Boolean {
        return enabled && previousVaultKey?.contentEquals(nextVaultKey) != true
    }
}

data class QuickUnlockState(
    val enabled: Boolean,
    val availability: QuickUnlockAvailability,
    val available: Boolean,
    val hasStrongBiometric: Boolean
)

data class QuickUnlockResult(
    val vault: LocalVault,
    val vaultKey: ByteArray
)
