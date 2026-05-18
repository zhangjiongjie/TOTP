package com.totp.authenticator.ui.brand

import org.junit.Assert.assertEquals
import org.junit.Test

class BrandIconMatcherTest {
    @Test
    fun matchesKnownIssuers() {
        assertEquals(BrandIcon.Google, BrandIconMatcher.match("Google"))
        assertEquals(BrandIcon.GitHub, BrandIconMatcher.match("github"))
        assertEquals(BrandIcon.OpenAI, BrandIconMatcher.match("OpenAI Platform"))
    }

    @Test
    fun fallsBackToDefault() {
        assertEquals(BrandIcon.Default, BrandIconMatcher.match("Unknown Service"))
    }
}
