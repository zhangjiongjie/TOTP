package com.totp.authenticator.app

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.widget.Toast
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.platform.LocalContext
import com.totp.authenticator.core.account.TotpAccount
import com.totp.authenticator.data.vault.LocalVault
import com.totp.authenticator.data.vault.VaultRepository
import com.totp.authenticator.ui.editor.AccountEditorScreen
import com.totp.authenticator.ui.home.HomeScreen
import com.totp.authenticator.ui.settings.SettingsScreen
import com.totp.authenticator.ui.unlock.UnlockScreen
import kotlinx.coroutines.delay

@Composable
fun TotpApp() {
    val context = LocalContext.current.applicationContext
    val repository = remember { VaultRepository(context) }
    var hasExistingVault by remember { mutableStateOf(repository.hasVault()) }
    val state = remember { TotpApplicationState(hasExistingVault) }
    var nowMillis by remember { mutableStateOf(System.currentTimeMillis()) }
    var errorMessage by remember { mutableStateOf<String?>(null) }

    LaunchedEffect(Unit) {
        while (true) {
            nowMillis = System.currentTimeMillis()
            delay(1_000)
        }
    }

    fun showPersistenceError(message: String) {
        errorMessage = message
        Toast.makeText(context, message, Toast.LENGTH_SHORT).show()
    }

    fun saveVault(updatedVault: LocalVault, password: String): Boolean {
        return runCatching {
            repository.save(updatedVault, password)
        }.onSuccess {
            hasExistingVault = true
            errorMessage = null
            state.applyUnlockedVault(updatedVault, password)
        }.onFailure {
            showPersistenceError("Could not save vault")
        }.isSuccess
    }

    fun saveAccount(account: TotpAccount, replaceExisting: Boolean) {
        val vault = state.vault
        val password = state.activePassword
        if (vault == null || password == null) {
            showPersistenceError("Vault is not unlocked")
            return
        }

        val accounts = if (replaceExisting) {
            vault.accounts.map { existing ->
                if (existing.id == account.id) account else existing
            }
        } else {
            vault.accounts + account
        }
        if (saveVault(vault.copy(accounts = accounts, updatedAt = account.updatedAt), password)) {
            state.navigate(TotpRoute.Home)
        }
    }

    fun deleteAccount(accountId: String) {
        val vault = state.vault
        val password = state.activePassword
        if (vault == null || password == null) {
            showPersistenceError("Vault is not unlocked")
            return
        }

        val now = System.currentTimeMillis()
        val updatedVault = vault.copy(
            accounts = vault.accounts.filterNot { it.id == accountId },
            updatedAt = now
        )
        if (saveVault(updatedVault, password)) {
            state.navigate(TotpRoute.Home)
        }
    }

    when (state.currentRoute) {
        TotpRoute.Unlock -> UnlockScreen(
            hasExistingVault = hasExistingVault,
            errorMessage = errorMessage,
            onCreatePassword = { password ->
                runCatching {
                    repository.create(password, now = System.currentTimeMillis())
                }.onSuccess { vault ->
                    hasExistingVault = true
                    errorMessage = null
                    state.applyUnlockedVault(vault, password)
                }.onFailure {
                    errorMessage = "Could not create vault"
                }
            },
            onUnlock = { password ->
                runCatching {
                    repository.unlock(password)
                }.onSuccess { vault ->
                    errorMessage = null
                    state.applyUnlockedVault(vault, password)
                }.onFailure {
                    errorMessage = "Could not unlock vault"
                }
            }
        )

        TotpRoute.Home -> {
            val vault = state.vault
            if (vault == null) {
                MissingVaultEffect { state.lock() }
            } else {
                HomeScreen(
                    vault = vault,
                    nowMillis = nowMillis,
                    onAdd = { state.navigate(TotpRoute.Add) },
                    onEdit = { accountId -> state.navigate(TotpRoute.Edit(accountId)) },
                    onSettings = { state.navigate(TotpRoute.Settings) },
                    onCopy = { code ->
                        val clipboard = context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
                        clipboard.setPrimaryClip(ClipData.newPlainText("TOTP code", code))
                        Toast.makeText(context, "Code copied", Toast.LENGTH_SHORT).show()
                    }
                )
            }
        }

        TotpRoute.Add -> AccountEditorScreen(
            title = "Add account",
            existingAccount = null,
            onSave = { account -> saveAccount(account, replaceExisting = false) },
            onDelete = null,
            onBack = { state.navigate(TotpRoute.Home) }
        )

        is TotpRoute.Edit -> {
            val route = state.currentRoute as TotpRoute.Edit
            val account = state.vault?.accounts?.firstOrNull { it.id == route.accountId }
            if (account == null) {
                MissingAccountEffect(route.accountId) {
                    Toast.makeText(context, "Account not found", Toast.LENGTH_SHORT).show()
                    state.navigate(TotpRoute.Home)
                }
            } else {
                AccountEditorScreen(
                    title = "Edit account",
                    existingAccount = account,
                    onSave = { updatedAccount -> saveAccount(updatedAccount, replaceExisting = true) },
                    onDelete = { accountId -> deleteAccount(accountId) },
                    onBack = { state.navigate(TotpRoute.Home) }
                )
            }
        }

        TotpRoute.Settings -> SettingsScreen(
            accountCount = state.vault?.accounts?.size ?: 0,
            onClearVault = {
                repository.clear()
                hasExistingVault = false
                errorMessage = null
                state.lock()
            },
            onLock = { state.lock() },
            onBack = { state.navigate(TotpRoute.Home) }
        )
    }
}

@Composable
private fun MissingVaultEffect(onMissingVault: () -> Unit) {
    LaunchedEffect(Unit) {
        onMissingVault()
    }
}

@Composable
private fun MissingAccountEffect(accountId: String, onMissingAccount: () -> Unit) {
    LaunchedEffect(accountId) {
        onMissingAccount()
    }
}

private fun VaultRepository.create(password: String, now: Long): LocalVault {
    val vault = LocalVault(
        schemaVersion = 1,
        accounts = emptyList(),
        updatedAt = now
    )
    create(vault, password)
    return vault
}
