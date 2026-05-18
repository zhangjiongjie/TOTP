package com.totp.authenticator.core.totp

import com.totp.authenticator.fixtures.TestFixtures
import org.junit.Assert.assertEquals
import org.junit.Test

class TotpGeneratorTest {
    @Test
    fun generatesRfc6238Sha1Vector() {
        val fixture = TestFixtures.rfc6238Sha1Vector

        val actual = TotpGenerator.generate(
            secret = fixture.secret,
            timestampMillis = fixture.timestampMillis,
            period = fixture.period,
            digits = fixture.digits,
            algorithm = TotpAlgorithm.SHA1
        )

        assertEquals(fixture.expected, actual)
    }
}
