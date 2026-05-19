package com.totp.authenticator.core.account

import java.util.Locale

object AccountSorter {
    fun sort(accounts: List<TotpAccount>): List<TotpAccount> {
        return accounts.sortedWith(
            compareBy<TotpAccount> { it.group.lowercase(Locale.US) }
                .thenBy { it.issuer.lowercase(Locale.US) }
                .thenBy { it.accountName.lowercase(Locale.US) }
        )
    }
}
