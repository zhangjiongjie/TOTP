package com.totp.authenticator.app

sealed interface TotpRoute {
    data object Unlock : TotpRoute
    data object Home : TotpRoute
    data object Add : TotpRoute
    data class Edit(val accountId: String) : TotpRoute
    data object Settings : TotpRoute
}
