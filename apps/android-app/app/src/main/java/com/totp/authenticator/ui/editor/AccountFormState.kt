package com.totp.authenticator.ui.editor

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import com.totp.authenticator.core.account.AccountValidationError
import com.totp.authenticator.core.account.AccountValidator
import com.totp.authenticator.core.account.TotpAccount
import com.totp.authenticator.core.otpauth.OtpAuthParser
import com.totp.authenticator.core.totp.TotpAlgorithm
import com.totp.authenticator.core.totp.TotpGenerator
import java.util.UUID

class AccountFormState(existing: TotpAccount? = null) {
    var issuer by mutableStateOf(existing?.issuer.orEmpty())
    var accountName by mutableStateOf(existing?.accountName.orEmpty())
    var secret by mutableStateOf(existing?.secret.orEmpty())
    var digits by mutableStateOf((existing?.digits ?: 6).toString())
    var period by mutableStateOf((existing?.period ?: 30).toString())
    var algorithm by mutableStateOf(existing?.algorithm ?: TotpAlgorithm.SHA1)
    var group by mutableStateOf(existing?.group ?: "Default")
    var errors by mutableStateOf<List<String>>(emptyList())
        private set

    fun applyOtpAuthUri(value: String): Boolean {
        return runCatching { OtpAuthParser.parse(value) }
            .onSuccess { parsed ->
                issuer = parsed.issuer
                accountName = parsed.accountName
                secret = parsed.secret
                digits = parsed.digits.toString()
                period = parsed.period.toString()
                algorithm = parsed.algorithm
                errors = emptyList()
            }
            .onFailure {
                errors = listOf("Invalid otpauth URI")
            }
            .isSuccess
    }

    fun toAccount(existing: TotpAccount?, nowMillis: Long): TotpAccount? {
        val digitsInt = digits.toIntOrNull()
        val periodInt = period.toIntOrNull()
        if (digitsInt == null || periodInt == null) {
            val fieldErrors = buildList {
                if (digitsInt == null) add(AccountValidationError.DigitsOutOfRange)
                if (periodInt == null) add(AccountValidationError.PeriodInvalid)
            }
            errors = fieldErrors.map { it.message }
            return null
        }

        val result = AccountValidator.validate(
            issuer = issuer,
            accountName = accountName,
            secret = secret,
            digits = digitsInt,
            period = periodInt,
            algorithm = algorithm,
            group = group
        )
        if (!result.isValid) {
            errors = result.errors.map { it.message }
            return null
        }

        runCatching {
            TotpGenerator.generate(
                secret = secret,
                timestampMillis = nowMillis,
                period = periodInt,
                digits = digitsInt,
                algorithm = algorithm
            )
        }.onFailure {
            errors = listOf("Unable to generate TOTP code")
            return null
        }

        errors = emptyList()
        return TotpAccount(
            id = existing?.id ?: UUID.randomUUID().toString(),
            issuer = issuer.trim(),
            accountName = accountName.trim(),
            secret = secret.trim(),
            algorithm = algorithm,
            digits = digitsInt,
            period = periodInt,
            group = group.trim(),
            createdAt = existing?.createdAt ?: nowMillis,
            updatedAt = nowMillis
        )
    }
}

private val AccountValidationError.message: String
    get() = when (this) {
        AccountValidationError.IssuerRequired -> "Issuer is required"
        AccountValidationError.AccountNameRequired -> "Account name is required"
        AccountValidationError.SecretRequired -> "Secret is required"
        AccountValidationError.SecretInvalid -> "Secret must be valid Base32"
        AccountValidationError.GroupRequired -> "Group is required"
        AccountValidationError.DigitsOutOfRange -> "Digits must be between 6 and 8"
        AccountValidationError.PeriodInvalid -> "Period must be greater than 0"
    }
