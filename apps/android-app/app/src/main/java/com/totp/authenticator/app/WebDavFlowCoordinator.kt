package com.totp.authenticator.app

import com.totp.authenticator.data.vault.LocalVault
import com.totp.authenticator.data.vault.VaultRepository
import com.totp.authenticator.data.webdav.WebDavSettings
import com.totp.authenticator.data.webdav.WebDavSyncMetadata
import com.totp.authenticator.data.webdav.WebDavSyncResult
import com.totp.authenticator.data.webdav.WebDavSyncService

class WebDavFlowCoordinator(
    private val repository: VaultRepository,
    private val webDavSyncService: WebDavSyncService
) {
    fun loadSettings(): WebDavSettings = webDavSyncService.loadSettings()

    fun loadMetadata(): WebDavSyncMetadata = webDavSyncService.loadMetadata()

    fun saveSettings(settings: WebDavSettings): WebDavSettings = webDavSyncService.saveSettings(settings)

    fun testConnection(settings: WebDavSettings) {
        webDavSyncService.testConnection(settings)
    }

    fun canUseFastSync(vaultKey: ByteArray?): Boolean {
        return vaultKey != null
    }

    fun needsMasterPassword(result: WebDavSyncResult): Boolean = result.status == "blocked"

    fun formatResultMessage(result: WebDavSyncResult): String {
        return when (result.status) {
            "pushed" -> if (result.message.contains("主密码")) result.message else "同步完成，已推送本地最新数据。"
            "pulled" -> "同步完成，已拉取远端最新数据。"
            "synced", "noop" -> "同步完成，当前数据已经是最新。"
            "conflict" -> "检测到同步冲突，请前往设置页处理。"
            "blocked" -> result.message.ifBlank { "远端保管库需要主密码验证后才能继续同步。" }
            else -> result.message
        }
    }

    suspend fun syncWithPassword(currentVault: LocalVault, password: String): WebDavFlowResult {
        val result = webDavSyncService.syncNowWithRemotePassword(currentVault, password)
        if (needsMasterPassword(result)) {
            return WebDavFlowResult(result, currentVault, null, loadMetadata(), loadSettings())
        }
        val vaultKey = result.vaultKey ?: repository.exportVaultKey(password)
        val refreshedVault = if (result.vaultChanged) repository.unlockWithVaultKey(vaultKey) else currentVault
        return WebDavFlowResult(result, refreshedVault, vaultKey, loadMetadata(), loadSettings())
    }

    suspend fun syncUnlocked(
        password: String?,
        vaultKey: ByteArray?,
        localChange: Boolean = false
    ): WebDavFlowResult {
        val result = when {
            vaultKey != null && localChange -> webDavSyncService.syncLocalChangeWithVaultKey(vaultKey)
            canUseFastSync(vaultKey) -> webDavSyncService.syncNowWithVaultKey(vaultKey!!)
            password != null && localChange -> webDavSyncService.syncLocalChange(password)
            password != null -> webDavSyncService.syncNow(password)
            else -> throw IllegalStateException("保管库未解锁。")
        }
        val nextVaultKey = result.vaultKey ?: vaultKey
        val refreshedVault = if (result.vaultChanged) {
            if (nextVaultKey != null) repository.unlockWithVaultKey(nextVaultKey) else repository.unlock(password!!)
        } else {
            null
        }
        return WebDavFlowResult(result, refreshedVault, nextVaultKey, loadMetadata(), loadSettings())
    }

    suspend fun saveSettingsAndSyncIfUnlocked(
        settings: WebDavSettings,
        isUnlocked: Boolean,
        password: String?,
        vaultKey: ByteArray?
    ): WebDavSettingsFlowResult {
        val saved = saveSettings(settings)
        val syncFlowResult = if (saved.enabled && isUnlocked && (password != null || vaultKey != null)) {
            syncUnlocked(password, vaultKey)
        } else {
            null
        }
        return WebDavSettingsFlowResult(saved, syncFlowResult, loadMetadata())
    }

    suspend fun changeMasterPassword(currentPassword: String, nextPassword: String): MasterPasswordChangeResult {
        val currentSettings = webDavSyncService.loadSettings()
        val currentMetadata = webDavSyncService.loadMetadata()
        if (currentSettings.enabled && currentMetadata.lastStatus == "blocked") {
            throw IllegalStateException("远端保管库需要主密码验证后才能继续同步，请先验证远端主密码。")
        }

        val syncResult = if (currentSettings.enabled) {
            webDavSyncService.syncPasswordChange(currentPassword, nextPassword)
        } else {
            repository.changePassword(currentPassword, nextPassword)
            null
        }
        if (syncResult?.status == "conflict" || syncResult?.status == "blocked") {
            throw IllegalStateException(syncResult.message)
        }

        val vaultKey = syncResult?.vaultKey ?: repository.exportVaultKey(nextPassword)
        val vault = repository.unlockWithVaultKey(vaultKey)
        return MasterPasswordChangeResult(vault, syncResult, vaultKey, loadMetadata())
    }
}

data class WebDavFlowResult(
    val syncResult: WebDavSyncResult,
    val refreshedVault: LocalVault?,
    val vaultKey: ByteArray?,
    val metadata: WebDavSyncMetadata,
    val settings: WebDavSettings
)

data class WebDavSettingsFlowResult(
    val settings: WebDavSettings,
    val syncFlowResult: WebDavFlowResult?,
    val metadata: WebDavSyncMetadata
)

data class MasterPasswordChangeResult(
    val vault: LocalVault,
    val syncResult: WebDavSyncResult?,
    val vaultKey: ByteArray,
    val metadata: WebDavSyncMetadata
)
