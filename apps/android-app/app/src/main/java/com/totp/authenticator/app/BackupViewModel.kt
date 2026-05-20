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

    var pendingExportContent: String? by mutableStateOf(null)
        private set

    var pendingExportFilename: String? by mutableStateOf(null)
        private set

    var pendingImportContent: String? by mutableStateOf(null)
        private set

    var pendingPasswordAction: BackupPasswordAction? by mutableStateOf(null)
        private set

    var externalPickerActive: Boolean by mutableStateOf(false)
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

    fun prepareExport(payload: BackupExportPayload) {
        pendingExportContent = payload.content
        pendingExportFilename = payload.filename
        externalPickerActive = true
    }

    fun consumePendingExportContent(): String? {
        val content = pendingExportContent
        pendingExportContent = null
        pendingExportFilename = null
        return content
    }

    fun markExternalPickerActive(active: Boolean) {
        externalPickerActive = active
    }

    fun requestExportPassword() {
        pendingPasswordAction = BackupPasswordAction.Export
    }

    fun requestImportPassword(content: String) {
        pendingImportContent = content
        pendingPasswordAction = BackupPasswordAction.Import
    }

    fun requestRemotePassword() {
        pendingPasswordAction = BackupPasswordAction.WebDavSync
    }

    fun dismissPasswordPrompt() {
        pendingPasswordAction = null
        pendingImportContent = null
        updateBusy(false)
    }

    fun consumePasswordRequest(): BackupPasswordRequest? {
        val action = pendingPasswordAction ?: return null
        val request = BackupPasswordRequest(action, pendingImportContent)
        pendingPasswordAction = null
        pendingImportContent = null
        return request
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

data class BackupPasswordRequest(
    val action: BackupPasswordAction,
    val importContent: String?
)

enum class BackupPasswordAction {
    Export,
    Import,
    WebDavSync
}
