package com.totp.authenticator.ui.unlock

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue

class UnlockFormState(
    private val hasExistingVault: Boolean
) {
    var password by mutableStateOf("")
    var localError by mutableStateOf<String?>(null)
        private set

    val showsConfirmation: Boolean = false

    val actionLabel: String
        get() = if (hasExistingVault) "Unlock" else "Create vault"

    fun busyLabel(isBusy: Boolean): String {
        return if (!isBusy) {
            actionLabel
        } else if (hasExistingVault) {
            "Unlocking..."
        } else {
            "Creating..."
        }
    }

    fun submit(): UnlockFormSubmission {
        val normalizedPassword = password.trim()
        return when {
            normalizedPassword.isEmpty() -> {
                localError = "Password is required"
                UnlockFormSubmission.Invalid(localError.orEmpty())
            }
            hasExistingVault -> UnlockFormSubmission.Unlock(normalizedPassword)
            else -> UnlockFormSubmission.Create(normalizedPassword)
        }
    }

    fun clearError() {
        localError = null
    }
}

sealed interface UnlockFormSubmission {
    data class Create(val password: String) : UnlockFormSubmission
    data class Unlock(val password: String) : UnlockFormSubmission
    data class Invalid(val message: String) : UnlockFormSubmission
}
