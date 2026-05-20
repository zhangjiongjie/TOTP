package com.totp.authenticator.app

import com.totp.authenticator.core.account.TotpAccount
import com.totp.authenticator.data.vault.LocalVault
import com.totp.authenticator.data.vault.VaultRepository
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

class VaultAccountActionCoordinator(
    private val appState: TotpApplicationState,
    private val repository: VaultRepository,
    private val unlockState: UnlockViewModel,
    private val appScope: CoroutineScope,
    private val onVaultExists: () -> Unit,
    private val onPersistenceError: (String) -> Unit,
    private val onLocalChange: (LocalVault, String?, ByteArray?) -> Unit
) {
    fun saveAccount(account: TotpAccount, replaceExisting: Boolean) {
        val password = appState.activePassword
        val vaultKey = appState.activeVaultKey
        if (password == null && vaultKey == null) {
            onPersistenceError("Vault is not unlocked")
            return
        }

        appScope.launch {
            runCatching {
                withContext(Dispatchers.IO) {
                    val transform: (LocalVault) -> LocalVault = { vault ->
                        val accounts = if (replaceExisting) {
                            vault.accounts.map { existing ->
                                if (existing.id == account.id) account else existing
                            }
                        } else {
                            vault.accounts + account
                        }
                        vault.copy(accounts = accounts, updatedAt = account.updatedAt)
                    }
                    if (password != null) {
                        repository.update(password, transform)
                    } else {
                        repository.updateWithVaultKey(vaultKey!!, transform)
                    }
                }
            }.onSuccess { updatedVault ->
                onVaultExists()
                unlockState.clearError()
                if (password != null) {
                    appState.applyUnlockedVault(updatedVault, password, vaultKey)
                } else {
                    appState.applyUnlockedVaultWithKey(updatedVault, vaultKey!!)
                }
                appState.navigate(TotpRoute.Home)
                onLocalChange(updatedVault, password, vaultKey)
            }.onFailure {
                onPersistenceError("Could not save vault")
            }
        }
    }

    fun deleteAccount(accountId: String) {
        val password = appState.activePassword
        val vaultKey = appState.activeVaultKey
        if (password == null && vaultKey == null) {
            onPersistenceError("Vault is not unlocked")
            return
        }

        appScope.launch {
            runCatching {
                withContext(Dispatchers.IO) {
                    val transform: (LocalVault) -> LocalVault = { vault ->
                        vault.copy(
                            accounts = vault.accounts.filterNot { it.id == accountId },
                            updatedAt = System.currentTimeMillis()
                        )
                    }
                    if (password != null) {
                        repository.update(password, transform)
                    } else {
                        repository.updateWithVaultKey(vaultKey!!, transform)
                    }
                }
            }.onSuccess { updatedVault ->
                onVaultExists()
                unlockState.clearError()
                if (password != null) {
                    appState.applyUnlockedVault(updatedVault, password, vaultKey)
                } else {
                    appState.applyUnlockedVaultWithKey(updatedVault, vaultKey!!)
                }
                appState.navigate(TotpRoute.Home)
                onLocalChange(updatedVault, password, vaultKey)
            }.onFailure {
                onPersistenceError("Could not save vault")
            }
        }
    }
}
