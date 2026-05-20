package com.totp.authenticator.app

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.launch

class BackupViewModel : ViewModel() {
    var statusMessage: String by mutableStateOf("")
        private set

    var errorMessage: String by mutableStateOf("")
        private set

    var isBusy: Boolean by mutableStateOf(false)
        private set

    fun updateBusy(busy: Boolean) {
        isBusy = busy
    }

    fun showSuccess(message: String) {
        statusMessage = message
        errorMessage = ""
    }

    fun showError(message: String) {
        errorMessage = message
    }

    fun <T> launchTask(
        finishBusyOnSuccess: Boolean = true,
        task: suspend () -> T,
        onSuccess: (T) -> Unit,
        onFailure: (Throwable) -> Unit
    ) {
        viewModelScope.launch {
            updateBusy(true)
            runCatching {
                task()
            }.onSuccess { result ->
                onSuccess(result)
                if (finishBusyOnSuccess) {
                    updateBusy(false)
                }
            }.onFailure { error ->
                onFailure(error)
                updateBusy(false)
            }
        }
    }
}
