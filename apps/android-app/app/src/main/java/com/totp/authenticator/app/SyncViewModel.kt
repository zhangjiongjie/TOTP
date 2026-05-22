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

    val isRemotePasswordBlocked: Boolean
        get() = webDavSettings.enabled &&
            (webDavMetadata.lastStatus == "blocked" ||
                isRemotePasswordStatus(webDavMetadata.lastError))

    val homeSyncStatus: String
        get() {
            if (isBusy) {
                return "同步中..."
            }
            if (!webDavSettings.enabled) {
                return "WebDAV 同步未开启，本地模式。"
            }
            if (isRemotePasswordBlocked) {
                return "远端保管库需要主密码验证后才能继续同步。"
            }
            if (webDavMetadata.lastError.isNotBlank()) {
                return if (webDavMetadata.lastStatus == "conflict") {
                    "同步冲突：${webDavMetadata.lastError}"
                } else {
                    "同步失败：${webDavMetadata.lastError}"
                }
            }
            return when (webDavMetadata.lastStatus) {
                "pushed" -> "同步完成，已推送本地最新数据。"
                "pulled" -> "同步完成，已拉取远端最新数据。"
                "synced", "noop" -> "本地与 WebDAV 已经是最新版本。"
                "idle" -> "WebDAV 同步已开启，等待首次同步。"
                "disabled" -> "WebDAV 同步未开启，本地模式。"
                "conflict" -> "检测到同步冲突，请前往设置页处理。"
                else -> "WebDAV 同步已开启，等待首次同步。"
            }
        }

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

    private fun isRemotePasswordStatus(message: String): Boolean {
        return message.contains("远端保管库") ||
            message.contains("远端密码库") ||
            message.contains("Master password is incorrect") ||
            message.contains("主密码")
    }
}
