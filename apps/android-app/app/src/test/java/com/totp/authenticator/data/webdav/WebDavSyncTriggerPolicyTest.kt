package com.totp.authenticator.data.webdav

import org.junit.Assert.assertEquals
import org.junit.Test

class WebDavSyncTriggerPolicyTest {
    @Test
    fun localChangeTriggerUsesLocalChangePushMessage() {
        val message = WebDavSyncTriggerPolicy.resolveLocalPushMessage(
            WEBDAV_SYNC_TRIGGER_LOCAL_CHANGE,
            defaultMessage = "Local changes synced to WebDAV"
        )

        assertEquals("本地变更已同步到 WebDAV。", message)
    }

    @Test
    fun manualTriggerKeepsDefaultPushMessage() {
        val message = WebDavSyncTriggerPolicy.resolveLocalPushMessage(
            WEBDAV_SYNC_TRIGGER_MANUAL,
            defaultMessage = "Local changes synced to WebDAV"
        )

        assertEquals("Local changes synced to WebDAV", message)
    }
}
