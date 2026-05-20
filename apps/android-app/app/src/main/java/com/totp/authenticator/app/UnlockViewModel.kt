package com.totp.authenticator.app

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.launch

class UnlockViewModel : ViewModel() {
    var errorMessage: String? by mutableStateOf(null)
        private set

    var isBusy: Boolean by mutableStateOf(false)
        private set

    fun showError(message: String) {
        errorMessage = message
    }

    fun clearError() {
        errorMessage = null
    }

    fun <T> launchTask(
        task: suspend () -> T,
        onSuccess: (T) -> Unit,
        onFailure: (Throwable) -> Unit
    ) {
        if (isBusy) return
        viewModelScope.launch {
            isBusy = true
            try {
                val result = task()
                clearError()
                onSuccess(result)
            } catch (error: CancellationException) {
                throw error
            } catch (error: Throwable) {
                onFailure(error)
            } finally {
                isBusy = false
            }
        }
    }
}
