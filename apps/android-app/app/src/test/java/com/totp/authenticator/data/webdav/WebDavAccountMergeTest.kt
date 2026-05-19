package com.totp.authenticator.data.webdav

import com.totp.authenticator.core.account.TotpAccount
import com.totp.authenticator.core.totp.TotpAlgorithm
import com.totp.authenticator.data.vault.LocalVault
import com.totp.authenticator.data.vault.VaultEnvelopeJson
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class WebDavAccountMergeTest {
    @Test
    fun mergesIndependentAccountFieldChanges() {
        val baseAccount = account(id = "1", issuer = "GitHub", accountName = "me")
        val localAccount = baseAccount.copy(accountName = "local", updatedAt = 2_000L)
        val remoteAccount = baseAccount.copy(group = "Work", updatedAt = 3_000L)

        val merged = WebDavAccountMerge.merge(
            metadataFor(vaultOf(baseAccount)),
            localVault = vaultOf(localAccount),
            remoteVault = vaultOf(remoteAccount)
        )

        requireNotNull(merged)
        assertEquals(1, merged.accounts.size)
        assertEquals("local", merged.accounts.single().accountName)
        assertEquals("Work", merged.accounts.single().group)
        assertEquals(3_000L, merged.accounts.single().updatedAt)
    }

    @Test
    fun returnsConflictForSameFieldChanges() {
        val baseAccount = account(id = "1", issuer = "GitHub")
        val localAccount = baseAccount.copy(issuer = "GitHub Local")
        val remoteAccount = baseAccount.copy(issuer = "GitHub Remote")

        val merged = WebDavAccountMerge.merge(
            metadataFor(vaultOf(baseAccount)),
            localVault = vaultOf(localAccount),
            remoteVault = vaultOf(remoteAccount)
        )

        assertNull(merged)
    }

    @Test
    fun keepsLocalAndRemoteAddedAccountsWhenIdsAreDifferent() {
        val localAccount = account(id = "local", issuer = "Local")
        val remoteAccount = account(id = "remote", issuer = "Remote")

        val merged = WebDavAccountMerge.merge(
            metadataFor(vaultOf()),
            localVault = vaultOf(localAccount),
            remoteVault = vaultOf(remoteAccount)
        )

        requireNotNull(merged)
        assertEquals(setOf("local", "remote"), merged.accounts.map { it.id }.toSet())
    }

    @Test
    fun conflictsWhenEditedAccountWasDeletedOnOtherSide() {
        val baseAccount = account(id = "1", issuer = "GitHub")
        val localAccount = baseAccount.copy(issuer = "GitHub Local")

        val merged = WebDavAccountMerge.merge(
            metadataFor(vaultOf(baseAccount)),
            localVault = vaultOf(localAccount),
            remoteVault = vaultOf()
        )

        assertNull(merged)
    }

    @Test
    fun acceptsDeletionWhenOtherSideIsUnchanged() {
        val baseAccount = account(id = "1", issuer = "GitHub")

        val merged = WebDavAccountMerge.merge(
            metadataFor(vaultOf(baseAccount)),
            localVault = vaultOf(),
            remoteVault = vaultOf(baseAccount)
        )

        requireNotNull(merged)
        assertTrue(merged.accounts.isEmpty())
    }

    private fun metadataFor(baseVault: LocalVault): WebDavSyncMetadata {
        return WebDavSyncMetadata(baseVaultJson = VaultEnvelopeJson.encodeVault(baseVault))
    }

    private fun vaultOf(vararg accounts: TotpAccount): LocalVault {
        return LocalVault(
            schemaVersion = 1,
            accounts = accounts.toList(),
            updatedAt = accounts.maxOfOrNull { it.updatedAt } ?: 1_000L
        )
    }

    private fun account(
        id: String,
        issuer: String,
        accountName: String = "user@example.com",
        group: String = "Default",
        updatedAt: Long = 1_000L
    ): TotpAccount {
        return TotpAccount(
            id = id,
            issuer = issuer,
            accountName = accountName,
            secret = "JBSWY3DPEHPK3PXP",
            algorithm = TotpAlgorithm.SHA1,
            digits = 6,
            period = 30,
            group = group,
            createdAt = 500L,
            updatedAt = updatedAt
        )
    }
}
