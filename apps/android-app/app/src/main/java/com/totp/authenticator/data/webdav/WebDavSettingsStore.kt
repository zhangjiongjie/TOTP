@file:Suppress("DEPRECATION")

package com.totp.authenticator.data.webdav

import android.content.Context
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json

class WebDavSettingsStore(context: Context) {
    private val preferences: SharedPreferences = EncryptedSharedPreferences.create(
        context,
        ENCRYPTED_PREFERENCES_NAME,
        MasterKey.Builder(context)
            .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
            .build(),
        EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
        EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
    )
    private val legacyPreferences = context.getSharedPreferences(LEGACY_PREFERENCES_NAME, Context.MODE_PRIVATE)

    fun loadSettings(): WebDavSettings {
        val payload = preferences.getString(KEY_SETTINGS, null)
            ?: migrateLegacyString(KEY_SETTINGS)
            ?: return WebDavSettings()
        return runCatching {
            json.decodeFromString<WebDavSettingsDto>(payload).toDomain()
        }.getOrElse { WebDavSettings() }
    }

    fun saveSettings(settings: WebDavSettings): WebDavSettings {
        preferences.edit()
            .putString(KEY_SETTINGS, json.encodeToString(WebDavSettingsDto.fromDomain(settings)))
            .apply()
        return settings
    }

    fun loadMetadata(): WebDavSyncMetadata {
        val payload = preferences.getString(KEY_METADATA, null)
            ?: migrateLegacyString(KEY_METADATA)
            ?: return WebDavSyncMetadata()
        return runCatching {
            json.decodeFromString<WebDavSyncMetadataDto>(payload).toDomain()
        }.getOrElse { WebDavSyncMetadata() }
    }

    fun saveMetadata(metadata: WebDavSyncMetadata): WebDavSyncMetadata {
        preferences.edit()
            .putString(KEY_METADATA, json.encodeToString(WebDavSyncMetadataDto.fromDomain(metadata)))
            .apply()
        return metadata
    }

    fun resetMetadata() {
        preferences.edit().remove(KEY_METADATA).apply()
        legacyPreferences.edit().remove(KEY_METADATA).apply()
    }

    private fun migrateLegacyString(key: String): String? {
        val legacyPayload = legacyPreferences.getString(key, null) ?: return null
        preferences.edit()
            .putString(key, legacyPayload)
            .apply()
        legacyPreferences.edit()
            .remove(key)
            .apply()
        return legacyPayload
    }

    private companion object {
        const val LEGACY_PREFERENCES_NAME = "totp_webdav"
        const val ENCRYPTED_PREFERENCES_NAME = "totp_webdav_encrypted"
        const val KEY_SETTINGS = "webdav.settings"
        const val KEY_METADATA = "webdav.sync.metadata"

        val json = Json {
            encodeDefaults = true
            ignoreUnknownKeys = true
        }
    }
}

@Serializable
private data class WebDavSettingsDto(
    val enabled: Boolean = false,
    val serverUrl: String = "",
    val filePath: String = DEFAULT_WEBDAV_FILE_PATH,
    val username: String = "",
    val password: String = "",
    val syncIntervalMinutes: Int = 15,
    val updatedAt: Long = 0L
) {
    fun toDomain(): WebDavSettings {
        return WebDavSettings(
            enabled = enabled,
            serverUrl = serverUrl,
            filePath = filePath,
            username = username,
            password = password,
            syncIntervalMinutes = syncIntervalMinutes.takeIf { it > 0 } ?: 15,
            updatedAt = updatedAt
        )
    }

    companion object {
        fun fromDomain(settings: WebDavSettings): WebDavSettingsDto {
            return WebDavSettingsDto(
                enabled = settings.enabled,
                serverUrl = settings.serverUrl,
                filePath = settings.filePath.ifBlank { DEFAULT_WEBDAV_FILE_PATH },
                username = settings.username,
                password = settings.password,
                syncIntervalMinutes = settings.syncIntervalMinutes.takeIf { it > 0 } ?: 15,
                updatedAt = settings.updatedAt
            )
        }
    }
}

@Serializable
private data class WebDavSyncMetadataDto(
    val syncProfileKey: String = "",
    val baseFingerprint: String = "",
    val baseVaultJson: String = "",
    val remoteRevision: String = "",
    val remoteEtag: String = "",
    val lastSyncedAt: Long = 0L,
    val lastStatus: String = "idle",
    val lastError: String = ""
) {
    fun toDomain(): WebDavSyncMetadata {
        return WebDavSyncMetadata(
            syncProfileKey = syncProfileKey,
            baseFingerprint = baseFingerprint,
            baseVaultJson = baseVaultJson,
            remoteRevision = remoteRevision,
            remoteEtag = remoteEtag,
            lastSyncedAt = lastSyncedAt,
            lastStatus = lastStatus,
            lastError = lastError
        )
    }

    companion object {
        fun fromDomain(metadata: WebDavSyncMetadata): WebDavSyncMetadataDto {
            return WebDavSyncMetadataDto(
                syncProfileKey = metadata.syncProfileKey,
                baseFingerprint = metadata.baseFingerprint,
                baseVaultJson = metadata.baseVaultJson,
                remoteRevision = metadata.remoteRevision,
                remoteEtag = metadata.remoteEtag,
                lastSyncedAt = metadata.lastSyncedAt,
                lastStatus = metadata.lastStatus,
                lastError = metadata.lastError
            )
        }
    }
}
