package com.totp.authenticator.ui.settings

import com.totp.authenticator.data.webdav.WebDavSettings
import com.totp.authenticator.data.webdav.WebDavSyncMetadata
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

data class SettingsScreenState(
    val biometricUnlockEnabled: Boolean,
    val webDavSettings: WebDavSettings,
    val isWebDavBusy: Boolean,
    val uiModel: SettingsUiModel,
    val isPasswordChangeBusy: Boolean,
    val masterPasswordErrorMessage: String
)

data class SettingsScreenActions(
    val onSaveWebDavSettings: (WebDavSettings) -> Unit,
    val onTestWebDav: (WebDavSettings) -> Unit,
    val onSyncWebDav: () -> Unit,
    val onBiometricUnlockChanged: (Boolean) -> Unit,
    val onChangeMasterPassword: (String, String) -> Unit,
    val onExportBackup: () -> Unit,
    val onImportBackup: () -> Unit
)

data class SettingsUiModel(
    val quickUnlockTitle: String,
    val quickUnlockSummary: String,
    val quickUnlockToggleEnabled: Boolean,
    val isRemotePasswordBlocked: Boolean,
    val webDavSavedSummary: String,
    val showWebDavEnableHint: Boolean,
    val webDavStatus: SettingsStatus,
    val webDavActionLabel: String,
    val webDavEnabledLabel: String,
    val showBackupDefaultHint: Boolean,
    val backupStatusMessage: String,
    val backupErrorMessage: String,
    val backupActionsEnabled: Boolean
) {
    companion object {
        fun from(
            biometricUnlockEnabled: Boolean,
            biometricUnlockAvailable: Boolean,
            quickUnlockSetupRequired: Boolean,
            hasStrongBiometric: Boolean,
            isBiometricBusy: Boolean,
            webDavSettings: WebDavSettings,
            webDavMetadata: WebDavSyncMetadata,
            isWebDavBusy: Boolean,
            webDavStatusMessage: String,
            webDavStatusIsError: Boolean,
            backupStatusMessage: String,
            backupErrorMessage: String,
            isBackupBusy: Boolean
        ): SettingsUiModel {
            return SettingsUiModel(
                quickUnlockTitle = if (hasStrongBiometric) "生物识别解锁" else "系统凭证解锁",
                quickUnlockSummary = biometricSummary(
                    available = biometricUnlockAvailable,
                    setupRequired = quickUnlockSetupRequired
                ),
                quickUnlockToggleEnabled = !isBiometricBusy && (biometricUnlockAvailable || quickUnlockSetupRequired),
                isRemotePasswordBlocked = webDavSettings.enabled && isRemotePasswordStatus(webDavMetadata),
                webDavSavedSummary = webDavSummary(webDavSettings),
                showWebDavEnableHint = !webDavSettings.enabled,
                webDavStatus = resolveWebDavStatus(
                    metadata = webDavMetadata,
                    enabled = webDavSettings.enabled,
                    busy = isWebDavBusy,
                    transientMessage = webDavStatusMessage,
                    transientIsError = webDavStatusIsError
                ),
                webDavActionLabel = if (webDavSettings.enabled) "编辑设置" else "设置同步",
                webDavEnabledLabel = if (webDavSettings.enabled) "已启用" else "未启用",
                showBackupDefaultHint = backupStatusMessage.isBlank() && backupErrorMessage.isBlank(),
                backupStatusMessage = backupStatusMessage,
                backupErrorMessage = backupErrorMessage,
                backupActionsEnabled = !isBackupBusy
            )
        }
    }
}

data class SettingsStatus(
    val message: String,
    val tone: SettingsStatusTone
)

enum class SettingsStatusTone {
    Idle,
    Success,
    Error
}

private fun resolveWebDavStatus(
    metadata: WebDavSyncMetadata,
    enabled: Boolean,
    busy: Boolean,
    transientMessage: String,
    transientIsError: Boolean
): SettingsStatus {
    if (!enabled) {
        return SettingsStatus("WebDAV 同步未开启，本地模式。", SettingsStatusTone.Idle)
    }
    if (transientMessage.isNotBlank()) {
        return SettingsStatus(
            transientMessage,
            if (transientIsError) SettingsStatusTone.Error else SettingsStatusTone.Success
        )
    }
    if (busy) {
        return SettingsStatus("同步中...", SettingsStatusTone.Idle)
    }
    if (isRemotePasswordStatus(metadata)) {
        return SettingsStatus("远端保管库需要主密码验证后才能继续同步。", SettingsStatusTone.Error)
    }
    val error = metadata.lastError
    if (error.isNotBlank()) {
        return SettingsStatus(
            if (metadata.lastStatus == "conflict") "同步冲突：$error" else "同步失败：$error",
            SettingsStatusTone.Error
        )
    }
    return when (metadata.lastStatus) {
        "pushed" -> SettingsStatus("同步完成，已推送本地最新数据。", SettingsStatusTone.Success)
        "pulled" -> SettingsStatus("同步完成，已拉取远端最新数据。", SettingsStatusTone.Success)
        "synced", "noop" -> SettingsStatus("同步完成，当前数据已经是最新。", SettingsStatusTone.Success)
        "conflict" -> SettingsStatus("检测到同步冲突，请前往设置页处理。", SettingsStatusTone.Error)
        else -> SettingsStatus("本地与 WebDAV 已经是最新版本。", SettingsStatusTone.Idle)
    }
}

private fun isRemotePasswordStatus(metadata: WebDavSyncMetadata): Boolean {
    val message = metadata.lastError
    return metadata.lastStatus == "blocked" ||
        message.contains("远端保管库") ||
        message.contains("远端密码库") ||
        message.contains("Master password is incorrect") ||
        message.contains("主密码")
}

private fun webDavSummary(settings: WebDavSettings): String {
    if (settings.updatedAt <= 0L) {
        return ""
    }
    val formatted = SimpleDateFormat("yyyy-MM-dd HH:mm", Locale.getDefault()).format(Date(settings.updatedAt))
    return "已保存 $formatted"
}

private fun biometricSummary(available: Boolean, setupRequired: Boolean): String {
    if (setupRequired) {
        return "未设置系统锁屏，点击后前往系统设置。"
    }
    if (!available) {
        return "当前设备不支持快速解锁。"
    }
    return "开启后可用系统凭据解锁。"
}
