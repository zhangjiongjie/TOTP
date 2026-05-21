package com.totp.authenticator.app

import com.totp.authenticator.data.vault.LocalVault
import com.totp.authenticator.data.webdav.WebDavSyncService
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

class HomeSyncActionCoordinator(
    private val appState: TotpApplicationState,
    private val syncState: SyncViewModel,
    private val backupState: BackupViewModel,
    private val webDavFlowCoordinator: WebDavFlowCoordinator,
    private val webDavSyncService: WebDavSyncService,
    private val onRefreshQuickUnlockCredentialIfNeeded: (ByteArray?, ByteArray) -> Unit
) {
    fun syncWithPassword(password: String) {
        val vault = appState.vault
        if (vault == null) {
            syncState.showHomeError("保管库未解锁。")
            return
        }
        syncState.launchExclusiveSyncTask(
            task = {
                withContext(Dispatchers.IO) {
                    webDavFlowCoordinator.syncWithPassword(vault, password)
                }
            },
            onSuccess = { flowResult ->
                syncState.updateMetadata(flowResult.metadata)
                val syncMessage = webDavFlowCoordinator.formatResultMessage(flowResult.syncResult)
                if (webDavFlowCoordinator.needsMasterPassword(flowResult.syncResult)) {
                    syncState.showHomeError(syncMessage)
                    backupState.requestRemotePassword()
                } else {
                    val previousVaultKey = appState.activeVaultKey?.copyOf()
                    appState.updateUnlockedVault(flowResult.refreshedVault ?: vault, password, flowResult.vaultKey)
                    if (flowResult.syncResult.vaultKey != null && flowResult.vaultKey != null) {
                        onRefreshQuickUnlockCredentialIfNeeded(previousVaultKey, flowResult.vaultKey)
                    }
                    syncState.showHomeCopy(syncMessage)
                }
            },
            onFailure = { error ->
                syncState.updateMetadata(webDavSyncService.loadMetadata())
                syncState.showHomeError(error.message ?: "同步失败，请稍后重试。")
            }
        )
    }

    fun syncAfterUnlock(password: String?, vaultKey: ByteArray?) {
        val settings = webDavSyncService.loadSettings()
        if (syncState.hasSyncedAfterUnlock || !settings.enabled || !settings.isConfigured) {
            return
        }
        syncState.markSyncedAfterUnlock()
        syncState.launchExclusiveSyncTask(
            task = {
                withContext(Dispatchers.IO) {
                    webDavFlowCoordinator.syncUnlocked(password, vaultKey)
                }
            },
            onSuccess = { flowResult ->
                syncState.updateSettings(flowResult.settings)
                syncState.updateMetadata(flowResult.metadata)
                val syncMessage = webDavFlowCoordinator.formatResultMessage(flowResult.syncResult)
                applyRefreshedVault(flowResult, password)
                if (webDavFlowCoordinator.needsMasterPassword(flowResult.syncResult)) {
                    syncState.showHomeError(syncMessage)
                    backupState.requestRemotePassword()
                } else {
                    syncState.showHomeCopy(syncMessage)
                }
            },
            onFailure = { error ->
                syncState.updateMetadata(webDavSyncService.loadMetadata())
                syncState.showHomeError(error.message ?: "同步失败，请稍后重试。")
            }
        )
    }

    fun syncAfterLocalChange(vault: LocalVault, password: String?, vaultKey: ByteArray?) {
        if (!webDavSyncService.loadSettings().enabled) {
            return
        }
        syncState.launchExclusiveSyncTask(
            task = {
                withContext(Dispatchers.IO) {
                    webDavFlowCoordinator.syncUnlocked(password, vaultKey, localChange = true)
                }
            },
            onSuccess = { flowResult ->
                syncState.updateMetadata(flowResult.metadata)
                val syncMessage = webDavFlowCoordinator.formatResultMessage(flowResult.syncResult)
                flowResult.syncResult.vaultKey?.let { nextVaultKey ->
                    val previousVaultKey = appState.activeVaultKey?.copyOf()
                    if (password != null) {
                        appState.updateUnlockedVault(vault, password, nextVaultKey)
                        onRefreshQuickUnlockCredentialIfNeeded(previousVaultKey, nextVaultKey)
                    } else {
                        appState.updateUnlockedVaultWithKey(vault, nextVaultKey)
                    }
                }
                if (webDavFlowCoordinator.needsMasterPassword(flowResult.syncResult)) {
                    syncState.showHomeError(syncMessage)
                    backupState.requestRemotePassword()
                } else {
                    syncState.showHomeCopy(syncMessage)
                }
            },
            onFailure = { error ->
                syncState.updateMetadata(webDavSyncService.loadMetadata())
                syncState.showHomeError(error.message ?: "同步失败，请稍后重试。")
            }
        )
    }

    fun syncFromHome() {
        val vault = appState.vault
        val password = appState.activePassword
        val vaultKey = appState.activeVaultKey
        if (vault == null || (password == null && vaultKey == null)) {
            syncState.showHomeError("保管库未解锁。")
            return
        }
        if (!syncState.webDavSettings.enabled) {
            syncState.showHomeCopy("WebDAV 同步未开启，本地模式。")
            return
        }
        syncState.launchExclusiveSyncTask(
            task = {
                withContext(Dispatchers.IO) {
                    webDavFlowCoordinator.syncUnlocked(password, vaultKey)
                }
            },
            onSuccess = { flowResult ->
                syncState.updateMetadata(flowResult.metadata)
                val syncMessage = webDavFlowCoordinator.formatResultMessage(flowResult.syncResult)
                applyRefreshedVault(flowResult, password)
                if (webDavFlowCoordinator.needsMasterPassword(flowResult.syncResult)) {
                    syncState.showHomeError(syncMessage)
                    backupState.requestRemotePassword()
                } else {
                    syncState.showHomeCopy(syncMessage)
                }
            },
            onFailure = { error ->
                syncState.updateMetadata(webDavSyncService.loadMetadata())
                syncState.showHomeError(error.message ?: "同步失败，请稍后重试。")
            }
        )
    }

    private fun applyRefreshedVault(flowResult: WebDavFlowResult, password: String?) {
        if (flowResult.refreshedVault == null) {
            return
        }
        if (password != null && flowResult.vaultKey != null) {
            val previousVaultKey = appState.activeVaultKey?.copyOf()
            appState.updateUnlockedVault(flowResult.refreshedVault, password, flowResult.vaultKey)
            if (flowResult.syncResult.vaultKey != null) {
                onRefreshQuickUnlockCredentialIfNeeded(previousVaultKey, flowResult.vaultKey)
            }
        } else if (flowResult.vaultKey != null) {
            appState.updateUnlockedVaultWithKey(flowResult.refreshedVault, flowResult.vaultKey)
        }
    }
}
