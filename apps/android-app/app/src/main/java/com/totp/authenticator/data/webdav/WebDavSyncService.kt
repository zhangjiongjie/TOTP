package com.totp.authenticator.data.webdav

import android.util.Log
import com.totp.authenticator.data.vault.LocalVault
import com.totp.authenticator.data.vault.VaultEnvelopeJson
import com.totp.authenticator.data.vault.VaultRepository
import java.time.Instant

class WebDavSyncService(
    private val repository: VaultRepository,
    private val settingsStore: WebDavSettingsStore,
    private val client: WebDavClient = WebDavClient(),
    private val crypto: RemoteVaultCrypto = RemoteVaultCrypto()
) {
    fun loadSettings(): WebDavSettings = settingsStore.loadSettings()

    fun loadMetadata(): WebDavSyncMetadata = settingsStore.loadMetadata()

    fun clearCryptoCache() {
        crypto.clearCache()
    }

    fun clearAllCryptoCache() {
        crypto.clearPersistentCache()
    }

    fun saveSettings(settings: WebDavSettings): WebDavSettings {
        validateSettings(settings)
        val previous = settingsStore.loadSettings()
        val saved = settingsStore.saveSettings(settings.copy(updatedAt = System.currentTimeMillis()))
        if (previous.enabled != saved.enabled || profileKey(previous) != profileKey(saved)) {
            settingsStore.resetMetadata()
        }
        return saved
    }

    fun testConnection(settings: WebDavSettings) {
        validateProfile(settings)
        client.testConnection(settings)
    }

    fun syncNow(vault: LocalVault, password: String): WebDavSyncResult {
        return try {
            syncNowChecked(vault, password)
        } catch (error: Exception) {
            saveFailure(error.message ?: "WebDAV sync failed")
            throw error
        }
    }

    fun syncLocalChange(vault: LocalVault, password: String): WebDavSyncResult {
        return try {
            syncLocalChangeChecked(vault, password)
        } catch (error: Exception) {
            saveFailure(error.message ?: "WebDAV sync failed")
            throw error
        }
    }

    private fun syncNowChecked(localVault: LocalVault, password: String): WebDavSyncResult {
        val startedAt = System.currentTimeMillis()
        val settings = settingsStore.loadSettings()
        if (!settings.enabled) {
            return saveResult("disabled", "WebDAV sync is disabled")
        }
        validateSettings(settings)

        val metadata = settingsStore.loadMetadata().let {
            if (it.syncProfileKey == profileKey(settings)) it else WebDavSyncMetadata()
        }
        val syncProfileKey = profileKey(settings)
        val metadataAt = System.currentTimeMillis()
        val remote = client.download(settings)
        val downloadAt = System.currentTimeMillis()
        val resolvedLocalBeforeRemote = if (remote == null) {
            resolveLocalSnapshotIfNeeded(localVault, password, metadata, remoteVault = null)
        } else {
            ResolvedLocalVault(localVault)
        }
        var vault = resolvedLocalBeforeRemote.vault
        val localFingerprint = fingerprint(vault)
        val localFingerprintAt = System.currentTimeMillis()

        if (remote == null) {
            if (vault.accounts.isEmpty()) {
                saveMetadata(settings, vault, localFingerprint, "", "", "idle", "")
                return WebDavSyncResult("idle", "Remote vault does not exist and local vault is empty", vaultChanged = resolvedLocalBeforeRemote.replaced)
            }
            return pushLocal(settings, vault, password, previousEtag = "", message = "Local vault uploaded to WebDAV")
                .copy(vaultChanged = resolvedLocalBeforeRemote.replaced)
        }

        val remoteVault = crypto.decrypt(remote.vaultEnvelope.encryptedVault, password, syncProfileKey)
        val decryptAt = System.currentTimeMillis()
        val remoteFingerprint = fingerprint(remoteVault)
        val remoteFingerprintAt = System.currentTimeMillis()
        val resolvedLocal = resolveLocalSnapshotIfNeeded(vault, password, metadata, remoteVault)
        vault = resolvedLocal.vault
        val resolvedLocalFingerprint = if (resolvedLocal.replaced) fingerprint(vault) else localFingerprint
        Log.d(
            "TotpWebDavPerf",
            "syncNow before-branch total=${remoteFingerprintAt - startedAt}ms metadata=${metadataAt - startedAt}ms download=${downloadAt - metadataAt}ms localFp=${localFingerprintAt - downloadAt}ms decrypt=${decryptAt - localFingerprintAt}ms remoteFp=${remoteFingerprintAt - decryptAt}ms"
        )
        if (resolvedLocalFingerprint == remoteFingerprint) {
            saveMetadata(settings, vault, resolvedLocalFingerprint, remote.revision, remote.etag, "synced", "")
            return WebDavSyncResult("synced", "Local and WebDAV vaults are already in sync", vaultChanged = resolvedLocal.replaced)
        }

        if (metadata.baseFingerprint.isBlank()) {
            return if (vault.accounts.isEmpty() && remoteVault.accounts.isNotEmpty()) {
                pullRemote(settings, remoteVault, password, remoteFingerprint, remote.revision, remote.etag)
            } else if (vault.accounts.isNotEmpty() && remoteVault.accounts.isEmpty()) {
                pushLocal(settings, vault, password, remote.etag, "Local vault uploaded to empty WebDAV vault")
                    .copy(vaultChanged = resolvedLocal.replaced)
            } else {
                saveConflict("首次绑定时本地和远端都有数据，请先决定保留哪一侧。")
            }
        }

        val localChanged = resolvedLocalFingerprint != metadata.baseFingerprint
        val remoteChanged = remoteFingerprint != metadata.baseFingerprint
        return when {
            localChanged && !remoteChanged -> pushLocal(settings, vault, password, remote.etag, "Local changes synced to WebDAV")
                .copy(vaultChanged = resolvedLocal.replaced)
            !localChanged && remoteChanged -> pullRemote(settings, remoteVault, password, remoteFingerprint, remote.revision, remote.etag)
            !localChanged && !remoteChanged -> {
                saveMetadata(settings, vault, localFingerprint, remote.revision, remote.etag, "synced", "")
                WebDavSyncResult("synced", "Sync baseline refreshed", vaultChanged = resolvedLocal.replaced)
            }
            else -> {
                val mergedVault = WebDavAccountMerge.merge(metadata, vault, remoteVault)
                if (mergedVault != null) {
                    repository.save(mergedVault, password)
                    pushLocal(settings, mergedVault, password, remote.etag, "本地和远端修改已自动合并并同步到 WebDAV。")
                        .copy(vaultChanged = true)
                } else {
                    saveConflict("本地和远端都发生了变化，请在首页选择保留本地或使用远端。")
                }
            }
        }
    }

    private fun syncLocalChangeChecked(localVault: LocalVault, password: String): WebDavSyncResult {
        val startedAt = System.currentTimeMillis()
        val settings = settingsStore.loadSettings()
        if (!settings.enabled) {
            return saveResult("disabled", "未启用 WebDAV，同步仅保留在本机。")
        }
        validateSettings(settings)

        val metadata = settingsStore.loadMetadata().let {
            if (it.syncProfileKey == profileKey(settings)) it else WebDavSyncMetadata()
        }
        val vault = resolveLocalSnapshotIfNeeded(localVault, password, metadata, remoteVault = null).vault
        val metadataAt = System.currentTimeMillis()
        Log.d(
            "TotpWebDavPerf",
            "syncLocalChange start metadata=${metadataAt - startedAt}ms hasEtag=${metadata.remoteEtag.isNotBlank()} accounts=${vault.accounts.size}"
        )
        return if (metadata.remoteEtag.isNotBlank()) {
            pushLocal(settings, vault, password, metadata.remoteEtag, "本地修改已同步到 WebDAV。")
        } else {
            syncNowChecked(vault, password)
        }
    }

    private fun pushLocal(
        settings: WebDavSettings,
        vault: LocalVault,
        password: String,
        previousEtag: String,
        message: String
    ): WebDavSyncResult {
        val startedAt = System.currentTimeMillis()
        val localFingerprint = fingerprint(vault)
        val fingerprintAt = System.currentTimeMillis()
        val revision = "android:${System.currentTimeMillis()}:$localFingerprint"
        val envelope = WebDavRemoteEnvelopeDto(
            revision = revision,
            updatedAt = Instant.now().toString(),
            encryptedVault = crypto.encrypt(vault, password, profileKey(settings))
        )
        val encryptedAt = System.currentTimeMillis()
        val upload = client.upload(settings, envelope, previousEtag)
        val uploadedAt = System.currentTimeMillis()
        saveMetadata(settings, vault, localFingerprint, upload.revision, upload.etag, "synced", "")
        val finishedAt = System.currentTimeMillis()
        Log.d(
            "TotpWebDavPerf",
            "pushLocal total=${finishedAt - startedAt}ms fp=${fingerprintAt - startedAt}ms encrypt=${encryptedAt - fingerprintAt}ms upload=${uploadedAt - encryptedAt}ms metadata=${finishedAt - uploadedAt}ms previousEtag=${previousEtag.isNotBlank()} nextEtag=${upload.etag.isNotBlank()} accounts=${vault.accounts.size}"
        )
        return WebDavSyncResult("pushed", message)
    }

    private fun pullRemote(
        settings: WebDavSettings,
        remoteVault: LocalVault,
        password: String,
        remoteFingerprint: String,
        remoteRevision: String,
        remoteEtag: String,
        message: String = "WebDAV vault restored locally"
    ): WebDavSyncResult {
        repository.save(remoteVault, password)
        saveMetadata(settings, remoteVault, remoteFingerprint, remoteRevision, remoteEtag, "synced", "")
        return WebDavSyncResult("pulled", message, vaultChanged = true)
    }

    private fun saveMetadata(
        settings: WebDavSettings,
        vault: LocalVault,
        fingerprint: String,
        remoteRevision: String,
        remoteEtag: String,
        status: String,
        error: String
    ) {
        settingsStore.saveMetadata(
            WebDavSyncMetadata(
                syncProfileKey = profileKey(settings),
                baseFingerprint = fingerprint,
                baseVaultJson = VaultEnvelopeJson.encodeVault(vault),
                remoteRevision = remoteRevision,
                remoteEtag = remoteEtag,
                lastSyncedAt = System.currentTimeMillis(),
                lastStatus = status,
                lastError = error
            )
        )
    }

    private fun saveResult(status: String, message: String): WebDavSyncResult {
        val previous = settingsStore.loadMetadata()
        settingsStore.saveMetadata(previous.copy(lastStatus = status, lastError = message, lastSyncedAt = System.currentTimeMillis()))
        return WebDavSyncResult(status, message)
    }

    private fun saveFailure(message: String) {
        val previous = settingsStore.loadMetadata()
        settingsStore.saveMetadata(
            previous.copy(
                lastStatus = "error",
                lastError = message,
                lastSyncedAt = System.currentTimeMillis()
            )
        )
    }

    private fun saveConflict(message: String): WebDavSyncResult {
        val previous = settingsStore.loadMetadata()
        settingsStore.saveMetadata(
            previous.copy(
                lastStatus = "conflict",
                lastError = message,
                lastSyncedAt = System.currentTimeMillis()
            )
        )
        return WebDavSyncResult("conflict", message)
    }

    private fun validateSettings(settings: WebDavSettings) {
        if (!settings.enabled) {
            return
        }
        validateProfile(settings)
    }

    private fun validateProfile(settings: WebDavSettings) {
        require(settings.serverUrl.startsWith("http://") || settings.serverUrl.startsWith("https://")) {
            "WebDAV server URL must start with http:// or https://"
        }
        require(settings.filePath.isNotBlank()) { "WebDAV vault path is required" }
    }

    private fun profileKey(settings: WebDavSettings): String {
        return fingerprintText("${settings.serverUrl}|${settings.filePath}|${settings.username}|${settings.password}")
    }

    private fun resolveLocalSnapshotIfNeeded(
        localVault: LocalVault,
        password: String,
        metadata: WebDavSyncMetadata,
        remoteVault: LocalVault?
    ): ResolvedLocalVault {
        val localFingerprint = fingerprint(localVault)
        val localLooksSafeForFastPath = localVault.accounts.isNotEmpty() &&
            (localFingerprint == metadata.baseFingerprint || remoteVault?.let { localFingerprint == fingerprint(it) } == true)
        if (localLooksSafeForFastPath) {
            return ResolvedLocalVault(localVault)
        }
        if (localVault.accounts.isNotEmpty() && metadata.baseFingerprint.isBlank()) {
            return ResolvedLocalVault(localVault)
        }
        if (localVault.accounts.isNotEmpty() && remoteVault == null) {
            return ResolvedLocalVault(localVault)
        }
        val persistedVault = runCatching { repository.unlock(password) }.getOrNull() ?: return ResolvedLocalVault(localVault)
        val persistedFingerprint = fingerprint(persistedVault)
        val localLooksLikeStaleEmptySnapshot = localVault.accounts.isEmpty() && persistedVault.accounts.isNotEmpty()
        val persistedMatchesBaseline = metadata.baseFingerprint.isNotBlank() && persistedFingerprint == metadata.baseFingerprint
        val localDiffersFromBaseline = metadata.baseFingerprint.isNotBlank() && localFingerprint != metadata.baseFingerprint
        val persistedIsNewer = persistedVault.updatedAt > localVault.updatedAt && persistedFingerprint != localFingerprint
        if (localLooksLikeStaleEmptySnapshot || (persistedMatchesBaseline && localDiffersFromBaseline) || persistedIsNewer) {
            Log.w(
                "TotpWebDavSync",
                "Ignoring stale in-memory vault during WebDAV sync. localAccounts=${localVault.accounts.size} persistedAccounts=${persistedVault.accounts.size}"
            )
            return ResolvedLocalVault(persistedVault, replaced = true)
        }
        return ResolvedLocalVault(localVault)
    }

    private fun fingerprint(vault: LocalVault): String {
        val payload = vault.accounts.map {
            listOf(it.id, it.issuer, it.accountName, it.secret, it.digits, it.period, it.algorithm.name, it.group).joinToString("|")
        }.sorted().joinToString("\n")
        return fingerprintText(payload)
    }

    private fun fingerprintText(text: String): String {
        var hash = -0x7ee3623b
        text.forEach { char ->
            hash = hash xor char.code
            hash *= 16_777_619
        }
        return "fp:${Integer.toUnsignedString(hash, 16)}:${text.length}"
    }
}

private data class ResolvedLocalVault(
    val vault: LocalVault,
    val replaced: Boolean = false
)
