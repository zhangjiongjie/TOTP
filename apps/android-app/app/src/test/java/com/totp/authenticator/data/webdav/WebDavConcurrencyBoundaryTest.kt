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
    fun vaultRepositoryUpdateTransformsAreSynchronous() {
        val source = File("src/main/java/com/totp/authenticator/data/vault/VaultRepository.kt").readText()

        assertTrue(source.contains("transform: (LocalVault) -> LocalVault"))
        assertFalse(source.contains("transform: suspend (LocalVault)"))
    }
}
