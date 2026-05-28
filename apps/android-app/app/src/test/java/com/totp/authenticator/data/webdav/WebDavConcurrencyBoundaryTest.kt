package com.totp.authenticator.data.webdav

import java.io.File
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class WebDavConcurrencyBoundaryTest {
    @Test
    fun webDavSyncDoesNotUseRepositoryUpdateTransactions() {
        val source = File("src/main/java/com/totp/authenticator/data/webdav/WebDavSyncService.kt").readText()

        assertFalse(source.contains("repository.update("))
        assertFalse(source.contains("repository.updateWithVaultKey("))
    }

    @Test
    fun remotePasswordSyncUsesUnlockedVaultInsteadOfLocalPasswordUnlock() {
        val source = File("src/main/java/com/totp/authenticator/data/webdav/WebDavSyncService.kt").readText()
        val remotePasswordSource = source
            .substringAfter("suspend fun syncNowWithRemotePassword")
            .substringBefore("suspend fun syncLocalChange")

        assertTrue(remotePasswordSource.contains("syncMutex.withLock"))
        assertTrue(remotePasswordSource.contains("syncNowChecked(localVault, remotePassword, requireExistingRemote = true)"))
        assertFalse(remotePasswordSource.contains("repository.unlock(remotePassword)"))
    }

    @Test
    fun localChangeSyncUsesFullSyncCoreInsteadOfDirectPush() {
        val source = File("src/main/java/com/totp/authenticator/data/webdav/WebDavSyncService.kt").readText()
        val passwordLocalChangeSource = source
            .substringAfter("private suspend fun syncLocalChangeChecked")
            .substringBefore("private suspend fun syncPasswordChangeChecked")
        val vaultKeyLocalChangeSource = source
            .substringAfter("private suspend fun syncLocalChangeWithVaultKeyChecked")
            .substringBefore("private suspend fun pushLocal(")

        assertTrue(passwordLocalChangeSource.contains("syncCoreChecked(localVault, password, WEBDAV_SYNC_TRIGGER_LOCAL_CHANGE"))
        assertFalse(passwordLocalChangeSource.contains("pushLocal("))
        assertTrue(vaultKeyLocalChangeSource.contains("syncCoreWithVaultKeyChecked(localVault, vaultKey, WEBDAV_SYNC_TRIGGER_LOCAL_CHANGE"))
        assertFalse(vaultKeyLocalChangeSource.contains("pushLocalWithVaultKey("))
    }

    @Test
    fun vaultRepositoryUpdateTransformsAreSynchronous() {
        val source = File("src/main/java/com/totp/authenticator/data/vault/VaultRepository.kt").readText()

        assertTrue(source.contains("transform: (LocalVault) -> LocalVault"))
        assertFalse(source.contains("transform: suspend (LocalVault)"))
    }
}
