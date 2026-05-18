package com.totp.authenticator.core.account

import com.totp.authenticator.core.totp.TotpAlgorithm
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class AccountValidatorTest {
    @Test
    fun validAccountIsValid() {
        val result = validate()

        assertTrue(result.isValid)
        assertTrue(result.errors.isEmpty())
    }

    @Test
    fun missingIssuerReturnsIssuerError() {
        val result = validate(issuer = " ")

        assertEquals(setOf(AccountValidationError.IssuerRequired), result.errors)
    }

    @Test
    fun missingAccountNameReturnsAccountNameError() {
        val result = validate(accountName = " ")

        assertEquals(setOf(AccountValidationError.AccountNameRequired), result.errors)
    }

    @Test
    fun missingSecretReturnsSecretError() {
        val result = validate(secret = " ")

        assertEquals(setOf(AccountValidationError.SecretRequired), result.errors)
    }

    private fun validate(
        issuer: String = "GitHub",
        accountName: String = "alice",
        secret: String = "JBSWY3DPEHPK3PXP",
        digits: Int = 6,
        period: Int = 30,
        algorithm: TotpAlgorithm = TotpAlgorithm.SHA1,
        group: String = "Default"
    ): AccountValidationResult {
        return AccountValidator.validate(
            issuer = issuer,
            accountName = accountName,
            secret = secret,
            digits = digits,
            period = period,
            algorithm = algorithm,
            group = group,
        )
    }
}
