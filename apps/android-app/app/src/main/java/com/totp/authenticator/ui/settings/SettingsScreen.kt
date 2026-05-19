package com.totp.authenticator.ui.settings

import androidx.annotation.DrawableRes
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Checkbox
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.dp
import com.totp.authenticator.R
import com.totp.authenticator.data.webdav.DEFAULT_WEBDAV_FILE_PATH
import com.totp.authenticator.data.webdav.WebDavSettings
import com.totp.authenticator.data.webdav.WebDavSyncMetadata
import com.totp.authenticator.ui.common.PasswordVisibilityIcon
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

@Composable
fun SettingsScreen(
    accountCount: Int,
    biometricUnlockEnabled: Boolean,
    biometricUnlockAvailable: Boolean,
    quickUnlockSetupRequired: Boolean,
    quickUnlockTitle: String,
    isBiometricBusy: Boolean,
    webDavSettings: WebDavSettings,
    webDavMetadata: WebDavSyncMetadata,
    isWebDavBusy: Boolean,
    backupStatusMessage: String,
    backupErrorMessage: String,
    isBackupBusy: Boolean,
    onSaveWebDavSettings: (WebDavSettings) -> Unit,
    onTestWebDav: (WebDavSettings) -> Unit,
    onSyncWebDav: () -> Unit,
    onBiometricUnlockChanged: (Boolean) -> Unit,
    onExportBackup: () -> Unit,
    onImportBackup: () -> Unit,
    modifier: Modifier = Modifier
) {
    var showWebDavDialog by remember { mutableStateOf(false) }

    Surface(
        modifier = modifier.fillMaxSize(),
        color = MaterialTheme.colorScheme.background
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 16.dp, vertical = 14.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp)
        ) {
            SettingsCard {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column(
                        modifier = Modifier.weight(1f),
                        verticalArrangement = Arrangement.spacedBy(6.dp)
                    ) {
                        Text(
                            text = quickUnlockTitle,
                            style = MaterialTheme.typography.titleMedium,
                            color = MaterialTheme.colorScheme.onSurface
                        )
                        Text(
                            text = biometricSummary(
                                enabled = biometricUnlockEnabled,
                                available = biometricUnlockAvailable,
                                setupRequired = quickUnlockSetupRequired
                            ),
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                    Checkbox(
                        checked = biometricUnlockEnabled,
                        enabled = !isBiometricBusy && (biometricUnlockAvailable || quickUnlockSetupRequired),
                        onCheckedChange = onBiometricUnlockChanged
                    )
                }
            }

            SettingsCard {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.Top
                ) {
                    Column(
                        modifier = Modifier.weight(1f),
                        verticalArrangement = Arrangement.spacedBy(6.dp)
                    ) {
                        Text(
                            text = "WebDAV 同步",
                            style = MaterialTheme.typography.titleMedium,
                            color = MaterialTheme.colorScheme.onSurface
                        )
                        val webDavStatusText = webDavSummary(webDavSettings)
                        if (webDavStatusText.isNotBlank()) {
                            Text(
                                text = webDavStatusText,
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                        if (!webDavSettings.enabled) {
                            Text(
                                text = "勾选后立即保存并启用同步。",
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            TextButton(
                                enabled = !isWebDavBusy,
                                onClick = { showWebDavDialog = true }
                            ) {
                                Text(if (webDavSettings.enabled) "编辑设置" else "设置同步")
                            }
                            TextButton(
                                enabled = !isWebDavBusy && webDavSettings.enabled,
                                onClick = onSyncWebDav
                            ) {
                                Text(if (isWebDavBusy) "同步中..." else "立即同步")
                            }
                        }
                    }
                    Column(
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.spacedBy(2.dp)
                    ) {
                        Checkbox(
                            checked = webDavSettings.enabled,
                            enabled = !isWebDavBusy,
                            onCheckedChange = { enabled ->
                                onSaveWebDavSettings(webDavSettings.copy(enabled = enabled))
                            }
                        )
                        Text(
                            text = if (webDavSettings.enabled) "已启用" else "未启用",
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }
            }

            SettingsCard {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column(
                        modifier = Modifier.weight(1f),
                        verticalArrangement = Arrangement.spacedBy(6.dp)
                    ) {
                        Text(
                            text = "导入 / 导出",
                            style = MaterialTheme.typography.titleMedium,
                            color = MaterialTheme.colorScheme.onSurface
                        )
                        InlineMessage(backupStatusMessage, isError = false)
                        InlineMessage(backupErrorMessage, isError = true)
                        if (backupStatusMessage.isBlank() && backupErrorMessage.isBlank()) {
                            Text(
                                text = "备份文件会使用当前主密码加密。",
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                    }
                    Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        BackupIconButton(
                            iconRes = R.drawable.action_export,
                            contentDescription = "导出",
                            enabled = !isBackupBusy,
                            onClick = onExportBackup
                        )
                        BackupIconButton(
                            iconRes = R.drawable.action_import,
                            contentDescription = "导入",
                            enabled = !isBackupBusy,
                            onClick = onImportBackup
                        )
                    }
                }
            }
        }
    }

    if (showWebDavDialog) {
        WebDavSettingsDialog(
            initialSettings = webDavSettings,
            isBusy = isWebDavBusy,
            onDismiss = { showWebDavDialog = false },
            onSave = {
                onSaveWebDavSettings(it)
                showWebDavDialog = false
            },
            onTest = onTestWebDav
        )
    }
}

@Composable
private fun SettingsCard(content: @Composable () -> Unit) {
    Surface(
        modifier = Modifier.fillMaxWidth(),
        shape = MaterialTheme.shapes.extraLarge,
        color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.78f),
        tonalElevation = 1.dp
    ) {
        Column(modifier = Modifier.padding(20.dp)) {
            content()
        }
    }
}

@Composable
private fun InlineMessage(message: String, isError: Boolean) {
    if (message.isBlank()) {
        return
    }
    Text(
        text = message,
        style = MaterialTheme.typography.bodySmall,
        color = if (isError) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.onSurfaceVariant
    )
}

@Composable
private fun BackupIconButton(
    @DrawableRes iconRes: Int,
    contentDescription: String,
    enabled: Boolean,
    onClick: () -> Unit
) {
    Surface(
        modifier = Modifier.size(44.dp),
        shape = CircleShape,
        color = MaterialTheme.colorScheme.surface,
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant)
    ) {
        IconButton(enabled = enabled, onClick = onClick) {
            Icon(
                painter = painterResource(iconRes),
                contentDescription = contentDescription,
                tint = Color.Unspecified
            )
        }
    }
}

@Composable
private fun WebDavSettingsDialog(
    initialSettings: WebDavSettings,
    isBusy: Boolean,
    onDismiss: () -> Unit,
    onSave: (WebDavSettings) -> Unit,
    onTest: (WebDavSettings) -> Unit
) {
    var serverUrl by remember(initialSettings) { mutableStateOf(initialSettings.serverUrl) }
    var filePath by remember(initialSettings) { mutableStateOf(initialSettings.filePath.ifBlank { DEFAULT_WEBDAV_FILE_PATH }) }
    var username by remember(initialSettings) { mutableStateOf(initialSettings.username) }
    var password by remember(initialSettings) { mutableStateOf(initialSettings.password) }
    var interval by remember(initialSettings) { mutableStateOf(initialSettings.syncIntervalMinutes.toString()) }
    var passwordVisible by remember { mutableStateOf(false) }

    val draft = WebDavSettings(
        enabled = initialSettings.enabled,
        serverUrl = serverUrl.trim(),
        filePath = filePath.trim().ifBlank { DEFAULT_WEBDAV_FILE_PATH },
        username = username,
        password = password,
        syncIntervalMinutes = interval.toIntOrNull()?.takeIf { it > 0 } ?: 15
    )

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("WebDAV 同步") },
        text = {
            Column(
                modifier = Modifier.verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                OutlinedTextField(
                    value = serverUrl,
                    onValueChange = { serverUrl = it },
                    modifier = Modifier.fillMaxWidth(),
                    label = { Text("服务器地址") },
                    placeholder = { Text("https://example.com/dav") },
                    singleLine = true
                )
                OutlinedTextField(
                    value = filePath,
                    onValueChange = { filePath = it },
                    modifier = Modifier.fillMaxWidth(),
                    label = { Text("保管库路径") },
                    placeholder = { Text(DEFAULT_WEBDAV_FILE_PATH) },
                    singleLine = true
                )
                OutlinedTextField(
                    value = username,
                    onValueChange = { username = it },
                    modifier = Modifier.fillMaxWidth(),
                    label = { Text("用户名") },
                    placeholder = { Text("WebDAV 用户名") },
                    singleLine = true
                )
                OutlinedTextField(
                    value = password,
                    onValueChange = { password = it },
                    modifier = Modifier.fillMaxWidth(),
                    label = { Text("密码") },
                    placeholder = { Text("密码") },
                    visualTransformation = if (passwordVisible) VisualTransformation.None else PasswordVisualTransformation(),
                    trailingIcon = {
                        PasswordVisibilityIcon(
                            visible = passwordVisible,
                            onToggle = { passwordVisible = !passwordVisible }
                        )
                    },
                    singleLine = true
                )
                OutlinedTextField(
                    value = interval,
                    onValueChange = { interval = it.filter(Char::isDigit) },
                    modifier = Modifier.fillMaxWidth(),
                    label = { Text("自动同步间隔（分钟）") },
                    placeholder = { Text("15") },
                    singleLine = true
                )
                Button(
                    modifier = Modifier.fillMaxWidth(),
                    enabled = !isBusy,
                    onClick = { onTest(draft) }
                ) {
                    Text("测试连接")
                }
            }
        },
        confirmButton = {
            TextButton(enabled = !isBusy, onClick = { onSave(draft) }) {
                Text("保存")
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("取消")
            }
        }
    )
}

private fun webDavSummary(settings: WebDavSettings): String {
    if (settings.updatedAt <= 0L) {
        return ""
    }
    val formatted = SimpleDateFormat("yyyy-MM-dd HH:mm", Locale.getDefault()).format(Date(settings.updatedAt))
    return "已保存 $formatted"
}

private fun biometricSummary(enabled: Boolean, available: Boolean, setupRequired: Boolean): String {
    if (setupRequired) {
        return "未设置系统锁屏，点击后前往系统设置。"
    }
    if (!available) {
        return "当前设备不支持快速解锁。"
    }
    return if (enabled) "开启后可用系统凭据解锁。" else "开启后可用系统凭据解锁。"
}
