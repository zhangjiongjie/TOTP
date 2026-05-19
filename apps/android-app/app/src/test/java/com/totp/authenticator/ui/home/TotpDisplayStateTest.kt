package com.totp.authenticator.ui.home

import org.junit.Assert.assertEquals
import org.junit.Test

class TotpDisplayStateTest {
    @Test
    fun formatsSixDigitCodeWithMiddleSpace() {
        assertEquals("123 456", formatTotpCode("123456"))
    }

    @Test
    fun leavesNonSixDigitCodesUnchanged() {
        assertEquals("12345678", formatTotpCode("12345678"))
    }

    @Test
    fun calculatesSecondsRemainingWithinCurrentPeriod() {
        assertEquals(30, secondsRemaining(nowMillis = 0L, period = 30))
        assertEquals(15, secondsRemaining(nowMillis = 15_000L, period = 30))
        assertEquals(1, secondsRemaining(nowMillis = 29_000L, period = 30))
    }
}
