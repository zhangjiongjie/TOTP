package com.totp.authenticator.ui.editor

import com.totp.authenticator.core.totp.TotpAlgorithm
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test

class AccountFormStateTest {
    @Test
    fun fillsFromOtpAuthUri() {
        val state = AccountFormState()

        val result = state.applyOtpAuthUri(
            "otpauth://totp/GitHub:alice?secret=JBSWY3DPEHPK3PXP&issuer=GitHub"
        )

        assertTrue(result)
        assertEquals("GitHub", state.issuer)
        assertEquals("alice", state.accountName)
        assertEquals("JBSWY3DPEHPK3PXP", state.secret)
        assertEquals(TotpAlgorithm.SHA1, state.algorithm)
    }

    @Test
    fun toAccountReturnsAccountForValidTotpFields() {
        val state = AccountFormState().apply {
            issuer = "GitHub"
            accountName = "alice"
            secret = "JBSWY3DPEHPK3PXP"
            digits = "6"
            period = "30"
            algorithm = TotpAlgorithm.SHA1
            group = "Work"
        }

        val account = state.toAccount(existing = null, nowMillis = 1_700_000_000_000L)

        assertNotNull(account)
        requireNotNull(account)
        assertEquals("GitHub", account.issuer)
        assertEquals("alice", account.accountName)
        assertEquals("JBSWY3DPEHPK3PXP", account.secret)
        assertEquals(6, account.digits)
        assertEquals(30, account.period)
        assertEquals(TotpAlgorithm.SHA1, account.algorithm)
        assertEquals("Work", account.group)
        assertEquals(1_700_000_000_000L, account.createdAt)
        assertEquals(1_700_000_000_000L, account.updatedAt)
        assertTrue(state.errors.isEmpty())
    }
}
