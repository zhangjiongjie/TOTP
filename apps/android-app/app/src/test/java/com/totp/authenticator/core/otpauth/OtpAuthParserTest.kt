package com.totp.authenticator.core.otpauth

import com.totp.authenticator.core.totp.TotpAlgorithm
import org.junit.Assert.assertEquals
import org.junit.Test

class OtpAuthParserTest {
    @Test
    fun parsesIssuerAndAccountName() {
        val parsed = OtpAuthParser.parse(
            "otpauth://totp/GitHub:alice?secret=JBSWY3DPEHPK3PXP&issuer=GitHub"
        )

        assertEquals("GitHub", parsed.issuer)
        assertEquals("alice", parsed.accountName)
        assertEquals("JBSWY3DPEHPK3PXP", parsed.secret)
    }

    @Test
    fun keepsEncodedColonInsideAccountName() {
        val parsed = OtpAuthParser.parse(
            "otpauth://totp/alice%3Awork?secret=JBSWY3DPEHPK3PXP"
        )

        assertEquals("", parsed.issuer)
        assertEquals("alice:work", parsed.accountName)
    }

    @Test
    fun usesDefaultParameters() {
        val parsed = OtpAuthParser.parse(
            "otpauth://totp/GitHub:alice?secret=JBSWY3DPEHPK3PXP"
        )

        assertEquals(6, parsed.digits)
        assertEquals(30, parsed.period)
        assertEquals(TotpAlgorithm.SHA1, parsed.algorithm)
    }

    @Test
    fun acceptsUnescapedSpacesInLabel() {
        val parsed = OtpAuthParser.parse(
            "otpauth://totp/GitHub:alice smith?secret=JBSWY3DPEHPK3PXP&issuer=GitHub"
        )

        assertEquals("GitHub", parsed.issuer)
        assertEquals("alice smith", parsed.accountName)
    }

    @Test
    fun keepsAlreadyEncodedSpacesInLabel() {
        val parsed = OtpAuthParser.parse(
            "otpauth://totp/GitHub:alice%20smith?secret=JBSWY3DPEHPK3PXP&issuer=GitHub"
        )

        assertEquals("GitHub", parsed.issuer)
        assertEquals("alice smith", parsed.accountName)
    }

    @Test
    fun rejectsInvalidUris() {
        val invalidUris = listOf(
            "otpauth://totp/GitHub:alice?secret=JBSWY3DPEHPK3PXP&digits=abc",
            "otpauth://totp/%E0?secret=JBSWY3DPEHPK3PXP",
            "otpauth://totp/GitHub:alice?secret=not-valid!",
            "otpauth://totp/GitHub:alice?secret=JBSWY3DPEHPK3PXP&issuer=%E0"
        )

        invalidUris.forEach { uri ->
            try {
                OtpAuthParser.parse(uri)
                throw AssertionError("Expected InvalidOtpAuthUriException for $uri")
            } catch (_: InvalidOtpAuthUriException) {
                // Expected.
            }
        }
    }
}
