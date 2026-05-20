package com.totp.authenticator.app

import com.totp.authenticator.data.vault.LocalVault
import com.totp.authenticator.data.vault.VaultRepository
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

class UnlockActionCoordinator(
    private val appState: TotpApplicationState,
    private val repository: VaultRepository,
    private val unlockState: UnlockViewModel,
    private val onVaultExists: () -> Unit,
    private val onSyncAfterUnlock: (String?, ByteArray?) -> Unit
) {
    fun createVault(password: String) {
        unlockState.launchTask(
            task = {
                withContext(Dispatchers.IO) {
                    val vault = LocalVault(
                        schemaVersion = 1,
                        accounts = emptyList(),
                        updatedAt = System.currentTimeMillis()
                    )
                    repository.create(vault, password)
                    val vaultKey = repository.exportVaultKey(password)
                    vault to vaultKey
                }
            },
            onSuccess = { (vault, vaultKey) ->
                onVaultExists()
                appState.applyUnlockedVault(vault, password, vaultKey)
                onSyncAfterUnlock(password, vaultKey)
            },
            onFailure = {
                unlockState.showError("Could not create vault")
            }
        )
    }

    fun unlock(password: String) {
        unlockState.launchTask(
            task = {
                withContext(Dispatchers.IO) {
                    val vault = repository.unlock(password)
                    val vaultKey = repository.exportVaultKey(password)
                    vault to vaultKey
                }
            },
            onSuccess = { (vault, vaultKey) ->
                appState.applyUnlockedVault(vault, password, vaultKey)
                onSyncAfterUnlock(password, vaultKey)
            },
            onFailure = {
                unlockState.showError("Could not unlock vault")
            }
        )
    }
}
