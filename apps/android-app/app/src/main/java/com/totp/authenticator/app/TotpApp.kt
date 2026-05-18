package com.totp.authenticator.app

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
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
import com.totp.authenticator.data.vault.LocalVault
import com.totp.authenticator.data.vault.VaultRepository
import com.totp.authenticator.ui.unlock.UnlockScreen

@Composable
fun TotpApp() {
    val context = LocalContext.current.applicationContext
    val repository = remember { VaultRepository(context) }
    val hasExistingVault = remember { repository.hasVault() }
    val state = remember { TotpApplicationState(hasExistingVault) }
    var errorMessage by remember { mutableStateOf<String?>(null) }

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

        TotpRoute.Home -> HomePlaceholder()
        TotpRoute.Add -> HomePlaceholder()
        is TotpRoute.Edit -> HomePlaceholder()
        TotpRoute.Settings -> HomePlaceholder()
    }
}

@Composable
private fun HomePlaceholder() {
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
            Text(
                text = "Vault unlocked",
                style = MaterialTheme.typography.titleLarge,
                color = MaterialTheme.colorScheme.onBackground
            )
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
