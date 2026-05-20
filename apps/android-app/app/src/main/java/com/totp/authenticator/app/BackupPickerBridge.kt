package com.totp.authenticator.app

import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.platform.LocalContext
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

@Composable
fun BackupPickerBridge(
    appState: TotpApplicationState,
    backupState: BackupViewModel,
    backupActions: BackupActionCoordinator
) {
    val activityContext = LocalContext.current

    fun readTextFromUri(uri: Uri): String {
        return activityContext.contentResolver.openInputStream(uri)
            ?.bufferedReader(Charsets.UTF_8)
            ?.use { it.readText() }
            ?: throw IllegalStateException("无法读取备份文件。")
    }

    fun writeTextToUri(uri: Uri, content: String) {
        activityContext.contentResolver.openOutputStream(uri)
            ?.bufferedWriter(Charsets.UTF_8)
            ?.use { it.write(content) }
            ?: throw IllegalStateException("无法写入备份文件。")
    }

    val backupExportLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.CreateDocument("application/json")
    ) { uri ->
        backupState.markExternalPickerActive(false)
        val content = backupState.consumePendingExportContent()
        if (uri == null || content == null) {
            backupState.updateBusy(false)
            return@rememberLauncherForActivityResult
        }
        backupState.launchTask(
            task = {
                withContext(Dispatchers.IO) {
                    writeTextToUri(uri, content)
                }
            },
            onSuccess = {
                backupState.showSuccess("已导出 ${appState.vault?.accounts?.size ?: 0} 个账号。")
            },
            onFailure = { error ->
                backupState.showError(error.message ?: "导出备份失败，请稍后重试。")
            }
        )
    }

    val backupImportLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.OpenDocument()
    ) { uri ->
        backupState.markExternalPickerActive(false)
        if (uri == null) {
            backupState.updateBusy(false)
            return@rememberLauncherForActivityResult
        }
        val password = appState.activePassword
        val content = runCatching { readTextFromUri(uri) }
            .onFailure { error ->
                backupState.showError(error.message ?: "导入备份失败，请稍后重试。")
                backupState.updateBusy(false)
            }
            .getOrNull() ?: return@rememberLauncherForActivityResult
        if (password == null) {
            backupState.requestImportPassword(content)
            backupState.updateBusy(false)
            return@rememberLauncherForActivityResult
        }
        backupState.prepareReadyImport(content, password)
    }

    LaunchedEffect(backupState.pendingExportFilename) {
        val filename = backupState.consumePendingExportFilename() ?: return@LaunchedEffect
        backupExportLauncher.launch(filename)
    }

    LaunchedEffect(backupState.importPickerRequested) {
        if (backupState.consumeImportPickerRequest()) {
            backupImportLauncher.launch(arrayOf("application/json", "text/*", "*/*"))
        }
    }

    LaunchedEffect(backupState.pendingReadyImport) {
        val request = backupState.consumeReadyImport() ?: return@LaunchedEffect
        backupActions.importContent(request.content, request.password)
    }
}
