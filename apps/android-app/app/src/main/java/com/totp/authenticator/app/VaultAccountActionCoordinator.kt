package com.totp.authenticator.app

import com.totp.authenticator.core.account.TotpAccount
import com.totp.authenticator.data.vault.LocalVault
import com.totp.authenticator.data.vault.VaultRepository
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

class VaultAccountActionCoordinator(
    private val appState: TotpApplicationState,
    private val repository: VaultRepository,
    private val unlockState: UnlockViewModel,
    private val accountState: VaultAccountViewModel,
    private val callbacks: VaultAccountCallbacks
) {
    fun saveAccount(account: TotpAccount, replaceExisting: Boolean) {
        val password = appState.activePassword
        val vaultKey = appState.activeVaultKey
        if (password == null && vaultKey == null) {
            callbacks.onPersistenceError("Vault is not unlocked")
            return
        }

        accountState.launchMutation {
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
                callbacks.onVaultExists()
                unlockState.clearError()
                if (password != null) {
                    appState.applyUnlockedVault(updatedVault, password, vaultKey)
                } else {
                    appState.applyUnlockedVaultWithKey(updatedVault, vaultKey!!)
                }
                appState.navigate(TotpRoute.Home)
                callbacks.onLocalChange(updatedVault, password, vaultKey)
            }.onFailure {
                callbacks.onPersistenceError("Could not save vault")
            }
        }
    }

    fun deleteAccount(accountId: String) {
        val password = appState.activePassword
        val vaultKey = appState.activeVaultKey
        if (password == null && vaultKey == null) {
            callbacks.onPersistenceError("Vault is not unlocked")
            return
        }

        accountState.launchMutation {
            runCatching {
                withContext(Dispatchers.IO) {
                    val transform: (LocalVault) -> LocalVault = { vault ->
                        if (vault.accounts.none { it.id == accountId }) {
                            throw MissingAccountException
                        }
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
                callbacks.onVaultExists()
                unlockState.clearError()
                if (password != null) {
                    appState.applyUnlockedVault(updatedVault, password, vaultKey)
                } else {
                    appState.applyUnlockedVaultWithKey(updatedVault, vaultKey!!)
                }
                appState.navigate(TotpRoute.Home)
                callbacks.onLocalChange(updatedVault, password, vaultKey)
            }.onFailure { error ->
                if (error is MissingAccountException) {
                    callbacks.onPersistenceError("Account not found")
                } else {
                    callbacks.onPersistenceError("Could not save vault")
                }
            }
        }
    }

    private object MissingAccountException : IllegalStateException()
}

data class VaultAccountCallbacks(
    val onVaultExists: () -> Unit,
    val onPersistenceError: (String) -> Unit,
    val onLocalChange: (LocalVault, String?, ByteArray?) -> Unit
)
