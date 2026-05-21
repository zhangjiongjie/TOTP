package com.totp.authenticator.app

import com.totp.authenticator.data.vault.LocalVault
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertSame
import org.junit.Assert.assertTrue
import org.junit.Test

class TotpApplicationStateTest {
    @Test
    fun startsLockedWhenVaultExists() {
        val state = TotpApplicationState(hasExistingVault = true)

        assertEquals(TotpRoute.Unlock, state.currentRoute)
        assertFalse(state.isUnlocked)
    }

    @Test
    fun unlockStoresVaultInMemory() {
        val vault = LocalVault(
            schemaVersion = 1,
            accounts = emptyList(),
            updatedAt = 1_779_010_000_000L
        )
        val state = TotpApplicationState(hasExistingVault = true)

        state.applyUnlockedVault(vault, password = "pw")

        assertTrue(state.isUnlocked)
        assertEquals(TotpRoute.Home, state.currentRoute)
        assertSame(vault, state.vault)
        assertEquals("pw", state.activePassword)
    }

    @Test
    fun lockWipesActiveVaultKeyBeforeClearingIt() {
        val vault = LocalVault(
            schemaVersion = 1,
            accounts = emptyList(),
            updatedAt = 1_779_010_000_000L
        )
        val vaultKey = byteArrayOf(1, 2, 3, 4)
        val state = TotpApplicationState(hasExistingVault = true)
        state.applyUnlockedVault(vault, password = "pw", vaultKey = vaultKey)

        state.lock()

        assertTrue(vaultKey.all { it == 0.toByte() })
        assertNull(state.activeVaultKey)
        assertFalse(state.isUnlocked)
    }

    @Test
    fun replacingActiveVaultKeyWipesPreviousKey() {
        val vault = LocalVault(
            schemaVersion = 1,
            accounts = emptyList(),
            updatedAt = 1_779_010_000_000L
        )
        val previousVaultKey = byteArrayOf(1, 2, 3, 4)
        val nextVaultKey = byteArrayOf(5, 6, 7, 8)
        val state = TotpApplicationState(hasExistingVault = true)
        state.applyUnlockedVault(vault, password = "pw", vaultKey = previousVaultKey)

        state.updateUnlockedVault(vault, password = "pw", vaultKey = nextVaultKey)

        assertTrue(previousVaultKey.all { it == 0.toByte() })
        assertSame(nextVaultKey, state.activeVaultKey)
    }
}
