package com.totp.authenticator.app

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import javax.crypto.AEADBadTagException
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

class PasswordChangeViewModel : ViewModel() {
    var dialogVisible: Boolean by mutableStateOf(false)
        private set

    var inProgress: Boolean by mutableStateOf(false)
        private set

    var dialogMessage: String by mutableStateOf("")
        private set

    var dialogIsError: Boolean by mutableStateOf(false)
        private set

    var masterPasswordErrorMessage: String by mutableStateOf("")
        private set

    fun start() {
        dialogVisible = true
        inProgress = true
        dialogMessage = "正在更新主密码..."
        dialogIsError = false
        masterPasswordErrorMessage = ""
    }

    fun <T> launchChange(
        successMessage: String,
        task: suspend () -> T,
        onSuccess: (T) -> Unit,
        onFailure: (Throwable) -> Unit
    ) {
        viewModelScope.launch {
            runChange(successMessage, task, onSuccess, onFailure)
        }
    }

    suspend fun <T> runChange(
        successMessage: String,
        task: suspend () -> T,
        onSuccess: (T) -> Unit,
        onFailure: (Throwable) -> Unit
    ) {
        start()
        try {
            val result = task()
            onSuccess(result)
            inProgress = false
            dialogMessage = successMessage
            dialogIsError = false
            delay(DISMISS_DELAY_MS)
            dialogVisible = false
        } catch (error: CancellationException) {
            inProgress = false
            dialogVisible = false
            throw error
        } catch (error: Throwable) {
            val message = userFacingError(error)
            masterPasswordErrorMessage = message
            onFailure(error)
            inProgress = false
            dialogMessage = message
            dialogIsError = true
            delay(DISMISS_DELAY_MS)
            dialogVisible = false
        }
    }

    fun userFacingError(error: Throwable): String {
        val message = error.message.orEmpty()
        return when {
            error is AEADBadTagException -> "当前主密码错误"
            message.contains("Tag mismatch", ignoreCase = true) -> "当前主密码错误"
            message.contains("mac check", ignoreCase = true) -> "当前主密码错误"
            message.contains("unable to decrypt", ignoreCase = true) -> "当前主密码错误"
            message.contains("Could not unlock", ignoreCase = true) -> "当前主密码错误"
            else -> message.ifBlank { "主密码修改失败" }
        }
    }

    private companion object {
        const val DISMISS_DELAY_MS = 1_600L
    }
}
