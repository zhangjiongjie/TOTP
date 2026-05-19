package com.totp.authenticator.data.webdav

import com.totp.authenticator.core.account.TotpAccount
import com.totp.authenticator.data.vault.LocalVault
import com.totp.authenticator.data.vault.VaultEnvelopeJson

internal object WebDavAccountMerge {
    fun merge(metadata: WebDavSyncMetadata, localVault: LocalVault, remoteVault: LocalVault): LocalVault? {
        val baseVault = loadBaseVault(metadata) ?: return null
        val mergedAccounts = mergeAccountRecords(baseVault.accounts, localVault.accounts, remoteVault.accounts) ?: return null
        return LocalVault(
            schemaVersion = maxOf(baseVault.schemaVersion, localVault.schemaVersion, remoteVault.schemaVersion),
            accounts = mergedAccounts,
            updatedAt = maxOf(baseVault.updatedAt, localVault.updatedAt, remoteVault.updatedAt, System.currentTimeMillis())
        )
    }

    private fun loadBaseVault(metadata: WebDavSyncMetadata): LocalVault? {
        if (metadata.baseVaultJson.isBlank()) return null
        return runCatching { VaultEnvelopeJson.decodeVault(metadata.baseVaultJson) }.getOrNull()
    }

    private fun mergeAccountRecords(
        baseAccounts: List<TotpAccount>,
        localAccounts: List<TotpAccount>,
        remoteAccounts: List<TotpAccount>
    ): List<TotpAccount>? {
        val baseMap = baseAccounts.associateBy { it.id }
        val localMap = localAccounts.associateBy { it.id }
        val remoteMap = remoteAccounts.associateBy { it.id }
        val accountIds = linkedSetOf<String>().apply {
            addAll(baseAccounts.map { it.id })
            addAll(localAccounts.map { it.id })
            addAll(remoteAccounts.map { it.id })
        }

        val mergedAccounts = mutableListOf<TotpAccount>()
        accountIds.forEach { accountId ->
            when (val result = mergeSingleAccount(baseMap[accountId], localMap[accountId], remoteMap[accountId])) {
                AccountMerge.Conflict -> return null
                AccountMerge.Deleted -> Unit
                is AccountMerge.Kept -> mergedAccounts += result.account
            }
        }
        return mergedAccounts.sortedByDescending { it.updatedAt }
    }

    private fun mergeSingleAccount(
        baseAccount: TotpAccount?,
        localAccount: TotpAccount?,
        remoteAccount: TotpAccount?
    ): AccountMerge {
        if (baseAccount == null) {
            return when {
                localAccount != null && remoteAccount != null && accountsEquivalent(localAccount, remoteAccount) -> AccountMerge.Kept(localAccount)
                localAccount != null && remoteAccount != null -> AccountMerge.Conflict
                localAccount != null -> AccountMerge.Kept(localAccount)
                remoteAccount != null -> AccountMerge.Kept(remoteAccount)
                else -> AccountMerge.Deleted
            }
        }

        if (localAccount == null && remoteAccount == null) return AccountMerge.Deleted
        if (localAccount == null && remoteAccount != null) {
            return if (accountsEquivalent(baseAccount, remoteAccount)) AccountMerge.Deleted else AccountMerge.Conflict
        }
        if (localAccount != null && remoteAccount == null) {
            return if (accountsEquivalent(baseAccount, localAccount)) AccountMerge.Deleted else AccountMerge.Conflict
        }
        require(localAccount != null && remoteAccount != null)

        if (accountsEquivalent(localAccount, remoteAccount)) return AccountMerge.Kept(localAccount)

        val issuer = mergeField(baseAccount.issuer, localAccount.issuer, remoteAccount.issuer) ?: return AccountMerge.Conflict
        val accountName = mergeField(baseAccount.accountName, localAccount.accountName, remoteAccount.accountName) ?: return AccountMerge.Conflict
        val secret = mergeField(baseAccount.secret, localAccount.secret, remoteAccount.secret) ?: return AccountMerge.Conflict
        val digits = mergeField(baseAccount.digits, localAccount.digits, remoteAccount.digits) ?: return AccountMerge.Conflict
        val period = mergeField(baseAccount.period, localAccount.period, remoteAccount.period) ?: return AccountMerge.Conflict
        val algorithm = mergeField(baseAccount.algorithm, localAccount.algorithm, remoteAccount.algorithm) ?: return AccountMerge.Conflict
        val group = mergeField(baseAccount.group, localAccount.group, remoteAccount.group) ?: return AccountMerge.Conflict

        return AccountMerge.Kept(
            baseAccount.copy(
                issuer = issuer,
                accountName = accountName,
                secret = secret,
                digits = digits,
                period = period,
                algorithm = algorithm,
                group = group,
                createdAt = minOf(baseAccount.createdAt, localAccount.createdAt, remoteAccount.createdAt),
                updatedAt = maxOf(baseAccount.updatedAt, localAccount.updatedAt, remoteAccount.updatedAt)
            )
        )
    }

    private fun <T> mergeField(baseValue: T, localValue: T, remoteValue: T): T? {
        return when {
            localValue == remoteValue -> localValue
            localValue == baseValue -> remoteValue
            remoteValue == baseValue -> localValue
            else -> null
        }
    }

    private fun accountsEquivalent(left: TotpAccount, right: TotpAccount): Boolean {
        return left.id == right.id &&
            left.issuer == right.issuer &&
            left.accountName == right.accountName &&
            left.secret == right.secret &&
            left.digits == right.digits &&
            left.period == right.period &&
            left.algorithm == right.algorithm &&
            left.group == right.group
    }

    private sealed interface AccountMerge {
        data object Conflict : AccountMerge
        data object Deleted : AccountMerge
        data class Kept(val account: TotpAccount) : AccountMerge
    }
}
