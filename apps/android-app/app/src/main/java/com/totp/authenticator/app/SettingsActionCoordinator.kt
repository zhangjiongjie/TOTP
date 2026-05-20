package com.totp.authenticator.app

import com.totp.authenticator.data.webdav.WebDavSettings
import com.totp.authenticator.data.webdav.WebDavSyncResult
import com.totp.authenticator.data.webdav.WebDavSyncService
import com.totp.authenticator.ui.settings.SettingsScreenActions
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

class SettingsActionCoordinator(
    private val appState: TotpApplicationState,
    private val syncState: SyncViewModel,
    private val quickUnlockState: QuickUnlockViewModel,
    private val passwordChangeState: PasswordChangeViewModel,
    private val webDavFlowCoordinator: WebDavFlowCoordinator,
    private val webDavSyncService: WebDavSyncService,
    private val appScope: CoroutineScope,
    private val onRefreshQuickUnlockAvailability: () -> Unit,
    private val onEnableQuickUnlock: (ByteArray) -> Unit,
    private val onDisableQuickUnlock: () -> Unit,
    private val onResetQuickUnlockAfterPasswordChange: () -> Unit,
    private val onRefreshQuickUnlockCredentialIfNeeded: (ByteArray?, ByteArray) -> Unit,
    private val onRemotePasswordNeeded: () -> Unit,
    private val onVaultLocked: () -> Unit,
    private val onExportBackup: () -> Unit,
    private val onImportBackup: () -> Unit
) {
    fun buildActions(): SettingsScreenActions {
        return SettingsScreenActions(
            onSaveWebDavSettings = ::saveWebDavSettings,
            onTestWebDav = ::testWebDav,
            onSyncWebDav = ::syncWebDav,
            onBiometricUnlockChanged = ::changeQuickUnlock,
            onChangeMasterPassword = ::changeMasterPassword,
            onExportBackup = onExportBackup,
            onImportBackup = onImportBackup
        )
    }

    private fun saveWebDavSettings(settings: WebDavSettings) {
        syncState.launchExclusiveSyncTask(
            task = {
                withContext(Dispatchers.IO) {
                    webDavFlowCoordinator.saveSettingsAndSyncIfUnlocked(
                        settings = settings,
                        isUnlocked = appState.vault != null,
                        password = appState.activePassword,
                        vaultKey = appState.activeVaultKey
                    )
                }
            },
            onSuccess = { settingsFlowResult ->
                val syncFlowResult = settingsFlowResult.syncFlowResult
                val syncResult = syncFlowResult?.syncResult
                val refreshedVault = syncFlowResult?.refreshedVault
                val nextVaultKey = syncFlowResult?.vaultKey
                syncState.updateSettings(settingsFlowResult.settings)
                syncState.updateMetadata(settingsFlowResult.metadata)
                val password = appState.activePassword
                if (refreshedVault != null) {
                    if (password != null && nextVaultKey != null) {
                        val previousVaultKey = appState.activeVaultKey
                        appState.updateUnlockedVault(refreshedVault, password, nextVaultKey)
                        if (syncResult?.vaultKey != null) {
                            onRefreshQuickUnlockCredentialIfNeeded(previousVaultKey, nextVaultKey)
                        }
                    } else if (nextVaultKey != null) {
                        appState.updateUnlockedVaultWithKey(refreshedVault, nextVaultKey)
                    }
                }
                if (syncResult != null) {
                    showSyncResult(syncResult)
                } else {
                    val message = if (settingsFlowResult.settings.enabled) "WebDAV 设置已保存" else ""
                    syncState.showHomeCopy(message)
                    syncState.showSettingsCopy(message)
                }
            },
            onFailure = { error ->
                val message = error.message ?: "无法保存 WebDAV 设置"
                syncState.showHomeError(message)
                syncState.showSettingsError(message)
            }
        )
    }

    private fun testWebDav(settings: WebDavSettings) {
        syncState.launchExclusiveSyncTask(
            task = {
                withContext(Dispatchers.IO) {
                    webDavFlowCoordinator.testConnection(settings)
                }
            },
            onSuccess = {
                syncState.showHomeCopy("WebDAV 连接正常")
                syncState.showSettingsCopy("WebDAV 连接正常")
            },
            onFailure = { error ->
                val message = error.message ?: "WebDAV 测试失败"
                syncState.showHomeError(message)
                syncState.showSettingsError(message)
            }
        )
    }

    private fun syncWebDav() {
        val password = appState.activePassword
        val vaultKey = appState.activeVaultKey
        if (appState.vault == null || (password == null && vaultKey == null)) {
            syncState.showHomeError("保管库未解锁")
            syncState.showSettingsError("保管库未解锁")
            return
        }
        syncState.launchExclusiveSyncTask(
            task = {
                withContext(Dispatchers.IO) {
                    webDavFlowCoordinator.syncUnlocked(password, vaultKey)
                }
            },
            onSuccess = { flowResult ->
                val result = flowResult.syncResult
                val refreshedVault = flowResult.refreshedVault
                val nextVaultKey = flowResult.vaultKey
                syncState.updateMetadata(flowResult.metadata)
                if (refreshedVault != null) {
                    if (password != null && nextVaultKey != null) {
                        val previousVaultKey = appState.activeVaultKey
                        appState.updateUnlockedVault(refreshedVault, password, nextVaultKey)
                        if (result.vaultKey != null) {
                            onRefreshQuickUnlockCredentialIfNeeded(previousVaultKey, nextVaultKey)
                        }
                    } else if (nextVaultKey != null) {
                        appState.updateUnlockedVaultWithKey(refreshedVault, nextVaultKey)
                    }
                }
                showSyncResult(result)
            },
            onFailure = { error ->
                syncState.updateMetadata(webDavSyncService.loadMetadata())
                val message = error.message ?: "WebDAV 同步失败"
                syncState.showHomeError(message)
                syncState.showSettingsError(message)
            }
        )
    }

    private fun changeQuickUnlock(enabled: Boolean) {
        onRefreshQuickUnlockAvailability()
        val vaultKey = appState.activeVaultKey
        if (enabled) {
            if (vaultKey == null) {
                onVaultLocked()
            } else {
                onEnableQuickUnlock(vaultKey)
            }
        } else {
            onDisableQuickUnlock()
        }
    }

    private fun changeMasterPassword(currentPassword: String, nextPassword: String) {
        val shouldSyncPasswordChange = webDavSyncService.loadSettings().enabled
        val changePassword: suspend () -> Unit = {
            passwordChangeState.runChange(
                successMessage = "主密码已修改，${quickUnlockTitleForMessage()}需要重新开启。",
                task = {
                    withContext(Dispatchers.IO) {
                        webDavFlowCoordinator.changeMasterPassword(currentPassword, nextPassword)
                    }
                },
                onSuccess = { result ->
                    appState.updateUnlockedVault(result.vault, nextPassword, result.vaultKey)
                    syncState.updateMetadata(result.metadata)
                    onResetQuickUnlockAfterPasswordChange()
                },
                onFailure = {}
            )
        }
        if (shouldSyncPasswordChange) {
            syncState.launchExclusiveSync(changePassword)
        } else {
            appScope.launch { changePassword() }
        }
    }

    private fun showSyncResult(result: WebDavSyncResult) {
        val syncMessage = webDavFlowCoordinator.formatResultMessage(result)
        if (webDavFlowCoordinator.needsMasterPassword(result)) {
            syncState.showHomeError(syncMessage)
            syncState.showSettingsError(syncMessage)
            onRemotePasswordNeeded()
        } else {
            syncState.showHomeCopy(syncMessage)
            syncState.showSettingsCopy(syncMessage)
        }
    }

    private fun quickUnlockTitleForMessage(): String {
        return if (quickUnlockState.hasStrongBiometric) "生物识别解锁" else "系统凭证解锁"
    }
}
