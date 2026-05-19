package com.totp.authenticator.core.account

import com.totp.authenticator.core.totp.Base32
import com.totp.authenticator.core.totp.InvalidBase32Exception
import com.totp.authenticator.core.totp.TotpAlgorithm

enum class AccountValidationError {
    IssuerRequired,
    AccountNameRequired,
    SecretRequired,
    SecretInvalid,
    GroupRequired,
    DigitsOutOfRange,
    PeriodInvalid
}

data class AccountValidationResult(
    val errors: Set<AccountValidationError>
) {
    val isValid: Boolean = errors.isEmpty()
}

object AccountValidator {
    fun validate(
        issuer: String,
        accountName: String,
        secret: String,
        digits: Int,
        period: Int,
        algorithm: TotpAlgorithm,
        group: String
    ): AccountValidationResult {
        val errors = linkedSetOf<AccountValidationError>()

        if (issuer.isBlank()) {
            errors.add(AccountValidationError.IssuerRequired)
        }
        if (accountName.isBlank()) {
            errors.add(AccountValidationError.AccountNameRequired)
        }
        if (secret.isBlank()) {
            errors.add(AccountValidationError.SecretRequired)
        } else if (!isValidBase32(secret)) {
            errors.add(AccountValidationError.SecretInvalid)
        }
        if (group.isBlank()) {
            errors.add(AccountValidationError.GroupRequired)
        }
        if (digits !in 6..8) {
            errors.add(AccountValidationError.DigitsOutOfRange)
        }
        if (period <= 0) {
            errors.add(AccountValidationError.PeriodInvalid)
        }

        return AccountValidationResult(errors)
    }

    fun validate(account: TotpAccount): AccountValidationResult {
        return validate(
            issuer = account.issuer,
            accountName = account.accountName,
            secret = account.secret,
            digits = account.digits,
            period = account.period,
            algorithm = account.algorithm,
            group = account.group
        )
    }

    private fun isValidBase32(secret: String): Boolean {
        return try {
            Base32.decode(secret)
            true
        } catch (_: InvalidBase32Exception) {
            false
        }
    }
}
