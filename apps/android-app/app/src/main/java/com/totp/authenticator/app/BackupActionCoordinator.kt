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
        val vault = appState.vault
        val password = appState.activePassword
        val vaultKey = appState.activeVaultKey
        if (vault == null || (password == null && vaultKey == null)) {
            backupState.showError("保管库未解锁。")
            return
        }
        if (password == null) {
            exportWithVaultKey(vaultKey!!)
            return
        }
        exportWithPassword(password)
    }

    fun startImport() {
        if (appState.vault == null || (appState.activePassword == null && appState.activeVaultKey == null)) {
            backupState.showError("保管库未解锁。")
            return
        }
        backupState.updateBusy(true)
        backupState.requestImportPicker()
    }

    fun exportWithPassword(password: String) {
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

    fun importContent(content: String, password: String) {
        backupState.launchTask(
            task = {
                withContext(Dispatchers.IO) {
                    backupFlowCoordinator.importBackup(content, password)
                }
            },
            onSuccess = { result ->
                appState.updateUnlockedVault(result.vault, password, result.vaultKey)
                backupState.showSuccess("已导入 ${result.vault.accounts.size} 个账号。")
                onLocalChange(result.vault, password, result.vaultKey)
            },
            onFailure = { error ->
                backupState.showError(error.message ?: "导入备份失败，请稍后重试。")
            }
        )
    }
}
