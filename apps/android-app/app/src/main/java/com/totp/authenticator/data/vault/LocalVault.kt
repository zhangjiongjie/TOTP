package com.totp.authenticator.data.vault

import com.totp.authenticator.core.account.TotpAccount

data class LocalVault(
    val schemaVersion: Int,
    val accounts: List<TotpAccount>,
    val updatedAt: Long
)
