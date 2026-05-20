package com.totp.authenticator.data.webdav

import android.util.Log
import com.totp.authenticator.data.vault.AesGcmPayload
import com.totp.authenticator.data.vault.EncryptedVaultEnvelope
import com.totp.authenticator.data.vault.LocalVault
import com.totp.authenticator.data.vault.VaultEnvelopeJson
import com.totp.authenticator.data.vault.VaultKdf
import com.totp.authenticator.data.vault.VaultRepository
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import java.time.Instant

class WebDavSyncService(
    private val repository: VaultRepository,
    private val settingsStore: WebDavSettingsStore,
    private val client: WebDavClient = WebDavClient(),
    private val crypto: RemoteVaultCrypto = RemoteVaultCrypto()
) {
    private val syncMutex = Mutex()

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
        if (profileKey(previous) != profileKey(saved)) {
            settingsStore.resetMetadata()
        }
        return saved
    }

    fun testConnection(settings: WebDavSettings) {
        validateProfile(settings)
        client.testConnection(settings)
    }

    suspend fun syncNow(password: String): WebDavSyncResult = syncMutex.withLock {
        return try {
            syncNowChecked(repository.unlock(password), password)
        } catch (error: Exception) {
            saveFailure(error.message ?: "WebDAV sync failed")
            throw error
        }
    }

    suspend fun syncLocalChange(password: String): WebDavSyncResult = syncMutex.withLock {
        return try {
            syncLocalChangeChecked(repository.unlock(password), password)
        } catch (error: Exception) {
            saveFailure(error.message ?: "WebDAV sync failed")
            throw error
        }
    }

    suspend fun syncNowWithVaultKey(vaultKey: ByteArray): WebDavSyncResult = syncMutex.withLock {
        return try {
            syncNowWithVaultKeyChecked(repository.unlockWithVaultKey(vaultKey), vaultKey)
        } catch (error: Exception) {
            saveFailure(error.message ?: "WebDAV sync failed")
            throw error
        }
    }

    suspend fun syncLocalChangeWithVaultKey(vaultKey: ByteArray): WebDavSyncResult = syncMutex.withLock {
        return try {
            syncLocalChangeWithVaultKeyChecked(repository.unlockWithVaultKey(vaultKey), vaultKey)
        } catch (error: Exception) {
            saveFailure(error.message ?: "WebDAV sync failed")
            throw error
        }
    }

    suspend fun syncPasswordChange(currentPassword: String, nextPassword: String): WebDavSyncResult = syncMutex.withLock {
        return try {
            syncPasswordChangeChecked(repository.unlock(currentPassword), currentPassword, nextPassword)
        } catch (error: Exception) {
            saveFailure(error.message ?: "WebDAV sync failed")
            throw error
        }
    }

    private suspend fun syncNowChecked(localVault: LocalVault, password: String): WebDavSyncResult {
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

        val remoteDecryption = runCatching {
            crypto.decryptWithKey(remote.vaultEnvelope.encryptedVault, password, syncProfileKey)
        }.getOrElse {
            return saveResult("blocked", "远端保管库需要主密码验证后才能继续同步。")
        }
        val remoteVault = remoteDecryption.vault
        val remoteVaultKey = remoteDecryption.vaultKey
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
            repository.saveWithVaultKeyEnvelope(vault, remote.vaultEnvelope.encryptedVault.toLocalEnvelope(vault.updatedAt), remoteVaultKey)
            saveMetadata(settings, vault, resolvedLocalFingerprint, remote.revision, remote.etag, "synced", "")
            return WebDavSyncResult("synced", "Local and WebDAV vaults are already in sync", vaultChanged = true, vaultKey = remoteVaultKey)
        }

        if (metadata.baseFingerprint.isBlank()) {
            return if (vault.accounts.isEmpty() && remoteVault.accounts.isNotEmpty()) {
                pullRemoteWithVaultKey(settings, remoteVault, remote.vaultEnvelope.encryptedVault, remoteVaultKey, remoteFingerprint, remote.revision, remote.etag)
            } else if (vault.accounts.isNotEmpty() && remoteVault.accounts.isEmpty()) {
                repository.saveWithVaultKeyEnvelope(vault, remote.vaultEnvelope.encryptedVault.toLocalEnvelope(vault.updatedAt), remoteVaultKey)
                pushLocalWithVaultKey(settings, vault, remoteVaultKey, remote.vaultEnvelope.encryptedVault, remote.etag, "Local vault uploaded to empty WebDAV vault")
                    .copy(vaultChanged = true, vaultKey = remoteVaultKey)
            } else {
                saveConflict("首次绑定时本地和远端都有数据，请先决定保留哪一侧。")
            }
        }

        val localChanged = resolvedLocalFingerprint != metadata.baseFingerprint
        val remoteChanged = remoteFingerprint != metadata.baseFingerprint
        return when {
            localChanged && !remoteChanged -> {
                repository.saveWithVaultKeyEnvelope(vault, remote.vaultEnvelope.encryptedVault.toLocalEnvelope(vault.updatedAt), remoteVaultKey)
                pushLocalWithVaultKey(settings, vault, remoteVaultKey, remote.vaultEnvelope.encryptedVault, remote.etag, "Local changes synced to WebDAV")
                    .copy(vaultChanged = true, vaultKey = remoteVaultKey)
            }
            !localChanged && remoteChanged -> pullRemoteWithVaultKey(settings, remoteVault, remote.vaultEnvelope.encryptedVault, remoteVaultKey, remoteFingerprint, remote.revision, remote.etag)
            !localChanged && !remoteChanged -> {
                repository.saveWithVaultKeyEnvelope(vault, remote.vaultEnvelope.encryptedVault.toLocalEnvelope(vault.updatedAt), remoteVaultKey)
                saveMetadata(settings, vault, localFingerprint, remote.revision, remote.etag, "synced", "")
                WebDavSyncResult("synced", "Sync baseline refreshed", vaultChanged = true, vaultKey = remoteVaultKey)
            }
            else -> {
                val mergedVault = WebDavAccountMerge.merge(metadata, vault, remoteVault)
                if (mergedVault != null) {
                    repository.saveWithVaultKeyEnvelope(mergedVault, remote.vaultEnvelope.encryptedVault.toLocalEnvelope(mergedVault.updatedAt), remoteVaultKey)
                    pushLocalWithVaultKey(settings, mergedVault, remoteVaultKey, remote.vaultEnvelope.encryptedVault, remote.etag, "本地和远端修改已自动合并并同步到 WebDAV。")
                        .copy(vaultChanged = true, vaultKey = remoteVaultKey)
                } else {
                    saveConflict("本地和远端都发生了变化，请在首页选择保留本地或使用远端。")
                }
            }
        }
    }

    private suspend fun syncLocalChangeChecked(localVault: LocalVault, password: String): WebDavSyncResult {
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

    private suspend fun syncPasswordChangeChecked(localVault: LocalVault, currentPassword: String, nextPassword: String): WebDavSyncResult {
        val settings = settingsStore.loadSettings()
        if (!settings.enabled) {
            return saveResult("disabled", "未启用 WebDAV，同步仅保留在本机。")
        }
        validateSettings(settings)

        val metadata = settingsStore.loadMetadata().let {
            if (it.syncProfileKey == profileKey(settings)) it else WebDavSyncMetadata()
        }
        val remote = client.download(settings)
        if (remote == null) {
            val localVaultKey = repository.exportVaultKey(currentPassword)
            val encryptedVault = crypto.encrypt(localVault, nextPassword, localVaultKey, profileKey(settings))
            val localFingerprint = fingerprint(localVault)
            val revision = "android:${System.currentTimeMillis()}:$localFingerprint"
            val envelope = WebDavRemoteEnvelopeDto(
                revision = revision,
                updatedAt = Instant.now().toString(),
                encryptedVault = encryptedVault
            )
            val upload = client.upload(settings, envelope, previousEtag = "")
            repository.saveWithVaultKeyEnvelope(localVault, encryptedVault.toLocalEnvelope(localVault.updatedAt), localVaultKey)
            saveMetadata(settings, localVault, localFingerprint, upload.revision, upload.etag, "synced", "")
            return WebDavSyncResult("pushed", "主密码已修改并同步到 WebDAV。", vaultChanged = true, vaultKey = localVaultKey)
        }
        val remoteDecryption = runCatching {
            crypto.decryptWithKey(remote.vaultEnvelope.encryptedVault, currentPassword, profileKey(settings))
        }.getOrElse {
            return saveResult("blocked", "远端保管库需要验证后才能修改主密码。")
        }
        val remoteVault = remoteDecryption.vault
        val remoteVaultKey = remoteDecryption.vaultKey
        val localFingerprint = fingerprint(localVault)
        val remoteFingerprint = fingerprint(remoteVault)
        val finalVault = when {
            localFingerprint == remoteFingerprint -> localVault
            metadata.baseFingerprint.isBlank() -> {
                saveConflict("首次绑定时本地和远端都有数据，请先决定保留哪一侧。")
                return WebDavSyncResult("conflict", "主密码未同步：首次绑定时本地和远端都有数据，请先完成数据同步。")
            }
            localFingerprint != metadata.baseFingerprint && remoteFingerprint == metadata.baseFingerprint -> localVault
            localFingerprint == metadata.baseFingerprint && remoteFingerprint != metadata.baseFingerprint -> remoteVault
            else -> {
                WebDavAccountMerge.merge(metadata, localVault, remoteVault)
                    ?: return saveConflict("本地和远端都发生了变化，请先解决冲突后再修改主密码。")
            }
        }
        val finalFingerprint = fingerprint(finalVault)
        val encryptedVault = if (finalFingerprint == remoteFingerprint) {
            crypto.rewrapKeyEncryption(remote.vaultEnvelope.encryptedVault, nextPassword, remoteVaultKey, profileKey(settings))
        } else {
            crypto.encryptWithPasswordAndVaultKey(finalVault, remote.vaultEnvelope.encryptedVault, nextPassword, remoteVaultKey, profileKey(settings))
        }
        val revision = "android:${System.currentTimeMillis()}:$finalFingerprint"
        val envelope = WebDavRemoteEnvelopeDto(
            revision = revision,
            updatedAt = Instant.now().toString(),
            encryptedVault = encryptedVault
        )
        val upload = client.upload(settings, envelope, remote.etag)
        repository.saveWithVaultKeyEnvelope(finalVault, encryptedVault.toLocalEnvelope(finalVault.updatedAt), remoteVaultKey)
        saveMetadata(settings, finalVault, finalFingerprint, upload.revision, upload.etag, "synced", "")
        return WebDavSyncResult("pushed", "主密码已修改并同步到 WebDAV。", vaultChanged = true, vaultKey = remoteVaultKey)
    }

    private suspend fun syncNowWithVaultKeyChecked(localVault: LocalVault, vaultKey: ByteArray): WebDavSyncResult {
        val settings = settingsStore.loadSettings()
        if (!settings.enabled) {
            return saveResult("disabled", "WebDAV sync is disabled")
        }
        validateSettings(settings)
        val metadata = settingsStore.loadMetadata().let {
            if (it.syncProfileKey == profileKey(settings)) it else WebDavSyncMetadata()
        }
        val remote = client.download(settings)
            ?: return saveResult("blocked", "远端保管库尚未初始化，请输入主密码后再同步。")
        if (!remoteKeyEnvelopeMatchesLocal(remote.vaultEnvelope.encryptedVault)) {
            return saveResult("blocked", "远端保管库需要主密码验证后才能继续同步。")
        }
        val remoteVault = runCatching {
            crypto.decryptWithVaultKey(remote.vaultEnvelope.encryptedVault, vaultKey)
        }.getOrElse {
            return saveResult("blocked", "远端保管库需要主密码验证后才能继续同步。")
        }
        val localFingerprint = fingerprint(localVault)
        val remoteFingerprint = fingerprint(remoteVault)
        if (localFingerprint == remoteFingerprint) {
            saveMetadata(settings, localVault, localFingerprint, remote.revision, remote.etag, "synced", "")
            return WebDavSyncResult("synced", "Local and WebDAV vaults are already in sync")
        }
        if (metadata.baseFingerprint.isBlank()) {
            return if (localVault.accounts.isEmpty() && remoteVault.accounts.isNotEmpty()) {
                pullRemoteWithVaultKey(settings, remoteVault, remote.vaultEnvelope.encryptedVault, vaultKey, remoteFingerprint, remote.revision, remote.etag)
            } else {
                saveConflict("首次绑定时本地和远端都有数据，请先使用主密码完成同步。")
            }
        }
        val localChanged = localFingerprint != metadata.baseFingerprint
        val remoteChanged = remoteFingerprint != metadata.baseFingerprint
        return when {
            localChanged && !remoteChanged -> pushLocalWithVaultKey(settings, localVault, vaultKey, remote.vaultEnvelope.encryptedVault, remote.etag, "Local changes synced to WebDAV")
            !localChanged && remoteChanged -> pullRemoteWithVaultKey(settings, remoteVault, remote.vaultEnvelope.encryptedVault, vaultKey, remoteFingerprint, remote.revision, remote.etag)
            !localChanged && !remoteChanged -> {
                saveMetadata(settings, localVault, localFingerprint, remote.revision, remote.etag, "synced", "")
                WebDavSyncResult("synced", "Sync baseline refreshed")
            }
            else -> {
                val mergedVault = WebDavAccountMerge.merge(metadata, localVault, remoteVault)
                if (mergedVault != null) {
                    repository.saveWithVaultKey(mergedVault, vaultKey)
                    pushLocalWithVaultKey(settings, mergedVault, vaultKey, remote.vaultEnvelope.encryptedVault, remote.etag, "本地和远端修改已自动合并并同步到 WebDAV。")
                        .copy(vaultChanged = true)
                } else {
                    saveConflict("本地和远端都发生了变化，请在首页选择保留本地或使用远端。")
                }
            }
        }
    }

    private suspend fun syncLocalChangeWithVaultKeyChecked(localVault: LocalVault, vaultKey: ByteArray): WebDavSyncResult {
        val settings = settingsStore.loadSettings()
        if (!settings.enabled) {
            return saveResult("disabled", "未启用 WebDAV，同步仅保留在本机。")
        }
        validateSettings(settings)
        val metadata = settingsStore.loadMetadata().let {
            if (it.syncProfileKey == profileKey(settings)) it else WebDavSyncMetadata()
        }
        return if (metadata.remoteEtag.isNotBlank()) {
            val remote = client.download(settings)
                ?: return saveResult("blocked", "远端保管库尚未初始化，请输入主密码后再同步。")
            if (!remoteKeyEnvelopeMatchesLocal(remote.vaultEnvelope.encryptedVault)) {
                return saveResult("blocked", "远端保管库需要主密码验证后才能继续同步。")
            }
            runCatching {
                crypto.decryptWithVaultKey(remote.vaultEnvelope.encryptedVault, vaultKey)
            }.getOrElse {
                return saveResult("blocked", "远端保管库需要主密码验证后才能继续同步。")
            }
            pushLocalWithVaultKey(settings, localVault, vaultKey, remote.vaultEnvelope.encryptedVault, remote.etag, "本地修改已同步到 WebDAV。")
        } else {
            syncNowWithVaultKeyChecked(localVault, vaultKey)
        }
    }

    private suspend fun pushLocal(
        settings: WebDavSettings,
        vault: LocalVault,
        password: String,
        previousEtag: String,
        message: String
    ): WebDavSyncResult {
        return pushLocalWithPasswordVaultKey(settings, vault, password, repository.exportVaultKey(password), previousEtag, message)
    }

    private suspend fun pushLocalWithPasswordVaultKey(
        settings: WebDavSettings,
        vault: LocalVault,
        password: String,
        vaultKey: ByteArray,
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
            encryptedVault = crypto.encrypt(vault, password, vaultKey, profileKey(settings))
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

    private suspend fun pullRemote(
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

    private suspend fun pushLocalWithVaultKey(
        settings: WebDavSettings,
        vault: LocalVault,
        vaultKey: ByteArray,
        previousEncryptedVault: EncryptedRemoteVaultBlobDto,
        previousEtag: String,
        message: String
    ): WebDavSyncResult {
        val localFingerprint = fingerprint(vault)
        val revision = "android:${System.currentTimeMillis()}:$localFingerprint"
        val envelope = WebDavRemoteEnvelopeDto(
            revision = revision,
            updatedAt = Instant.now().toString(),
            encryptedVault = crypto.encryptWithVaultKey(vault, previousEncryptedVault, vaultKey)
        )
        val upload = client.upload(settings, envelope, previousEtag)
        saveMetadata(settings, vault, localFingerprint, upload.revision, upload.etag, "synced", "")
        return WebDavSyncResult("pushed", message, vaultKey = vaultKey)
    }

    private suspend fun pullRemoteWithVaultKey(
        settings: WebDavSettings,
        remoteVault: LocalVault,
        remoteEnvelope: EncryptedRemoteVaultBlobDto,
        vaultKey: ByteArray,
        remoteFingerprint: String,
        remoteRevision: String,
        remoteEtag: String,
        message: String = "WebDAV vault restored locally"
    ): WebDavSyncResult {
        repository.saveWithVaultKeyEnvelope(remoteVault, remoteEnvelope.toLocalEnvelope(remoteVault.updatedAt), vaultKey)
        saveMetadata(settings, remoteVault, remoteFingerprint, remoteRevision, remoteEtag, "synced", "")
        return WebDavSyncResult("pulled", message, vaultChanged = true, vaultKey = vaultKey)
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

    private suspend fun remoteKeyEnvelopeMatchesLocal(remote: EncryptedRemoteVaultBlobDto): Boolean {
        val local = runCatching { repository.exportEncryptedEnvelope() }.getOrNull() ?: return false
        return local.vaultId == remote.vaultId &&
            local.kdf.name == remote.kdf.name &&
            local.kdf.iterations == remote.kdf.iterations &&
            local.kdf.hash == remote.kdf.hash &&
            local.kdf.salt == remote.kdf.salt &&
            local.keyEncryption.cipher == remote.keyEncryption.cipher &&
            local.keyEncryption.iv == remote.keyEncryption.iv &&
            local.keyEncryption.ciphertext == remote.keyEncryption.ciphertext
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

    private suspend fun resolveLocalSnapshotIfNeeded(
        localVault: LocalVault,
        password: String,
        metadata: WebDavSyncMetadata,
        remoteVault: LocalVault?
    ): ResolvedLocalVault {
        val localFingerprint = fingerprint(localVault)
        val persistedVault = runCatching { repository.unlock(password) }.getOrNull()
        if (persistedVault != null) {
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
        }
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

private fun EncryptedRemoteVaultBlobDto.toLocalEnvelope(updatedAt: Long): EncryptedVaultEnvelope {
    return EncryptedVaultEnvelope(
        formatVersion = formatVersion,
        vaultId = vaultId,
        kdf = VaultKdf(
            name = kdf.name,
            iterations = kdf.iterations,
            hash = kdf.hash,
            salt = kdf.salt
        ),
        keyEncryption = AesGcmPayload(
            cipher = keyEncryption.cipher,
            iv = keyEncryption.iv,
            ciphertext = keyEncryption.ciphertext
        ),
        vaultEncryption = AesGcmPayload(
            cipher = vaultEncryption.cipher,
            iv = vaultEncryption.iv,
            ciphertext = vaultEncryption.ciphertext
        ),
        updatedAt = updatedAt
    )
}
