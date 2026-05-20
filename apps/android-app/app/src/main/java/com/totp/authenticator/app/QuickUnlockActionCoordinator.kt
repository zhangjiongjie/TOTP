package com.totp.authenticator.app

import com.totp.authenticator.data.vault.LocalVault
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

class QuickUnlockActionCoordinator(
    private val appState: TotpApplicationState,
    private val quickUnlockState: QuickUnlockViewModel,
    private val unlockState: UnlockViewModel,
    private val quickUnlockCoordinator: QuickUnlockCoordinator,
    private val onRefreshAvailability: () -> Unit,
    private val onPrompt: (
        title: String,
        subtitle: String,
        onAuthenticated: () -> Unit,
        onError: (String) -> Unit
    ) -> Unit,
    private val onSystemCredentialSetupRequired: () -> Unit,
    private val onMessage: (String) -> Unit,
    private val onSyncAfterUnlock: (LocalVault, String?, ByteArray?) -> Unit
) {
    fun enable(vaultKey: ByteArray) {
        onRefreshAvailability()
        if (quickUnlockState.setupRequired) {
            onSystemCredentialSetupRequired()
            return
        }
        if (!quickUnlockState.available) {
            onMessage("当前设备不支持快速解锁")
            return
        }
        quickUnlockState.updateBusy(true)
        onPrompt(
            "开启快速解锁",
            "确认后将使用系统凭据保护本地快速解锁凭据。",
            {
                quickUnlockState.launchCredentialTask(
                    task = {
                        withContext(Dispatchers.IO) {
                            val authenticatedCipher = quickUnlockCoordinator.createSetupCipher()
                            quickUnlockCoordinator.saveCredential(authenticatedCipher, vaultKey)
                        }
                    },
                    onSuccess = {
                        quickUnlockState.updateEnabled(true)
                        onMessage("快速解锁已开启")
                    },
                    onFailure = { error ->
                        onMessage(error.message ?: "Could not enable biometric unlock")
                    }
                )
            },
            { message -> onMessage(message) }
        )
    }

    fun disable() {
        quickUnlockCoordinator.disable()
        quickUnlockState.updateEnabled(false)
        onMessage("快速解锁已关闭")
    }

    fun refreshCredentialIfNeeded(previousVaultKey: ByteArray?, nextVaultKey: ByteArray) {
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

    fun startUnlock() {
        quickUnlockState.updateBusy(false)
        quickUnlockState.markAutoAttempted()
        if (!quickUnlockState.enabled) {
            unlockState.showError("快速解锁未开启，请使用主密码。")
            return
        }
        quickUnlockState.updateBusy(true)
        onPrompt(
            "快速解锁",
            "验证系统凭据后快速解锁本地保管库。",
            {
                quickUnlockState.launchCredentialTask(
                    task = {
                        withContext(Dispatchers.IO) {
                            val authenticatedCipher = quickUnlockCoordinator.createUnlockCipher()
                                ?: throw IllegalStateException("快速解锁凭据已失效，请使用主密码。")
                            quickUnlockCoordinator.unlock(authenticatedCipher)
                        }
                    },
                    onSuccess = { result ->
                        unlockState.clearError()
                        appState.applyUnlockedVaultWithKey(result.vault, result.vaultKey)
                        onSyncAfterUnlock(result.vault, null, result.vaultKey)
                    },
                    onFailure = { error ->
                        unlockState.showError(error.message ?: "快速解锁失败，请使用主密码。")
                    }
                )
            },
            { message ->
                unlockState.showError(message.ifBlank { "快速解锁已取消，请使用主密码。" })
            }
        )
    }
}
