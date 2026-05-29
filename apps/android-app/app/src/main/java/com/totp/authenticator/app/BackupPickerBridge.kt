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
        val payload = backupState.consumePendingExportPayload()
        if (uri == null || payload == null) {
            backupState.updateBusy(false)
            return@rememberLauncherForActivityResult
        }
        backupState.launchTask(
            task = {
                withContext(Dispatchers.IO) {
                    writeTextToUri(uri, payload.content)
                }
            },
            onSuccess = {
                backupState.showSuccess("已导出 ${appState.vault?.accounts?.size ?: 0} 个账号：${payload.filename}")
            },
            onFailure = { error ->
                backupState.showError(error.message ?: "导出备份失败，请稍后重试。")
            }
        )
    }

    val backupImportLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.OpenDocument()
    ) { uri ->
        val selectedAt = BackupPerfLogger.now()
        BackupPerfLogger.log("import picker result uriPresent=${uri != null}")
        backupState.markExternalPickerActive(false)
        if (uri == null) {
            backupState.updateBusy(false)
            BackupPerfLogger.log("import picker canceled elapsed=${BackupPerfLogger.elapsedSince(selectedAt)}ms")
            return@rememberLauncherForActivityResult
        }
        val password = appState.activePassword
        backupState.launchTask(
            finishBusyOnSuccess = false,
            task = {
                withContext(Dispatchers.IO) {
                    val readStartedAt = BackupPerfLogger.now()
                    BackupPerfLogger.log("import picker read start elapsed=${readStartedAt - selectedAt}ms")
                    readTextFromUri(uri)
                        .also { content ->
                            val readFinishedAt = BackupPerfLogger.now()
                            BackupPerfLogger.log(
                                "import picker read complete elapsed=${readFinishedAt - selectedAt}ms read=${readFinishedAt - readStartedAt}ms bytes=${content.length}"
                            )
                        }
                }
            },
            onSuccess = { content ->
                BackupPerfLogger.log("import picker content delivered elapsed=${BackupPerfLogger.elapsedSince(selectedAt)}ms hasPassword=${password != null}")
                if (password == null) {
                    backupState.requestImportPassword(content)
                    backupState.updateBusy(false)
                    BackupPerfLogger.log("import picker password requested elapsed=${BackupPerfLogger.elapsedSince(selectedAt)}ms")
                } else {
                    backupState.prepareReadyImport(content, password)
                    BackupPerfLogger.log("import picker ready import prepared elapsed=${BackupPerfLogger.elapsedSince(selectedAt)}ms")
                }
            },
            onFailure = { error ->
                BackupPerfLogger.log("import picker failed elapsed=${BackupPerfLogger.elapsedSince(selectedAt)}ms error=${error::class.java.simpleName}")
                backupState.showError(error.message ?: "导入备份失败，请稍后重试。")
            }
        )
    }

    LaunchedEffect(backupState.pendingExportFilename) {
        val filename = backupState.pendingExportFilenameForPicker() ?: return@LaunchedEffect
        backupExportLauncher.launch(filename)
    }

    LaunchedEffect(backupState.importPickerRequested) {
        if (backupState.consumeImportPickerRequest()) {
            backupImportLauncher.launch(arrayOf("application/json", "text/*", "*/*"))
        }
    }

    LaunchedEffect(backupState.pendingReadyImport) {
        val request = backupState.consumeReadyImport() ?: return@LaunchedEffect
        BackupPerfLogger.log("import picker launching ready import bytes=${request.content.length}")
        backupActions.importContent(request.content, request.password)
    }
}
