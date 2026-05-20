package com.totp.authenticator.app

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

class QuickUnlockCredentialRefresher(
    private val quickUnlockState: QuickUnlockViewModel,
    private val quickUnlockCoordinator: QuickUnlockCoordinator,
    private val onPrompt: (
        title: String,
        subtitle: String,
        onAuthenticated: () -> Unit,
        onError: (String) -> Unit
    ) -> Unit,
    private val onMessage: (String) -> Unit
) {
    fun refreshIfNeeded(previousVaultKey: ByteArray?, nextVaultKey: ByteArray) {
        if (!quickUnlockCoordinator.shouldRefreshCredential(quickUnlockState.enabled, previousVaultKey, nextVaultKey)) {
            return
        }
        quickUnlockState.updateBusy(true)
        onPrompt(
            "更新快速解锁",
            "同步密钥已切换为远端权威源，请确认后更新本机快速解锁凭据。",
            {
                quickUnlockState.launchCredentialTask(
                    task = {
                        withContext(Dispatchers.IO) {
                            val authenticatedCipher = quickUnlockCoordinator.createSetupCipher()
                            quickUnlockCoordinator.saveCredential(authenticatedCipher, nextVaultKey)
                        }
                    },
                    onSuccess = {
                        onMessage("快速解锁凭据已更新")
                    },
                    onFailure = { error ->
                        onMessage(error.message ?: "快速解锁凭据更新失败，请重新开启快速解锁。")
                    }
                )
            },
            { message ->
                onMessage(message.ifBlank { "快速解锁凭据未更新，请重新开启快速解锁。" })
            }
        )
    }
}
