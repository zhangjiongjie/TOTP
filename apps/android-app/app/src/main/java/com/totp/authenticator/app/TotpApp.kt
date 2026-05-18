package com.totp.authenticator.app

import android.widget.Toast
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import com.totp.authenticator.core.account.TotpAccount
import com.totp.authenticator.data.vault.LocalVault
import com.totp.authenticator.data.vault.VaultRepository
import com.totp.authenticator.ui.editor.AccountEditorScreen
import com.totp.authenticator.ui.unlock.UnlockScreen

@Composable
fun TotpApp() {
    val context = LocalContext.current.applicationContext
    val repository = remember { VaultRepository(context) }
    val hasExistingVault = remember { repository.hasVault() }
    val state = remember { TotpApplicationState(hasExistingVault) }
    var errorMessage by remember { mutableStateOf<String?>(null) }

    fun showPersistenceError(message: String) {
        errorMessage = message
        Toast.makeText(context, message, Toast.LENGTH_SHORT).show()
    }

    fun saveVault(updatedVault: LocalVault, password: String): Boolean {
        return runCatching {
            repository.save(updatedVault, password)
        }.onSuccess {
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

        TotpRoute.Home -> HomePlaceholder(
            accountCount = state.vault?.accounts?.size ?: 0,
            errorMessage = errorMessage,
            onAdd = { state.navigate(TotpRoute.Add) }
        )

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
                HomePlaceholder(
                    accountCount = state.vault?.accounts?.size ?: 0,
                    errorMessage = "Account not found",
                    onAdd = { state.navigate(TotpRoute.Add) }
                )
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

        TotpRoute.Settings -> HomePlaceholder(
            accountCount = state.vault?.accounts?.size ?: 0,
            errorMessage = errorMessage,
            onAdd = { state.navigate(TotpRoute.Add) }
        )
    }
}

@Composable
private fun HomePlaceholder(
    accountCount: Int,
    errorMessage: String?,
    onAdd: () -> Unit
) {
    Surface(
        modifier = Modifier.fillMaxSize(),
        color = MaterialTheme.colorScheme.background
    ) {
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(24.dp),
            contentAlignment = Alignment.Center
        ) {
            Column {
                Text(
                    text = "Vault unlocked",
                    style = MaterialTheme.typography.titleLarge,
                    color = MaterialTheme.colorScheme.onBackground
                )
                Spacer(modifier = Modifier.height(8.dp))
                Text(
                    text = "$accountCount accounts",
                    style = MaterialTheme.typography.bodyLarge,
                    color = MaterialTheme.colorScheme.onBackground
                )
                if (errorMessage != null) {
                    Spacer(modifier = Modifier.height(12.dp))
                    Text(
                        text = errorMessage,
                        color = MaterialTheme.colorScheme.error,
                        style = MaterialTheme.typography.bodyMedium
                    )
                }
                Spacer(modifier = Modifier.height(24.dp))
                Button(
                    modifier = Modifier.fillMaxWidth(),
                    onClick = onAdd
                ) {
                    Text("Add account")
                }
            }
        }
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
