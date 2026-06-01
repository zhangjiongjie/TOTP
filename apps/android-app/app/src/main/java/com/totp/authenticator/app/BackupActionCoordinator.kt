package com.totp.authenticator.app

import com.totp.authenticator.data.vault.LocalVault
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

class BackupActionCoordinator(
    private val appState: TotpApplicationState,
    private val backupState: BackupViewModel,
    private val backupFlowCoordinator: BackupFlowCoordinator,
    private val onLocalChange: (LocalVault, String?, ByteArray?) -> Unit
) {
    fun startExport() {
        backupState.clearMessage()
        val vault = appState.vault
        val password = appState.activePassword
        val vaultKey = appState.activeVaultKey
        if (vault == null || (password == null && vaultKey == null)) {
            backupState.showError("保管库未解锁。")
            return
        }
        if (vaultKey != null) {
            exportWithVaultKey(vaultKey.copyOf())
            return
        }
        exportWithPassword(password!!)
    }

    fun startImport() {
        backupState.clearMessage()
        if (appState.vault == null || (appState.activePassword == null && appState.activeVaultKey == null)) {
            backupState.showError("保管库未解锁。")
            return
        }
        backupState.updateBusy(true)
        backupState.requestImportPicker()
    }

    fun exportWithPassword(password: String) {
        backupState.clearMessage()
        val vault = appState.vault
        if (vault == null) {
            backupState.showError("保管库未解锁。")
            return
        }
        backupState.launchTask(
            finishBusyOnSuccess = false,
            task = {
                withContext(Dispatchers.IO) {
                    backupFlowCoordinator.createExportWithPassword(vault, password)
                }
            },
            onSuccess = { payload ->
                backupState.prepareExport(payload)
            },
            onFailure = { error ->
                backupState.showError(error.message ?: "导出备份失败，请稍后重试。")
            }
        )
    }

    fun exportWithVaultKey(vaultKey: ByteArray) {
        backupState.clearMessage()
        val vault = appState.vault
        if (vault == null) {
            backupState.showError("保管库未解锁。")
            return
        }
        backupState.launchTask(
            finishBusyOnSuccess = false,
            task = {
                withContext(Dispatchers.IO) {
                    backupFlowCoordinator.createExportWithVaultKey(vault, vaultKey)
                }
            },
            onSuccess = { payload ->
                backupState.prepareExport(payload)
            },
            onFailure = { error ->
                backupState.showError(error.message ?: "导出备份失败，请稍后重试。")
            }
        )
    }

    fun importContent(content: String, importPassword: String) {
        val requestedAt = BackupPerfLogger.now()
        BackupPerfLogger.log("import action received bytes=${content.length}")
        backupState.clearMessage()
        backupState.showSuccess("正在导入...")
        val localPassword = appState.activePassword
        val localVaultKey = appState.activeVaultKey?.copyOf()
        BackupPerfLogger.log("import action progress shown elapsed=${BackupPerfLogger.elapsedSince(requestedAt)}ms")
        backupState.launchTask(
            task = {
                withContext(Dispatchers.IO) {
                    backupFlowCoordinator.importBackup(content, importPassword, localPassword, localVaultKey)
                }
            },
            onSuccess = { result ->
                val successAt = BackupPerfLogger.now()
                BackupPerfLogger.log("import action worker success elapsed=${successAt - requestedAt}ms")
                if (localPassword != null) {
                    appState.updateUnlockedVault(result.vault, localPassword, result.vaultKey)
                } else {
                    appState.updateUnlockedVaultWithKey(result.vault, result.vaultKey)
                }
                val stateUpdatedAt = BackupPerfLogger.now()
                BackupPerfLogger.log("import action app state updated elapsed=${stateUpdatedAt - requestedAt}ms update=${stateUpdatedAt - successAt}ms")
                backupState.showSuccess("已导入 ${result.vault.accounts.size} 个账号")
                val messageShownAt = BackupPerfLogger.now()
                BackupPerfLogger.log("import action success shown elapsed=${messageShownAt - requestedAt}ms show=${messageShownAt - stateUpdatedAt}ms")
                onLocalChange(result.vault, localPassword, result.vaultKey)
                val localChangeAt = BackupPerfLogger.now()
                BackupPerfLogger.log("import action local change requested elapsed=${localChangeAt - requestedAt}ms hook=${localChangeAt - messageShownAt}ms")
            },
            onFailure = { error ->
                BackupPerfLogger.log("import action failed elapsed=${BackupPerfLogger.elapsedSince(requestedAt)}ms error=${error::class.java.simpleName}")
                if (BackupPasswordPromptPolicy.shouldPromptForImportPassword(error)) {
                    backupState.requestImportPassword(content)
                } else {
                    backupState.showError(error.message ?: "导入备份失败，请稍后重试。")
                }
            }
        )
    }
}
