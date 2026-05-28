package com.totp.authenticator.data.webdav

internal const val WEBDAV_SYNC_TRIGGER_MANUAL = "manual"
internal const val WEBDAV_SYNC_TRIGGER_LOCAL_CHANGE = "localChange"

internal object WebDavSyncTriggerPolicy {
    fun resolveLocalPushMessage(trigger: String, defaultMessage: String): String {
        return if (trigger == WEBDAV_SYNC_TRIGGER_LOCAL_CHANGE) {
            "本地变更已同步到 WebDAV。"
        } else {
            defaultMessage
        }
    }

    fun resolveDisabledMessage(trigger: String, defaultMessage: String): String {
        return if (trigger == WEBDAV_SYNC_TRIGGER_LOCAL_CHANGE) {
            "未启用 WebDAV，同步仅保留在本机。"
        } else {
            defaultMessage
        }
    }
}
