package com.totp.authenticator.app

import android.Manifest
import android.app.Activity
import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.provider.Settings
import android.util.Log
import android.widget.Toast
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.biometric.BiometricManager.Authenticators.BIOMETRIC_STRONG
import androidx.biometric.BiometricManager.Authenticators.DEVICE_CREDENTIAL
import androidx.biometric.BiometricPrompt
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalLifecycleOwner
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import androidx.core.content.ContextCompat
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.fragment.app.FragmentActivity
import com.totp.authenticator.R
import com.totp.authenticator.core.account.TotpAccount
import com.totp.authenticator.data.backup.BackupService
import com.totp.authenticator.data.biometric.BiometricVaultUnlockStore
import com.totp.authenticator.data.biometric.QuickUnlockAvailability
import com.totp.authenticator.data.vault.LocalVault
import com.totp.authenticator.data.vault.VaultRepository
import com.totp.authenticator.data.webdav.RemoteVaultCrypto
import com.totp.authenticator.data.webdav.RemoteVaultKeyCacheStore
import com.totp.authenticator.data.webdav.WebDavSettingsStore
import com.totp.authenticator.data.webdav.WebDavSyncResult
import com.totp.authenticator.data.webdav.WebDavSyncService
import com.totp.authenticator.ui.app.HeaderCircleIconButton
import com.totp.authenticator.ui.app.MainDestination
import com.totp.authenticator.ui.app.TotpMainScaffold
import com.totp.authenticator.ui.editor.AccountEditorScreen
import com.totp.authenticator.ui.home.HomeScreen
import com.totp.authenticator.ui.importer.QrImportException
import com.totp.authenticator.ui.importer.QrImportService
import com.totp.authenticator.ui.importer.QrScannerScreen
import com.totp.authenticator.ui.common.PasswordVisibilityIcon
import com.totp.authenticator.ui.settings.SettingsScreen
import com.totp.authenticator.ui.unlock.UnlockScreen
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import javax.crypto.AEADBadTagException

@Composable
fun TotpApp() {
    val activityContext = LocalContext.current
    val lifecycleOwner = LocalLifecycleOwner.current
    val context = activityContext.applicationContext
    val repository = remember { VaultRepository(context) }
    val qrImportService = remember(activityContext) { QrImportService(activityContext) }
    val backupService = remember { BackupService() }
    val webDavSettingsStore = remember { WebDavSettingsStore(context) }
    val remoteKeyCacheStore = remember { RemoteVaultKeyCacheStore(context) }
    val webDavSyncService = remember {
        WebDavSyncService(
            repository = repository,
            settingsStore = webDavSettingsStore,
            crypto = RemoteVaultCrypto(remoteKeyCacheStore)
        )
    }
    val biometricUnlockStore = remember { BiometricVaultUnlockStore(context) }
    val appScope = rememberCoroutineScope()
    var hasExistingVault by remember { mutableStateOf(repository.hasVault()) }
    val state: TotpApplicationState = viewModel(
        factory = object : ViewModelProvider.Factory {
            @Suppress("UNCHECKED_CAST")
            override fun <T : ViewModel> create(modelClass: Class<T>): T {
                return TotpApplicationState(hasExistingVault) as T
            }
        }
    )
    var nowMillis by remember { mutableStateOf(System.currentTimeMillis()) }
    var errorMessage by remember { mutableStateOf<String?>(null) }
    var unlockBusy by remember { mutableStateOf(false) }
    var importedOtpAuthUri by remember { mutableStateOf<String?>(null) }
    var webDavSettings by remember { mutableStateOf(webDavSyncService.loadSettings()) }
    var webDavMetadata by remember { mutableStateOf(webDavSyncService.loadMetadata()) }
    var webDavBusy by remember { mutableStateOf(false) }
    var biometricUnlockEnabled by remember { mutableStateOf(biometricUnlockStore.isEnabled()) }
    var quickUnlockAvailability by remember { mutableStateOf(biometricUnlockStore.quickUnlockStatus()) }
    var biometricUnlockAvailable by remember { mutableStateOf(quickUnlockAvailability == QuickUnlockAvailability.Available) }
    var hasStrongBiometric by remember { mutableStateOf(biometricUnlockStore.hasStrongBiometric()) }
    var biometricBusy by remember { mutableStateOf(false) }
    var autoQuickUnlockAttempted by remember { mutableStateOf(false) }
    var foregroundUnlockTick by remember { mutableStateOf(0) }
    var hasSyncedAfterUnlock by remember { mutableStateOf(false) }
    var homeCopyStatusMessage by remember { mutableStateOf("") }
    var homeErrorStatusMessage by remember { mutableStateOf("") }
    var webDavStatusMessage by remember { mutableStateOf("") }
    var webDavStatusIsError by remember { mutableStateOf(false) }
    var backupStatusMessage by remember { mutableStateOf("") }
    var backupErrorMessage by remember { mutableStateOf("") }
    var backupBusy by remember { mutableStateOf(false) }
    var passwordChangeDialogVisible by remember { mutableStateOf(false) }
    var passwordChangeInProgress by remember { mutableStateOf(false) }
    var passwordChangeDialogMessage by remember { mutableStateOf("") }
    var passwordChangeDialogIsError by remember { mutableStateOf(false) }
    var masterPasswordErrorMessage by remember { mutableStateOf("") }
    var pendingExportContent by remember { mutableStateOf<String?>(null) }
    var pendingImportUri by remember { mutableStateOf<Uri?>(null) }
    var pendingBackupPasswordAction by remember { mutableStateOf<BackupPasswordAction?>(null) }
    var documentPickerActive by remember { mutableStateOf(false) }

    DisposableEffect(lifecycleOwner) {
        val observer = LifecycleEventObserver { _, event ->
            val isConfigurationChange = (activityContext as? Activity)?.isChangingConfigurations == true
            when (event) {
                Lifecycle.Event.ON_START -> {
                    if (state.currentRoute == TotpRoute.Unlock) {
                        biometricBusy = false
                        autoQuickUnlockAttempted = false
                    }
                }
                Lifecycle.Event.ON_RESUME -> {
                    if (state.currentRoute == TotpRoute.Unlock) {
                        biometricBusy = false
                        autoQuickUnlockAttempted = false
                    }
                    foregroundUnlockTick += 1
                }
                Lifecycle.Event.ON_STOP -> {
                    if (state.currentRoute == TotpRoute.Unlock) {
                        biometricBusy = false
                        autoQuickUnlockAttempted = false
                    }
                    if (state.isUnlocked && !isConfigurationChange && !documentPickerActive) {
                        webDavSyncService.clearCryptoCache()
                        biometricBusy = false
                        autoQuickUnlockAttempted = false
                        hasSyncedAfterUnlock = false
                        state.lock()
                    }
                }
                else -> Unit
            }
        }
        lifecycleOwner.lifecycle.addObserver(observer)
        onDispose {
            lifecycleOwner.lifecycle.removeObserver(observer)
        }
    }

    fun refreshQuickUnlockAvailability() {
        quickUnlockAvailability = biometricUnlockStore.quickUnlockStatus()
        biometricUnlockAvailable = quickUnlockAvailability == QuickUnlockAvailability.Available
        hasStrongBiometric = biometricUnlockStore.hasStrongBiometric()
    }

    fun acceptImportedOtpAuthUri(uri: String) {
        importedOtpAuthUri = uri
        state.navigate(TotpRoute.Add)
        Toast.makeText(context, "QR code imported", Toast.LENGTH_SHORT).show()
    }

    fun showQrImportError(message: String = "Could not read QR code") {
        Toast.makeText(context, message, Toast.LENGTH_SHORT).show()
    }

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
        documentPickerActive = false
        val content = pendingExportContent
        pendingExportContent = null
        if (uri == null || content == null) {
            backupBusy = false
            return@rememberLauncherForActivityResult
        }
        appScope.launch {
            runCatching {
                withContext(Dispatchers.IO) {
                    writeTextToUri(uri, content)
                }
            }.onSuccess {
                backupStatusMessage = "已导出 ${state.vault?.accounts?.size ?: 0} 个账号。"
                backupErrorMessage = ""
            }.onFailure { error ->
                backupErrorMessage = error.message ?: "导出备份失败，请稍后重试。"
            }
            backupBusy = false
        }
    }

    fun exportBackupWithPassword(password: String) {
        val vault = state.vault
        if (vault == null) {
            backupErrorMessage = "保管库未解锁。"
            return
        }
        appScope.launch {
            backupBusy = true
            runCatching {
                withContext(Dispatchers.IO) {
                    repository.exportVaultKey(password)
                    backupService.createEncryptedExport(vault, password) to backupService.createBackupFilename()
                }
            }.onSuccess { (content, filename) ->
                pendingExportContent = content
                documentPickerActive = true
                backupExportLauncher.launch(filename)
            }.onFailure { error ->
                backupErrorMessage = error.message ?: "导出备份失败，请稍后重试。"
                backupBusy = false
            }
        }
    }

    fun exportBackupWithVaultKey(vaultKey: ByteArray) {
        val vault = state.vault
        if (vault == null) {
            backupErrorMessage = "保管库未解锁。"
            return
        }
        appScope.launch {
            backupBusy = true
            runCatching {
                withContext(Dispatchers.IO) {
                    val envelope = repository.exportEncryptedEnvelope()
                    backupService.createEncryptedExport(vault, envelope, vaultKey) to backupService.createBackupFilename()
                }
            }.onSuccess { (content, filename) ->
                pendingExportContent = content
                documentPickerActive = true
                backupExportLauncher.launch(filename)
            }.onFailure { error ->
                backupErrorMessage = error.message ?: "导出备份失败，请稍后重试。"
                backupBusy = false
            }
        }
    }

    fun importBackupFromUri(uri: Uri, password: String) {
        appScope.launch {
            backupBusy = true
            runCatching {
                withContext(Dispatchers.IO) {
                    val vaultKey = repository.exportVaultKey(password)
                    val importedVault = backupService.parseImport(readTextFromUri(uri), password)
                    repository.save(importedVault, password)
                    if (webDavSyncService.loadSettings().enabled) {
                        webDavSyncService.syncLocalChange(password)
                    }
                    importedVault to vaultKey
                }
            }.onSuccess { (importedVault, vaultKey) ->
                state.updateUnlockedVault(importedVault, password, vaultKey)
                webDavMetadata = webDavSyncService.loadMetadata()
                backupStatusMessage = "已导入 ${importedVault.accounts.size} 个账号。"
                backupErrorMessage = ""
            }.onFailure { error ->
                backupErrorMessage = error.message ?: "导入备份失败，请稍后重试。"
            }
            backupBusy = false
        }
    }

    val backupImportLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.OpenDocument()
    ) { uri ->
        documentPickerActive = false
        if (uri == null) {
            backupBusy = false
            return@rememberLauncherForActivityResult
        }
        val password = state.activePassword
        if (password == null) {
            pendingImportUri = uri
            pendingBackupPasswordAction = BackupPasswordAction.Import
            backupBusy = false
            return@rememberLauncherForActivityResult
        }
        importBackupFromUri(uri, password)
    }

    val imagePickerLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.PickVisualMedia()
    ) { uri ->
        if (uri == null) {
            return@rememberLauncherForActivityResult
        }
        appScope.launch {
            runCatching {
                withContext(Dispatchers.IO) {
                    qrImportService.decodeImage(uri)
                }
            }.onSuccess(::acceptImportedOtpAuthUri)
                .onFailure { error ->
                    Log.w("TotpQrImport", "Could not read QR image", error)
                    showQrImportError(
                        error.message?.takeIf { it.isNotBlank() }
                            ?: if (error is QrImportException) "No QR code found in image" else "Could not read QR image"
                    )
                }
        }
    }

    val cameraPermissionLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.RequestPermission()
    ) { granted ->
        if (granted) {
            state.navigate(TotpRoute.Scan)
        } else {
            Toast.makeText(context, "Camera permission is required to scan QR codes", Toast.LENGTH_SHORT).show()
        }
    }

    LaunchedEffect(Unit) {
        launch(Dispatchers.IO) {
            runCatching { repository.warmUpCrypto() }
        }
    }

    LaunchedEffect(state.currentRoute) {
        if (state.currentRoute != TotpRoute.Home) {
            return@LaunchedEffect
        }
        while (true) {
            nowMillis = System.currentTimeMillis()
            delay(1_000)
        }
    }

    LaunchedEffect(state.currentRoute) {
        if (state.currentRoute == TotpRoute.Unlock || state.currentRoute == TotpRoute.Settings) {
            refreshQuickUnlockAvailability()
        }
        if (state.currentRoute != TotpRoute.Unlock) {
            autoQuickUnlockAttempted = false
        }
    }

    LaunchedEffect(homeCopyStatusMessage, homeErrorStatusMessage) {
        if (homeCopyStatusMessage.isBlank() && homeErrorStatusMessage.isBlank()) {
            return@LaunchedEffect
        }
        delay(2_000)
        homeCopyStatusMessage = ""
        homeErrorStatusMessage = ""
    }

    LaunchedEffect(webDavStatusMessage) {
        if (webDavStatusMessage.isBlank()) {
            return@LaunchedEffect
        }
        delay(2_000)
        webDavStatusMessage = ""
        webDavStatusIsError = false
    }

    fun showPersistenceError(message: String) {
        errorMessage = message
        Toast.makeText(context, message, Toast.LENGTH_SHORT).show()
    }

    fun startQrImageImport() {
        imagePickerLauncher.launch(
            PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly)
        )
    }

    fun startQrScan() {
        if (ContextCompat.checkSelfPermission(activityContext, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED) {
            state.navigate(TotpRoute.Scan)
        } else {
            cameraPermissionLauncher.launch(Manifest.permission.CAMERA)
        }
    }

    fun startBackupExport() {
        val vault = state.vault
        val password = state.activePassword
        val vaultKey = state.activeVaultKey
        if (vault == null || (password == null && vaultKey == null)) {
            backupErrorMessage = "保管库未解锁。"
            return
        }
        if (password == null) {
            exportBackupWithVaultKey(vaultKey!!)
            return
        }
        exportBackupWithPassword(password)
    }

    fun startBackupImport() {
        if (state.vault == null || (state.activePassword == null && state.activeVaultKey == null)) {
            backupErrorMessage = "保管库未解锁。"
            return
        }
        backupBusy = true
        documentPickerActive = true
        backupImportLauncher.launch(arrayOf("application/json", "text/*", "*/*"))
    }

    fun authenticateQuickUnlock(
        title: String,
        subtitle: String,
        onAuthenticated: () -> Unit,
        onError: (String) -> Unit = { message ->
            Toast.makeText(context, message, Toast.LENGTH_SHORT).show()
        }
    ) {
        val fragmentActivity = activityContext as? FragmentActivity
        if (fragmentActivity == null) {
            biometricBusy = false
            onError("当前界面不可使用快速解锁")
            return
        }
        val prompt = BiometricPrompt(
            fragmentActivity,
            ContextCompat.getMainExecutor(activityContext),
            object : BiometricPrompt.AuthenticationCallback() {
                override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
                    onAuthenticated()
                }

                override fun onAuthenticationError(errorCode: Int, errString: CharSequence) {
                    biometricBusy = false
                    onError(errString.toString())
                }

                override fun onAuthenticationFailed() {
                    onError("系统认证失败，请重试。")
                }
            }
        )
        val promptInfo = BiometricPrompt.PromptInfo.Builder()
            .setTitle(title)
            .setSubtitle(subtitle)
            .setAllowedAuthenticators(BIOMETRIC_STRONG or DEVICE_CREDENTIAL)
            .build()
        runCatching {
            prompt.authenticate(promptInfo)
        }.onFailure { error ->
            biometricBusy = false
            onError(error.message ?: "无法启动系统凭据验证")
        }
    }

    fun enableBiometricUnlock(vaultKey: ByteArray) {
        refreshQuickUnlockAvailability()
        if (quickUnlockAvailability == QuickUnlockAvailability.NeedsSystemCredential) {
            val intent = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                Intent(Settings.ACTION_BIOMETRIC_ENROLL).putExtra(
                    Settings.EXTRA_BIOMETRIC_AUTHENTICATORS_ALLOWED,
                    BIOMETRIC_STRONG or DEVICE_CREDENTIAL
                )
            } else {
                Intent(Settings.ACTION_SECURITY_SETTINGS)
            }
            Toast.makeText(context, "请先设置系统锁屏密码。", Toast.LENGTH_SHORT).show()
            activityContext.startActivity(intent)
            return
        }
        if (!biometricUnlockAvailable) {
            Toast.makeText(context, "当前设备不支持快速解锁", Toast.LENGTH_SHORT).show()
            return
        }
        biometricBusy = true
        authenticateQuickUnlock(
            title = "开启快速解锁",
            subtitle = "确认后将使用系统凭据保护本地快速解锁凭据。",
            onAuthenticated = {
                appScope.launch {
                    runCatching {
                        withContext(Dispatchers.IO) {
                            val authenticatedCipher = biometricUnlockStore.createSetupCipher()
                            biometricUnlockStore.saveCredential(authenticatedCipher, vaultKey)
                        }
                    }.onSuccess {
                        biometricUnlockEnabled = true
                        Toast.makeText(context, "快速解锁已开启", Toast.LENGTH_SHORT).show()
                    }.onFailure { error ->
                        Toast.makeText(context, error.message ?: "Could not enable biometric unlock", Toast.LENGTH_SHORT).show()
                    }
                    biometricBusy = false
                }
            }
        )
    }

    fun disableBiometricUnlock() {
        biometricUnlockStore.disable()
        biometricUnlockEnabled = false
        Toast.makeText(context, "快速解锁已关闭", Toast.LENGTH_SHORT).show()
    }

    fun refreshQuickUnlockCredentialIfNeeded(previousVaultKey: ByteArray?, nextVaultKey: ByteArray) {
        if (!biometricUnlockEnabled || previousVaultKey?.contentEquals(nextVaultKey) == true) {
            return
        }
        biometricBusy = true
        authenticateQuickUnlock(
            title = "更新快速解锁",
            subtitle = "同步密钥已切换为远端权威源，请确认后更新本机快速解锁凭据。",
            onAuthenticated = {
                appScope.launch {
                    runCatching {
                        withContext(Dispatchers.IO) {
                            val authenticatedCipher = biometricUnlockStore.createSetupCipher()
                            biometricUnlockStore.saveCredential(authenticatedCipher, nextVaultKey)
                        }
                    }.onSuccess {
                        Toast.makeText(context, "快速解锁凭据已更新", Toast.LENGTH_SHORT).show()
                    }.onFailure { error ->
                        Toast.makeText(context, error.message ?: "快速解锁凭据更新失败，请重新开启快速解锁。", Toast.LENGTH_SHORT).show()
                    }
                    biometricBusy = false
                }
            },
            onError = { message ->
                Toast.makeText(context, message.ifBlank { "快速解锁凭据未更新，请重新开启快速解锁。" }, Toast.LENGTH_SHORT).show()
            }
        )
    }

    fun needsMasterPasswordForSync(result: WebDavSyncResult): Boolean {
        return result.status == "blocked"
    }

    fun formatWebDavResultMessage(result: WebDavSyncResult): String {
        return when (result.status) {
            "pushed" -> if (result.message.contains("主密码")) result.message else "同步完成，已推送本地最新数据。"
            "pulled" -> "同步完成，已拉取远端最新数据。"
            "synced", "noop" -> "同步完成，当前数据已经是最新。"
            "conflict" -> "检测到同步冲突，请前往设置页处理。"
            "blocked" -> result.message.ifBlank { "远端保管库需要主密码验证后才能继续同步。" }
            else -> result.message
        }
    }

    fun canUseFastWebDavSync(vaultKey: ByteArray?): Boolean {
        val metadata = webDavSyncService.loadMetadata()
        return vaultKey != null && metadata.remoteEtag.isNotBlank() && metadata.lastStatus != "blocked"
    }

    fun quickUnlockTitleForMessage(hasStrongBiometric: Boolean): String {
        return if (hasStrongBiometric) "生物识别解锁" else "系统凭证解锁"
    }

    fun userFacingMasterPasswordError(error: Throwable): String {
        val message = error.message.orEmpty()
        return when {
            error is AEADBadTagException -> "当前主密码错误"
            message.contains("Tag mismatch", ignoreCase = true) -> "当前主密码错误"
            message.contains("mac check", ignoreCase = true) -> "当前主密码错误"
            message.contains("unable to decrypt", ignoreCase = true) -> "当前主密码错误"
            message.contains("Could not unlock", ignoreCase = true) -> "当前主密码错误"
            else -> message.ifBlank { "主密码修改失败" }
        }
    }

    fun syncWebDavWithPassword(password: String) {
        val vault = state.vault
        if (vault == null) {
            homeErrorStatusMessage = "保管库未解锁。"
            return
        }
        appScope.launch {
            webDavBusy = true
            runCatching {
                withContext(Dispatchers.IO) {
                    val result = webDavSyncService.syncNow(password)
                    val vaultKey = result.vaultKey ?: repository.exportVaultKey(password)
                    val refreshedVault = if (result.vaultChanged) repository.unlockWithVaultKey(vaultKey) else vault
                    Triple(result, refreshedVault, vaultKey)
                }
            }.onSuccess { (result, refreshedVault, vaultKey) ->
                webDavMetadata = webDavSyncService.loadMetadata()
                val syncMessage = formatWebDavResultMessage(result)
                if (needsMasterPasswordForSync(result)) {
                    homeErrorStatusMessage = syncMessage
                    pendingBackupPasswordAction = BackupPasswordAction.WebDavSync
                    webDavBusy = false
                    return@onSuccess
                }
                val previousVaultKey = state.activeVaultKey
                state.updateUnlockedVault(refreshedVault, password, vaultKey)
                if (result.vaultKey != null) {
                    refreshQuickUnlockCredentialIfNeeded(previousVaultKey, vaultKey)
                }
                homeCopyStatusMessage = syncMessage
                homeErrorStatusMessage = ""
            }.onFailure { error ->
                webDavMetadata = webDavSyncService.loadMetadata()
                homeErrorStatusMessage = error.message ?: "同步失败，请稍后重试。"
            }
            webDavBusy = false
        }
    }

    fun syncWebDavAfterUnlock(vault: LocalVault, password: String?, vaultKey: ByteArray?) {
        val settings = webDavSyncService.loadSettings()
        if (hasSyncedAfterUnlock || !settings.enabled || !settings.isConfigured) {
            return
        }
        hasSyncedAfterUnlock = true
        appScope.launch {
            webDavBusy = true
            runCatching {
                withContext(Dispatchers.IO) {
                    val result = if (canUseFastWebDavSync(vaultKey)) {
                        webDavSyncService.syncNowWithVaultKey(vaultKey!!)
                    } else if (password != null) {
                        webDavSyncService.syncNow(password)
                    } else {
                        throw IllegalStateException("保管库未解锁。")
                    }
                    val nextVaultKey = result.vaultKey ?: vaultKey
                    val refreshedVault = if (result.vaultChanged) {
                        if (nextVaultKey != null) repository.unlockWithVaultKey(nextVaultKey) else repository.unlock(password!!)
                    } else null
                    Triple(result, refreshedVault, nextVaultKey)
                }
            }.onSuccess { (result, refreshedVault, nextVaultKey) ->
                webDavSettings = webDavSyncService.loadSettings()
                webDavMetadata = webDavSyncService.loadMetadata()
                val syncMessage = formatWebDavResultMessage(result)
                if (refreshedVault != null) {
                    if (password != null && nextVaultKey != null) {
                        val previousVaultKey = state.activeVaultKey
                        state.updateUnlockedVault(refreshedVault, password, nextVaultKey)
                        if (result.vaultKey != null) {
                            refreshQuickUnlockCredentialIfNeeded(previousVaultKey, nextVaultKey)
                        }
                    } else if (nextVaultKey != null) {
                        state.updateUnlockedVaultWithKey(refreshedVault, nextVaultKey)
                    }
                }
                if (needsMasterPasswordForSync(result)) {
                    homeErrorStatusMessage = syncMessage
                    pendingBackupPasswordAction = BackupPasswordAction.WebDavSync
                } else {
                    homeCopyStatusMessage = syncMessage
                    homeErrorStatusMessage = ""
                }
            }.onFailure { error ->
                webDavMetadata = webDavSyncService.loadMetadata()
                homeErrorStatusMessage = error.message ?: "同步失败，请稍后重试。"
            }
            webDavBusy = false
        }
    }

    fun startBiometricUnlock() {
        biometricBusy = false
        autoQuickUnlockAttempted = true
        if (!biometricUnlockEnabled) {
            errorMessage = "快速解锁未开启，请使用主密码。"
            return
        }
        biometricBusy = true
        authenticateQuickUnlock(
            title = "快速解锁",
            subtitle = "验证系统凭据后快速解锁本地保管库。",
            onAuthenticated = {
                appScope.launch {
                    runCatching {
                        withContext(Dispatchers.IO) {
                            val authenticatedCipher = biometricUnlockStore.createUnlockCipher()
                                ?: throw IllegalStateException("快速解锁凭据已失效，请使用主密码。")
                            val credential = biometricUnlockStore.readCredential(authenticatedCipher)
                            val vault = repository.unlockWithVaultKey(credential.vaultKey)
                            credential to vault
                        }
                    }.onSuccess { (credential, vault) ->
                        errorMessage = null
                        state.applyUnlockedVaultWithKey(vault, credential.vaultKey)
                        syncWebDavAfterUnlock(vault, password = null, vaultKey = credential.vaultKey)
                    }.onFailure { error ->
                        errorMessage = error.message ?: "快速解锁失败，请使用主密码。"
                    }
                    biometricBusy = false
                }
            },
            onError = { message ->
                errorMessage = message.ifBlank { "快速解锁已取消，请使用主密码。" }
            }
        )
    }

    fun syncWebDavAfterLocalChange(vault: LocalVault, password: String?, vaultKey: ByteArray?) {
        if (!webDavSyncService.loadSettings().enabled) {
            return
        }
        appScope.launch {
            webDavBusy = true
            runCatching {
                withContext(Dispatchers.IO) {
                    if (canUseFastWebDavSync(vaultKey)) {
                        webDavSyncService.syncLocalChangeWithVaultKey(vaultKey!!)
                    } else if (password != null) {
                        webDavSyncService.syncLocalChange(password)
                    } else {
                        throw IllegalStateException("保管库未解锁。")
                    }
                }
            }.onSuccess { result ->
                webDavMetadata = webDavSyncService.loadMetadata()
                val syncMessage = formatWebDavResultMessage(result)
                result.vaultKey?.let { nextVaultKey ->
                    val previousVaultKey = state.activeVaultKey
                    if (password != null) {
                        state.updateUnlockedVault(vault, password, nextVaultKey)
                        refreshQuickUnlockCredentialIfNeeded(previousVaultKey, nextVaultKey)
                    } else {
                        state.updateUnlockedVaultWithKey(vault, nextVaultKey)
                    }
                }
                if (needsMasterPasswordForSync(result)) {
                    homeErrorStatusMessage = syncMessage
                    pendingBackupPasswordAction = BackupPasswordAction.WebDavSync
                } else {
                    homeCopyStatusMessage = syncMessage
                    homeErrorStatusMessage = ""
                }
            }.onFailure { error ->
                webDavMetadata = webDavSyncService.loadMetadata()
                homeErrorStatusMessage = error.message ?: "同步失败，请稍后重试。"
            }
            webDavBusy = false
        }
    }

    fun isRemotePasswordError(message: String): Boolean {
        return message.contains("远端保管库") ||
            message.contains("远端密码库") ||
            message.contains("Master password is incorrect") ||
            message.contains("主密码")
    }

    fun homeSyncStatus(): String {
        if (webDavBusy) {
            return "同步中..."
        }
        if (!webDavSettings.enabled) {
            return "WebDAV 同步未开启，本地模式。"
        }
        if (webDavMetadata.lastStatus == "blocked" || isRemotePasswordError(webDavMetadata.lastError)) {
            return "远端保管库需要主密码验证后才能继续同步。"
        }
        return "本地与 WebDAV 已经是最新版本。"
    }

    fun lastSyncLabel(): String {
        val lastSyncedAt = webDavMetadata.lastSyncedAt
        if (lastSyncedAt <= 0L) {
            return "最新同步：暂无"
        }
        val formatted = SimpleDateFormat("MM-dd HH:mm", Locale.getDefault()).format(Date(lastSyncedAt))
        return "最新同步：$formatted"
    }

    fun syncWebDavFromHome() {
        val vault = state.vault
        val password = state.activePassword
        val vaultKey = state.activeVaultKey
        if (vault == null || (password == null && vaultKey == null)) {
            homeErrorStatusMessage = "保管库未解锁。"
            return
        }
        if (!webDavSettings.enabled) {
            homeCopyStatusMessage = "WebDAV 同步未开启，本地模式。"
            return
        }
        appScope.launch {
            webDavBusy = true
            runCatching {
                withContext(Dispatchers.IO) {
                    val result = if (canUseFastWebDavSync(vaultKey)) {
                        webDavSyncService.syncNowWithVaultKey(vaultKey!!)
                    } else if (password != null) {
                        webDavSyncService.syncNow(password)
                    } else {
                        throw IllegalStateException("保管库未解锁。")
                    }
                    val nextVaultKey = result.vaultKey ?: vaultKey
                    val refreshedVault = if (result.vaultChanged) {
                        if (nextVaultKey != null) repository.unlockWithVaultKey(nextVaultKey) else repository.unlock(password!!)
                    } else null
                    Triple(result, refreshedVault, nextVaultKey)
                }
            }.onSuccess { (result, refreshedVault, nextVaultKey) ->
                webDavMetadata = webDavSyncService.loadMetadata()
                val syncMessage = formatWebDavResultMessage(result)
                if (refreshedVault != null) {
                    if (password != null && nextVaultKey != null) {
                        val previousVaultKey = state.activeVaultKey
                        state.updateUnlockedVault(refreshedVault, password, nextVaultKey)
                        if (result.vaultKey != null) {
                            refreshQuickUnlockCredentialIfNeeded(previousVaultKey, nextVaultKey)
                        }
                    } else if (nextVaultKey != null) {
                        state.updateUnlockedVaultWithKey(refreshedVault, nextVaultKey)
                    }
                }
                if (needsMasterPasswordForSync(result)) {
                    homeErrorStatusMessage = syncMessage
                    pendingBackupPasswordAction = BackupPasswordAction.WebDavSync
                } else {
                    homeCopyStatusMessage = syncMessage
                    homeErrorStatusMessage = ""
                }
            }.onFailure { error ->
                webDavMetadata = webDavSyncService.loadMetadata()
                homeErrorStatusMessage = error.message ?: "同步失败，请稍后重试。"
            }
            webDavBusy = false
        }
    }

    fun saveAccount(account: TotpAccount, replaceExisting: Boolean) {
        val password = state.activePassword
        val vaultKey = state.activeVaultKey
        if (password == null && vaultKey == null) {
            showPersistenceError("Vault is not unlocked")
            return
        }

        appScope.launch {
            runCatching {
                withContext(Dispatchers.IO) {
                    val transform: (LocalVault) -> LocalVault = { vault ->
                        val accounts = if (replaceExisting) {
                            vault.accounts.map { existing ->
                                if (existing.id == account.id) account else existing
                            }
                        } else {
                            vault.accounts + account
                        }
                        vault.copy(accounts = accounts, updatedAt = account.updatedAt)
                    }
                    if (password != null) {
                        repository.update(password, transform)
                    } else {
                        repository.updateWithVaultKey(vaultKey!!, transform)
                    }
                }
            }.onSuccess { updatedVault ->
                hasExistingVault = true
                errorMessage = null
                if (password != null) {
                    state.applyUnlockedVault(updatedVault, password, vaultKey)
                } else {
                    state.applyUnlockedVaultWithKey(updatedVault, vaultKey!!)
                }
                state.navigate(TotpRoute.Home)
                syncWebDavAfterLocalChange(updatedVault, password, vaultKey)
            }.onFailure {
                showPersistenceError("Could not save vault")
            }
        }
    }

    fun deleteAccount(accountId: String) {
        val password = state.activePassword
        val vaultKey = state.activeVaultKey
        if (password == null && vaultKey == null) {
            showPersistenceError("Vault is not unlocked")
            return
        }

        appScope.launch {
            runCatching {
                withContext(Dispatchers.IO) {
                    val transform: (LocalVault) -> LocalVault = { vault ->
                        vault.copy(
                            accounts = vault.accounts.filterNot { it.id == accountId },
                            updatedAt = System.currentTimeMillis()
                        )
                    }
                    if (password != null) {
                        repository.update(password, transform)
                    } else {
                        repository.updateWithVaultKey(vaultKey!!, transform)
                    }
                }
            }.onSuccess { updatedVault ->
                hasExistingVault = true
                errorMessage = null
                if (password != null) {
                    state.applyUnlockedVault(updatedVault, password, vaultKey)
                } else {
                    state.applyUnlockedVaultWithKey(updatedVault, vaultKey!!)
                }
                state.navigate(TotpRoute.Home)
                syncWebDavAfterLocalChange(updatedVault, password, vaultKey)
            }.onFailure {
                showPersistenceError("Could not save vault")
            }
        }
    }

    if (pendingBackupPasswordAction != null) {
        BackupMasterPasswordDialog(
            action = pendingBackupPasswordAction!!,
            onDismiss = {
                pendingBackupPasswordAction = null
                pendingImportUri = null
                backupBusy = false
            },
            onConfirm = { password ->
                val action = pendingBackupPasswordAction
                val importUri = pendingImportUri
                pendingBackupPasswordAction = null
                pendingImportUri = null
                when (action) {
                    BackupPasswordAction.Export -> exportBackupWithPassword(password)
                    BackupPasswordAction.Import -> {
                        if (importUri != null) {
                            importBackupFromUri(importUri, password)
                        } else {
                            backupErrorMessage = "未选择导入文件。"
                        }
                    }
                    BackupPasswordAction.WebDavSync -> syncWebDavWithPassword(password)
                    null -> Unit
                }
            }
        )
    }

    if (passwordChangeDialogVisible) {
        BlockingProgressDialog(
            inProgress = passwordChangeInProgress,
            message = passwordChangeDialogMessage,
            isError = passwordChangeDialogIsError
        )
    }

    when (state.currentRoute) {
        TotpRoute.Unlock -> TotpMainScaffold(
            title = "解锁保管库",
            selectedDestination = null,
            onHome = { state.navigate(TotpRoute.Home) },
            onAdd = { state.navigate(TotpRoute.Add) },
            onSettings = { state.navigate(TotpRoute.Settings) }
        ) { padding ->
            LaunchedEffect(state.currentRoute, hasExistingVault, biometricUnlockEnabled, biometricUnlockAvailable, foregroundUnlockTick) {
                if (state.currentRoute == TotpRoute.Unlock && hasExistingVault && biometricUnlockEnabled && !autoQuickUnlockAttempted) {
                    delay(700)
                    refreshQuickUnlockAvailability()
                }
                if (state.currentRoute == TotpRoute.Unlock && hasExistingVault && biometricUnlockEnabled && biometricUnlockAvailable && !autoQuickUnlockAttempted && !biometricBusy) {
                    startBiometricUnlock()
                }
            }
            LaunchedEffect(biometricBusy, state.currentRoute) {
                if (biometricBusy && state.currentRoute == TotpRoute.Unlock) {
                    delay(15_000)
                    if (biometricBusy && state.currentRoute == TotpRoute.Unlock) {
                        biometricBusy = false
                        autoQuickUnlockAttempted = false
                    }
                }
            }
            UnlockScreen(
                hasExistingVault = hasExistingVault,
                errorMessage = errorMessage,
                isBusy = unlockBusy,
                biometricUnlockEnabled = hasExistingVault && biometricUnlockEnabled && biometricUnlockAvailable,
                isBiometricBusy = biometricBusy,
                modifier = Modifier.padding(padding),
                onCreatePassword = { password ->
                    appScope.launch {
                        unlockBusy = true
                        runCatching {
                            withContext(Dispatchers.IO) {
                                val vault = repository.create(password, now = System.currentTimeMillis())
                                val vaultKey = repository.exportVaultKey(password)
                                vault to vaultKey
                            }
                        }.onSuccess { (vault, vaultKey) ->
                            hasExistingVault = true
                            errorMessage = null
                            state.applyUnlockedVault(vault, password, vaultKey)
                            syncWebDavAfterUnlock(vault, password, vaultKey)
                        }.onFailure {
                            errorMessage = "Could not create vault"
                        }
                        unlockBusy = false
                    }
                },
                onBiometricUnlock = ::startBiometricUnlock,
                onUnlock = { password ->
                    appScope.launch {
                        unlockBusy = true
                        runCatching {
                            withContext(Dispatchers.IO) {
                                val vault = repository.unlock(password)
                                val vaultKey = repository.exportVaultKey(password)
                                vault to vaultKey
                            }
                        }.onSuccess { (vault, vaultKey) ->
                            errorMessage = null
                            state.applyUnlockedVault(vault, password, vaultKey)
                            syncWebDavAfterUnlock(vault, password, vaultKey)
                        }.onFailure {
                            errorMessage = "Could not unlock vault"
                        }
                        unlockBusy = false
                    }
                }
            )
        }

        TotpRoute.Home -> {
            val vault = state.vault
            if (vault == null) {
                MissingVaultEffect { state.lock() }
            } else {
                TotpMainScaffold(
                    title = "身份验证器",
                    selectedDestination = MainDestination.Home,
                    onHome = { state.navigate(TotpRoute.Home) },
                    onAdd = { state.navigate(TotpRoute.Add) },
                    onSettings = { state.navigate(TotpRoute.Settings) },
                    actions = {
                        HeaderCircleIconButton(
                            iconRes = R.drawable.action_sync,
                            contentDescription = "Sync",
                            spinning = webDavBusy,
                            onClick = ::syncWebDavFromHome
                        )
                    }
                ) { padding ->
                    HomeScreen(
                        vault = vault,
                        nowMillis = nowMillis,
                        syncStatusMessage = homeSyncStatus(),
                        copyStatusMessage = homeCopyStatusMessage,
                        errorMessage = homeErrorStatusMessage,
                        lastSyncLabel = lastSyncLabel(),
                        onAdd = { state.navigate(TotpRoute.Add) },
                        onEdit = { accountId -> state.navigate(TotpRoute.Edit(accountId)) },
                        onCopy = { code, account ->
                            val clipboard = context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
                            clipboard.setPrimaryClip(ClipData.newPlainText("TOTP code", code))
                            val label = account.issuer.ifBlank { "当前账号" }
                            homeCopyStatusMessage = "已复制 ${label} 的验证码到系统剪贴板。"
                        },
                        modifier = Modifier.padding(padding)
                    )
                }
            }
        }

        TotpRoute.Add -> TotpMainScaffold(
            title = "添加账号",
            selectedDestination = MainDestination.Add,
            onHome = { state.navigate(TotpRoute.Home) },
            onAdd = { state.navigate(TotpRoute.Add) },
            onSettings = { state.navigate(TotpRoute.Settings) },
            actions = {
                HeaderCircleIconButton(
                    iconRes = R.drawable.action_photo,
                    contentDescription = "Import QR image",
                    onClick = ::startQrImageImport
                )
                Spacer(modifier = Modifier.width(8.dp))
                HeaderCircleIconButton(
                    iconRes = R.drawable.action_scan,
                    contentDescription = "Scan QR code",
                    onClick = ::startQrScan
                )
            }
        ) { padding ->
            AccountEditorScreen(
                title = "添加账号",
                existingAccount = null,
                onSave = { account -> saveAccount(account, replaceExisting = false) },
                onDelete = null,
                modifier = Modifier.padding(padding),
                showTitle = false,
                importedOtpAuthUri = importedOtpAuthUri,
                onImportedOtpAuthUriConsumed = { importedOtpAuthUri = null }
            )
        }

        is TotpRoute.Edit -> {
            val route = state.currentRoute as TotpRoute.Edit
            val account = state.vault?.accounts?.firstOrNull { it.id == route.accountId }
            if (account == null) {
                MissingAccountEffect(route.accountId) {
                    Toast.makeText(context, "Account not found", Toast.LENGTH_SHORT).show()
                    state.navigate(TotpRoute.Home)
                }
            } else {
                TotpMainScaffold(
                    title = "编辑账号",
                    selectedDestination = null,
                    onHome = { state.navigate(TotpRoute.Home) },
                    onAdd = { state.navigate(TotpRoute.Add) },
                    onSettings = { state.navigate(TotpRoute.Settings) },
                    onBack = { state.navigate(TotpRoute.Home) }
                ) { padding ->
                    AccountEditorScreen(
                        title = "编辑账号",
                        existingAccount = account,
                        onSave = { updatedAccount -> saveAccount(updatedAccount, replaceExisting = true) },
                        onDelete = { accountId -> deleteAccount(accountId) },
                        modifier = Modifier.padding(padding),
                        showTitle = false
                    )
                }
            }
        }

        TotpRoute.Scan -> TotpMainScaffold(
            title = "Scan QR code",
            selectedDestination = null,
            onHome = { state.navigate(TotpRoute.Home) },
            onAdd = { state.navigate(TotpRoute.Add) },
            onSettings = { state.navigate(TotpRoute.Settings) },
            onBack = { state.navigate(TotpRoute.Add) }
        ) { padding ->
            QrScannerScreen(
                modifier = Modifier.padding(padding),
                onQrCode = { rawValue ->
                    if (rawValue.startsWith("otpauth://totp/", ignoreCase = true)) {
                        acceptImportedOtpAuthUri(rawValue)
                    } else {
                        Log.w("TotpQrImport", "Scanned QR code is not an otpauth URI")
                        Toast.makeText(context, "QR code is not an otpauth URI", Toast.LENGTH_SHORT).show()
                    }
                }
            )
        }

        TotpRoute.Settings -> TotpMainScaffold(
            title = "设置",
            selectedDestination = MainDestination.Settings,
            onHome = { state.navigate(TotpRoute.Home) },
            onAdd = { state.navigate(TotpRoute.Add) },
            onSettings = { state.navigate(TotpRoute.Settings) }
        ) { padding ->
            SettingsScreen(
                accountCount = state.vault?.accounts?.size ?: 0,
                biometricUnlockEnabled = biometricUnlockEnabled,
                biometricUnlockAvailable = biometricUnlockAvailable,
                quickUnlockSetupRequired = quickUnlockAvailability == QuickUnlockAvailability.NeedsSystemCredential,
                quickUnlockTitle = if (hasStrongBiometric) "生物识别解锁" else "系统凭证解锁",
                isBiometricBusy = biometricBusy,
                webDavSettings = webDavSettings,
                webDavMetadata = webDavMetadata,
                isWebDavBusy = webDavBusy,
                webDavStatusMessage = webDavStatusMessage,
                webDavStatusIsError = webDavStatusIsError,
                isPasswordChangeBusy = passwordChangeDialogVisible,
                masterPasswordErrorMessage = masterPasswordErrorMessage,
                backupStatusMessage = backupStatusMessage,
                backupErrorMessage = backupErrorMessage,
                isBackupBusy = backupBusy,
                onSaveWebDavSettings = { settings ->
                    appScope.launch {
                        webDavBusy = true
                        runCatching {
                            withContext(Dispatchers.IO) {
                                val saved = webDavSyncService.saveSettings(settings)
                                val vault = state.vault
                                val password = state.activePassword
                                val vaultKey = state.activeVaultKey
                                val syncResult = if (saved.enabled && vault != null && (password != null || vaultKey != null)) {
                                    if (password != null) {
                                        webDavSyncService.syncNow(password)
                                    } else if (canUseFastWebDavSync(vaultKey)) {
                                        webDavSyncService.syncNowWithVaultKey(vaultKey!!)
                                    } else {
                                        webDavSyncService.syncNowWithVaultKey(vaultKey!!)
                                    }
                                } else {
                                    null
                                }
                                val nextVaultKey = syncResult?.vaultKey ?: vaultKey
                                val refreshedVault = if (syncResult?.vaultChanged == true) {
                                    if (nextVaultKey != null) repository.unlockWithVaultKey(nextVaultKey) else repository.unlock(password!!)
                                } else {
                                    null
                                }
                                Quad(saved, syncResult, refreshedVault, nextVaultKey)
                            }
                        }.onSuccess { (saved, syncResult, refreshedVault, nextVaultKey) ->
                            webDavSettings = saved
                            webDavMetadata = webDavSyncService.loadMetadata()
                            val password = state.activePassword
                            if (refreshedVault != null) {
                                if (password != null && nextVaultKey != null) {
                                    val previousVaultKey = state.activeVaultKey
                                    state.updateUnlockedVault(refreshedVault, password, nextVaultKey)
                                    if (syncResult?.vaultKey != null) {
                                        refreshQuickUnlockCredentialIfNeeded(previousVaultKey, nextVaultKey)
                                    }
                                } else if (nextVaultKey != null) {
                                    state.updateUnlockedVaultWithKey(refreshedVault, nextVaultKey)
                                }
                            }
                            if (syncResult != null) {
                                val syncMessage = formatWebDavResultMessage(syncResult)
                                if (needsMasterPasswordForSync(syncResult)) {
                                    homeErrorStatusMessage = syncMessage
                                    webDavStatusMessage = syncMessage
                                    webDavStatusIsError = true
                                    pendingBackupPasswordAction = BackupPasswordAction.WebDavSync
                                } else {
                                    homeCopyStatusMessage = syncMessage
                                    webDavStatusMessage = syncMessage
                                    webDavStatusIsError = false
                                }
                            } else {
                                homeCopyStatusMessage = if (saved.enabled) "WebDAV 设置已保存" else ""
                                homeErrorStatusMessage = ""
                                webDavStatusMessage = if (saved.enabled) "WebDAV 设置已保存" else ""
                                webDavStatusIsError = false
                            }
                        }.onFailure { error ->
                            val message = error.message ?: "无法保存 WebDAV 设置"
                            homeErrorStatusMessage = message
                            webDavStatusMessage = message
                            webDavStatusIsError = true
                        }
                        webDavBusy = false
                    }
                },
                onTestWebDav = { settings ->
                    appScope.launch {
                        webDavBusy = true
                        runCatching {
                            withContext(Dispatchers.IO) {
                                webDavSyncService.testConnection(settings)
                            }
                        }.onSuccess {
                            homeCopyStatusMessage = "WebDAV 连接正常"
                            webDavStatusMessage = "WebDAV 连接正常"
                            webDavStatusIsError = false
                        }.onFailure { error ->
                            val message = error.message ?: "WebDAV 测试失败"
                            homeErrorStatusMessage = message
                            webDavStatusMessage = message
                            webDavStatusIsError = true
                        }
                        webDavBusy = false
                    }
                },
                onSyncWebDav = {
                    val vault = state.vault
                    val password = state.activePassword
                    val vaultKey = state.activeVaultKey
                    if (vault == null || (password == null && vaultKey == null)) {
                        homeErrorStatusMessage = "保管库未解锁"
                        webDavStatusMessage = "保管库未解锁"
                        webDavStatusIsError = true
                        return@SettingsScreen
                    }
                    appScope.launch {
                        webDavBusy = true
                        runCatching {
                            withContext(Dispatchers.IO) {
                                val result = if (canUseFastWebDavSync(vaultKey)) {
                                    webDavSyncService.syncNowWithVaultKey(vaultKey!!)
                                } else if (password != null) {
                                    webDavSyncService.syncNow(password)
                                } else {
                                    webDavSyncService.syncNowWithVaultKey(vaultKey!!)
                                }
                                val nextVaultKey = result.vaultKey ?: vaultKey
                                val refreshedVault = if (result.vaultChanged) {
                                    if (nextVaultKey != null) repository.unlockWithVaultKey(nextVaultKey) else repository.unlock(password!!)
                                } else {
                                    null
                                }
                                Triple(result, refreshedVault, nextVaultKey)
                            }
                        }.onSuccess { (result, refreshedVault, nextVaultKey) ->
                            webDavMetadata = webDavSyncService.loadMetadata()
                            val syncMessage = formatWebDavResultMessage(result)
                            if (refreshedVault != null) {
                                if (password != null && nextVaultKey != null) {
                                    val previousVaultKey = state.activeVaultKey
                                    state.updateUnlockedVault(refreshedVault, password, nextVaultKey)
                                    if (result.vaultKey != null) {
                                        refreshQuickUnlockCredentialIfNeeded(previousVaultKey, nextVaultKey)
                                    }
                                } else if (nextVaultKey != null) {
                                    state.updateUnlockedVaultWithKey(refreshedVault, nextVaultKey)
                                }
                            }
                            if (needsMasterPasswordForSync(result)) {
                                homeErrorStatusMessage = syncMessage
                                webDavStatusMessage = syncMessage
                                webDavStatusIsError = true
                                pendingBackupPasswordAction = BackupPasswordAction.WebDavSync
                            } else {
                                homeCopyStatusMessage = syncMessage
                                webDavStatusMessage = syncMessage
                                webDavStatusIsError = false
                            }
                        }.onFailure { error ->
                            webDavMetadata = webDavSyncService.loadMetadata()
                            val message = error.message ?: "WebDAV 同步失败"
                            homeErrorStatusMessage = message
                            webDavStatusMessage = message
                            webDavStatusIsError = true
                        }
                        webDavBusy = false
                    }
                },
                onBiometricUnlockChanged = { enabled ->
                    refreshQuickUnlockAvailability()
                    val vaultKey = state.activeVaultKey
                    if (enabled) {
                        if (vaultKey == null) {
                            Toast.makeText(context, "保管库未解锁", Toast.LENGTH_SHORT).show()
                        } else {
                            enableBiometricUnlock(vaultKey)
                        }
                    } else {
                        disableBiometricUnlock()
                    }
                },
                onChangeMasterPassword = { currentPassword, nextPassword ->
                    appScope.launch {
                        passwordChangeDialogVisible = true
                        passwordChangeInProgress = true
                        passwordChangeDialogMessage = "正在更新主密码..."
                        passwordChangeDialogIsError = false
                        masterPasswordErrorMessage = ""
                        val shouldSyncPasswordChange = webDavSyncService.loadSettings().enabled
                        if (shouldSyncPasswordChange) {
                            webDavBusy = true
                        }
                        runCatching {
                            withContext(Dispatchers.IO) {
                                val currentWebDavSettings = webDavSyncService.loadSettings()
                                val currentWebDavMetadata = webDavSyncService.loadMetadata()
                                if (currentWebDavSettings.enabled && currentWebDavMetadata.lastStatus == "blocked") {
                                    throw IllegalStateException("远端保管库需要主密码验证后才能继续同步，请先验证远端主密码。")
                                }
                                val currentVault = state.vault ?: repository.unlock(currentPassword)
                                val syncResult = if (currentWebDavSettings.enabled) {
                                    webDavSyncService.syncPasswordChange(currentPassword, nextPassword)
                                } else {
                                    repository.changePassword(currentPassword, nextPassword)
                                    null
                                }
                                if (syncResult?.status == "conflict" || syncResult?.status == "blocked") {
                                    throw IllegalStateException(syncResult.message)
                                }
                                val vaultKey = syncResult?.vaultKey ?: repository.exportVaultKey(nextPassword)
                                val vault = repository.unlockWithVaultKey(vaultKey)
                                Triple(vault, syncResult, vaultKey)
                            }
                        }.onSuccess { (vault, syncResult, vaultKey) ->
                            state.updateUnlockedVault(vault, nextPassword, vaultKey)
                            webDavMetadata = webDavSyncService.loadMetadata()
                            biometricUnlockStore.disable()
                            biometricUnlockEnabled = false
                            passwordChangeInProgress = false
                            passwordChangeDialogMessage = "主密码已修改，${quickUnlockTitleForMessage(hasStrongBiometric)}需要重新开启。"
                            passwordChangeDialogIsError = false
                            delay(1_600)
                            passwordChangeDialogVisible = false
                        }.onFailure { error ->
                            masterPasswordErrorMessage = ""
                            passwordChangeInProgress = false
                            passwordChangeDialogMessage = userFacingMasterPasswordError(error)
                            passwordChangeDialogIsError = true
                            delay(1_600)
                            passwordChangeDialogVisible = false
                        }
                        if (shouldSyncPasswordChange) {
                            webDavBusy = false
                        }
                    }
                },
                onExportBackup = ::startBackupExport,
                onImportBackup = ::startBackupImport,
                modifier = Modifier.padding(padding)
            )
        }
    }
}

@Composable
private fun BackupMasterPasswordDialog(
    action: BackupPasswordAction,
    onDismiss: () -> Unit,
    onConfirm: (String) -> Unit
) {
    var password by remember { mutableStateOf("") }
    var passwordVisible by remember { mutableStateOf(false) }
    val title = when (action) {
        BackupPasswordAction.Export -> "导出备份"
        BackupPasswordAction.Import -> "导入备份"
        BackupPasswordAction.WebDavSync -> "验证远端密码库"
    }
    val primaryText = when (action) {
        BackupPasswordAction.WebDavSync -> "验证"
        else -> "继续"
    }
    val secondaryText = when (action) {
        BackupPasswordAction.WebDavSync -> "稍后处理"
        else -> "取消"
    }
    val passwordLabel = when (action) {
        BackupPasswordAction.WebDavSync -> "远端主密码"
        else -> "主密码"
    }
    val message = when (action) {
        BackupPasswordAction.WebDavSync -> "远端主密码已变化，请输入新的远端主密码后继续同步。"
        else -> "请输入主密码以继续。"
    }
    val hint = when (action) {
        BackupPasswordAction.WebDavSync -> "验证通过后，本地保管库和当前解锁密码会同步更新为远端密码。"
        else -> ""
    }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(title) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Text(message)
                if (hint.isNotBlank()) {
                    Text(hint)
                }
                OutlinedTextField(
                    value = password,
                    onValueChange = { password = it },
                    modifier = Modifier.fillMaxWidth(),
                    label = { Text(passwordLabel) },
                    visualTransformation = if (passwordVisible) VisualTransformation.None else PasswordVisualTransformation(),
                    trailingIcon = {
                        PasswordVisibilityIcon(
                            visible = passwordVisible,
                            onToggle = { passwordVisible = !passwordVisible }
                        )
                    },
                    singleLine = true
                )
            }
        },
        confirmButton = {
            TextButton(
                enabled = password.isNotBlank(),
                onClick = { onConfirm(password) }
            ) {
                Text(primaryText)
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text(secondaryText)
            }
        }
    )
}

@Composable
private fun BlockingProgressDialog(
    inProgress: Boolean,
    message: String,
    isError: Boolean
) {
    Dialog(onDismissRequest = { }) {
        Surface(
            shape = androidx.compose.material3.MaterialTheme.shapes.extraLarge,
            tonalElevation = 6.dp
        ) {
            Column(
                modifier = Modifier.padding(horizontal = 28.dp, vertical = 24.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(14.dp)
            ) {
                if (inProgress) {
                    CircularProgressIndicator()
                }
                Text(
                    text = message,
                    color = if (isError) MaterialTheme.colorScheme.error else Color.Unspecified
                )
            }
        }
    }
}

@Composable
private fun MissingVaultEffect(onMissingVault: () -> Unit) {
    LaunchedEffect(Unit) {
        onMissingVault()
    }
}

@Composable
private fun MissingAccountEffect(accountId: String, onMissingAccount: () -> Unit) {
    LaunchedEffect(accountId) {
        onMissingAccount()
    }
}

private suspend fun VaultRepository.create(password: String, now: Long): LocalVault {
    val vault = LocalVault(
        schemaVersion = 1,
        accounts = emptyList(),
        updatedAt = now
    )
    create(vault, password)
    return vault
}

private enum class BackupPasswordAction {
    Export,
    Import,
    WebDavSync
}

private data class Quad<A, B, C, D>(
    val first: A,
    val second: B,
    val third: C,
    val fourth: D
)
