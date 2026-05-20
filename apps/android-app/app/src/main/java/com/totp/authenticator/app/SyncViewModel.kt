package com.totp.authenticator.app

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.totp.authenticator.data.webdav.WebDavSettings
import com.totp.authenticator.data.webdav.WebDavSyncMetadata
import kotlinx.coroutines.Job
import kotlinx.coroutines.launch

class SyncViewModel(
    initialSettings: WebDavSettings,
    initialMetadata: WebDavSyncMetadata
) : ViewModel() {
    var webDavSettings: WebDavSettings by mutableStateOf(initialSettings)
        private set

    var webDavMetadata: WebDavSyncMetadata by mutableStateOf(initialMetadata)
        private set

    var isBusy: Boolean by mutableStateOf(false)
        private set

    var homeCopyStatusMessage: String by mutableStateOf("")
        private set

    var homeErrorStatusMessage: String by mutableStateOf("")
        private set

    var webDavStatusMessage: String by mutableStateOf("")
        private set

    var webDavStatusIsError: Boolean by mutableStateOf(false)
        private set

    var hasSyncedAfterUnlock: Boolean by mutableStateOf(false)
        private set

    private var activeOperations = 0
    private var syncJob: Job? = null

    fun launchExclusiveSync(block: suspend () -> Unit) {
        syncJob?.cancel()
        val nextJob = viewModelScope.launch {
            beginOperation()
            try {
                block()
            } finally {
                endOperation()
            }
        }
        syncJob = nextJob
        nextJob.invokeOnCompletion {
            if (syncJob == nextJob) {
                syncJob = null
            }
        }
    }

    fun <T> launchExclusiveSyncTask(
        task: suspend () -> T,
        onSuccess: (T) -> Unit,
        onFailure: (Throwable) -> Unit
    ) {
        launchExclusiveSync {
            runCatching {
                task()
            }.onSuccess(onSuccess)
                .onFailure(onFailure)
        }
    }

    fun beginOperation() {
        activeOperations += 1
        isBusy = true
    }

    fun endOperation() {
        if (activeOperations > 0) {
            activeOperations -= 1
        }
        isBusy = activeOperations > 0
    }

    fun markSyncedAfterUnlock() {
        hasSyncedAfterUnlock = true
    }

    fun resetSyncedAfterUnlock() {
        hasSyncedAfterUnlock = false
    }

    fun updateSettings(settings: WebDavSettings) {
        webDavSettings = settings
    }

    fun updateMetadata(metadata: WebDavSyncMetadata) {
        webDavMetadata = metadata
    }

    fun showHomeCopy(message: String) {
        homeCopyStatusMessage = message
        homeErrorStatusMessage = ""
    }

    fun showHomeError(message: String) {
        homeErrorStatusMessage = message
    }

    fun clearHomeMessages() {
        homeCopyStatusMessage = ""
        homeErrorStatusMessage = ""
    }

    fun showSettingsCopy(message: String) {
        webDavStatusMessage = message
        webDavStatusIsError = false
    }

    fun showSettingsError(message: String) {
        webDavStatusMessage = message
        webDavStatusIsError = true
    }

    fun clearSettingsMessage() {
        webDavStatusMessage = ""
        webDavStatusIsError = false
    }
}
