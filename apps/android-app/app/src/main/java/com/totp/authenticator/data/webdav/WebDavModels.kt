package com.totp.authenticator.data.webdav

data class WebDavSettings(
    val enabled: Boolean = false,
    val serverUrl: String = "",
    val filePath: String = DEFAULT_WEBDAV_FILE_PATH,
    val username: String = "",
    val password: String = "",
    val syncIntervalMinutes: Int = 15,
    val updatedAt: Long = 0L
) {
    val isConfigured: Boolean
        get() = serverUrl.isNotBlank() && filePath.isNotBlank()
}

data class WebDavSyncMetadata(
    val syncProfileKey: String = "",
    val baseFingerprint: String = "",
    val baseVaultJson: String = "",
    val remoteRevision: String = "",
    val remoteEtag: String = "",
    val lastSyncedAt: Long = 0L,
    val lastStatus: String = "idle",
    val lastError: String = ""
)

data class WebDavSyncResult(
    val status: String,
    val message: String,
    val vaultChanged: Boolean = false
)

const val DEFAULT_WEBDAV_FILE_PATH = "/totp/vault.json"
