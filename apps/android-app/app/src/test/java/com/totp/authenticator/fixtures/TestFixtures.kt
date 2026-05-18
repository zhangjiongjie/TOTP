package com.totp.authenticator.fixtures

object TestFixtures {
    val rfc6238Sha1Vector = Rfc6238Vector(
        secret = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ",
        timestampMillis = 59_000L,
        period = 30,
        digits = 8,
        algorithm = "SHA1",
        expected = "94287082"
    )

    val base32InvalidInputs = listOf("M", "MY===A==", "MZX=====", "MZ")

    val accountFixture = AccountFixture(
        id = "fixture-google-alice",
        issuer = "Google",
        accountName = "alice@example.com",
        secret = "JBSWY3DPEHPK3PXP",
        algorithm = "SHA1",
        digits = 6,
        period = 30,
        group = "Default",
        createdAt = 1_779_010_000_000L,
        updatedAt = 1_779_010_000_000L
    )

    object OtpAuthSamples {
        const val issuerAndAccount =
            "otpauth://totp/GitHub:alice?secret=JBSWY3DPEHPK3PXP&issuer=GitHub"
        const val encodedColon =
            "otpauth://totp/alice%3Awork?secret=JBSWY3DPEHPK3PXP"
        const val defaults =
            "otpauth://totp/alice?secret=JBSWY3DPEHPK3PXP"
        const val nonDecimalDigits =
            "otpauth://totp/alice?secret=JBSWY3DPEHPK3PXP&digits=1e2"
        const val malformedLabel =
            "otpauth://totp/%E0?secret=JBSWY3DPEHPK3PXP"
        const val malformedSecret =
            "otpauth://totp/alice?secret=%E0"
        const val malformedIssuer =
            "otpauth://totp/alice?secret=JBSWY3DPEHPK3PXP&issuer=%E0"
    }
}

data class Rfc6238Vector(
    val secret: String,
    val timestampMillis: Long,
    val period: Int,
    val digits: Int,
    val algorithm: String,
    val expected: String
)

data class AccountFixture(
    val id: String,
    val issuer: String,
    val accountName: String,
    val secret: String,
    val algorithm: String,
    val digits: Int,
    val period: Int,
    val group: String,
    val createdAt: Long,
    val updatedAt: Long
)
