package com.totp.authenticator.app

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import com.totp.authenticator.data.vault.LocalVault

class TotpApplicationState(
    @Suppress("UNUSED_PARAMETER")
    hasExistingVault: Boolean
) : ViewModel() {
    var currentRoute: TotpRoute by mutableStateOf(TotpRoute.Unlock)
        private set

    var isUnlocked: Boolean by mutableStateOf(false)
        private set

    var vault: LocalVault? by mutableStateOf(null)
        private set

    var activePassword: String? by mutableStateOf(null)
        private set

    var activeVaultKey: ByteArray? by mutableStateOf(null)
        private set

    fun applyUnlockedVault(vault: LocalVault, password: String, vaultKey: ByteArray? = null) {
        this.vault = vault
        activePassword = password
        activeVaultKey = vaultKey
        isUnlocked = true
        currentRoute = TotpRoute.Home
    }

    fun applyUnlockedVaultWithKey(vault: LocalVault, vaultKey: ByteArray) {
        this.vault = vault
        activePassword = null
        activeVaultKey = vaultKey
        isUnlocked = true
        currentRoute = TotpRoute.Home
    }

    fun updateUnlockedVault(vault: LocalVault, password: String, vaultKey: ByteArray? = activeVaultKey) {
        this.vault = vault
        activePassword = password
        activeVaultKey = vaultKey
        isUnlocked = true
    }

    fun updateUnlockedVaultWithKey(vault: LocalVault, vaultKey: ByteArray) {
        this.vault = vault
        activeVaultKey = vaultKey
        isUnlocked = true
    }

    fun navigate(route: TotpRoute) {
        if (currentRoute == route) {
            return
        }
        currentRoute = route
    }

    fun lock() {
        vault = null
        activePassword = null
        activeVaultKey = null
        isUnlocked = false
        currentRoute = TotpRoute.Unlock
    }
}
