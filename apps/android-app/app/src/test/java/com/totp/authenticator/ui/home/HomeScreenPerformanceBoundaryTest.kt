package com.totp.authenticator.ui.home

import java.io.File
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class HomeScreenPerformanceBoundaryTest {
    @Test
    fun homeScreenDoesNotReceiveGlobalTickerFromTotpApp() {
        val appSource = File("src/main/java/com/totp/authenticator/app/TotpApp.kt").readText()
        val homeSource = File("src/main/java/com/totp/authenticator/ui/home/HomeScreen.kt").readText()

        assertFalse("TotpApp should not own a one-second home ticker", appSource.contains("var nowMillis"))
        assertFalse("TotpApp should not pass nowMillis into HomeScreen", appSource.contains("nowMillis = nowMillis"))
        assertFalse("HomeScreen should not receive nowMillis as a top-level parameter", homeSource.contains("nowMillis: Long"))
    }

    @Test
    fun sortedAccountsAreMemoizedByVaultAccounts() {
        val source = File("src/main/java/com/totp/authenticator/ui/home/HomeScreen.kt").readText()

        assertTrue("HomeScreen should remember sorted accounts while the vault account list is unchanged", source.contains("remember(vault.accounts)"))
        assertTrue("AccountSorter.sort should be inside the remembered calculation", source.contains("remember(vault.accounts) { AccountSorter.sort(vault.accounts) }"))
    }
}
