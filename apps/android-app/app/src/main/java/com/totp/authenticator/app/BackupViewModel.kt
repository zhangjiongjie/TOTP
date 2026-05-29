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

    var messageVersion: Int by mutableStateOf(0)
        private set

    var isBusy: Boolean by mutableStateOf(false)
        private set

    var pendingExportContent: String? by mutableStateOf(null)
        private set

    var pendingExportFilename: String? by mutableStateOf(null)
        private set

    var pendingImportContent: String? by mutableStateOf(null)
        private set

    var pendingReadyImport: BackupReadyImport? by mutableStateOf(null)
        private set

    var importPickerRequested: Boolean by mutableStateOf(false)
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
        messageVersion += 1
    }

    fun showError(message: String) {
        statusMessage = ""
        errorMessage = message
        messageVersion += 1
    }

    fun clearMessageIfVersion(version: Int) {
        if (messageVersion != version) {
            return
        }
        statusMessage = ""
        errorMessage = ""
    }

    fun clearMessage() {
        statusMessage = ""
        errorMessage = ""
        messageVersion += 1
    }

    fun prepareExport(payload: BackupExportPayload) {
        pendingExportContent = payload.content
        pendingExportFilename = payload.filename
        externalPickerActive = true
    }

    fun consumePendingExportFilename(): String? {
        val filename = pendingExportFilename
        pendingExportFilename = null
        return filename
    }

    fun pendingExportFilenameForPicker(): String? {
        return pendingExportFilename
    }

    fun consumePendingExportContent(): String? {
        val content = pendingExportContent
        pendingExportContent = null
        pendingExportFilename = null
        return content
    }

    fun consumePendingExportPayload(): BackupExportPayload? {
        val content = pendingExportContent ?: return null
        val filename = pendingExportFilename ?: return null
        pendingExportContent = null
        pendingExportFilename = null
        return BackupExportPayload(content = content, filename = filename)
    }

    fun markExternalPickerActive(active: Boolean) {
        externalPickerActive = active
    }

    fun requestImportPicker() {
        externalPickerActive = true
        importPickerRequested = true
    }

    fun consumeImportPickerRequest(): Boolean {
        val requested = importPickerRequested
        importPickerRequested = false
        return requested
    }

    fun requestExportPassword() {
        pendingPasswordAction = BackupPasswordAction.Export
    }

    fun requestImportPassword(content: String) {
        pendingImportContent = content
        pendingPasswordAction = BackupPasswordAction.Import
    }

    fun prepareReadyImport(content: String, password: String) {
        pendingReadyImport = BackupReadyImport(content, password)
    }

    fun consumeReadyImport(): BackupReadyImport? {
        val request = pendingReadyImport
        pendingReadyImport = null
        return request
    }

    fun requestRemotePassword() {
        if (pendingPasswordAction != null || statusMessage.isNotBlank() || errorMessage.isNotBlank()) {
            return
        }
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

data class BackupReadyImport(
    val content: String,
    val password: String
)

data class BackupPasswordRequest(
    val action: BackupPasswordAction,
    val importContent: String?
)

enum class BackupPasswordAction {
    Export,
    Import,
    WebDavSync
}
