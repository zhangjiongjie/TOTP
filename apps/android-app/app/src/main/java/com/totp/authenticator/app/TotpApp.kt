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

@Composable
fun TotpApp() {
    val activityContext = LocalContext.current
    val lifecycleOwner = LocalLifecycleOwner.current
    val context = activityContext.applicationContext
    val repository = remember { VaultRepository(context) }
    val qrImportService = remember(context) { QrImportService(context.applicationContext) }
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
    val webDavFlowCoordinator = remember { WebDavFlowCoordinator(repository, webDavSyncService) }
    val backupFlowCoordinator = remember { BackupFlowCoordinator(repository, backupService) }
    val quickUnlockCoordinator = remember { QuickUnlockCoordinator(biometricUnlockStore, repository) }
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
    val syncState: SyncViewModel = viewModel(
        key = "sync",
        factory = object : ViewModelProvider.Factory {
            @Suppress("UNCHECKED_CAST")
            override fun <T : ViewModel> create(modelClass: Class<T>): T {
                return SyncViewModel(
                    initialSettings = webDavSyncService.loadSettings(),
                    initialMetadata = webDavSyncService.loadMetadata()
                ) as T
            }
        }
    )
    val backupState: BackupViewModel = viewModel(key = "backup")
    val settingsState: SettingsViewModel = viewModel(key = "settings")
    val passwordChangeState: PasswordChangeViewModel = viewModel(key = "passwordChange")
    val unlockState: UnlockViewModel = viewModel(key = "unlock")
    val quickUnlockState: QuickUnlockViewModel = viewModel(
        key = "quickUnlock",
        factory = object : ViewModelProvider.Factory {
            @Suppress("UNCHECKED_CAST")
            override fun <T : ViewModel> create(modelClass: Class<T>): T {
                return QuickUnlockViewModel(quickUnlockCoordinator.availability()) as T
            }
        }
    )
    var nowMillis by remember { mutableStateOf(System.currentTimeMillis()) }
    var importedOtpAuthUri by remember { mutableStateOf<String?>(null) }
    var foregroundUnlockTick by remember { mutableStateOf(0) }
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
                        quickUnlockState.resetUnlockAttempt()
                    }
                }
                Lifecycle.Event.ON_RESUME -> {
                    if (state.currentRoute == TotpRoute.Unlock) {
                        quickUnlockState.resetUnlockAttempt()
                    }
                    foregroundUnlockTick += 1
                }
                Lifecycle.Event.ON_STOP -> {
                    if (state.currentRoute == TotpRoute.Unlock) {
                        quickUnlockState.resetUnlockAttempt()
                    }
                    if (state.isUnlocked && !isConfigurationChange && !documentPickerActive) {
                        webDavSyncService.clearCryptoCache()
                        quickUnlockState.resetUnlockAttempt()
                        syncState.resetSyncedAfterUnlock()
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
        quickUnlockState.refresh(quickUnlockCoordinator.availability())
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
                backupState.showSuccess("已导出 ${state.vault?.accounts?.size ?: 0} 个账号。")
            },
            onFailure = { error ->
                backupState.showError(error.message ?: "导出备份失败，请稍后重试。")
            }
        )
    }

    val exportBackupWithPassword: (String) -> Unit = exportBackupWithPassword@{ password ->
        val vault = state.vault
        if (vault == null) {
            backupState.showError("保管库未解锁。")
            return@exportBackupWithPassword
        }
        backupState.launchTask(
            finishBusyOnSuccess = false,
            task = {
                withContext(Dispatchers.IO) {
                    backupFlowCoordinator.createExportWithPassword(vault, password)
                }
            },
            onSuccess = { payload ->
                pendingExportContent = payload.content
                documentPickerActive = true
                backupExportLauncher.launch(payload.filename)
            },
            onFailure = { error ->
                backupState.showError(error.message ?: "导出备份失败，请稍后重试。")
            }
        )
    }

    val exportBackupWithVaultKey: (ByteArray) -> Unit = exportBackupWithVaultKey@{ vaultKey ->
        val vault = state.vault
        if (vault == null) {
            backupState.showError("保管库未解锁。")
            return@exportBackupWithVaultKey
        }
        backupState.launchTask(
            finishBusyOnSuccess = false,
            task = {
                withContext(Dispatchers.IO) {
                    backupFlowCoordinator.createExportWithVaultKey(vault, vaultKey)
                }
            },
            onSuccess = { payload ->
                pendingExportContent = payload.content
                documentPickerActive = true
                backupExportLauncher.launch(payload.filename)
            },
            onFailure = { error ->
                backupState.showError(error.message ?: "导出备份失败，请稍后重试。")
            }
        )
    }

    lateinit var importBackupFromUri: (Uri, String) -> Unit

    val backupImportLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.OpenDocument()
    ) { uri ->
        documentPickerActive = false
        if (uri == null) {
            backupState.updateBusy(false)
            return@rememberLauncherForActivityResult
        }
        val password = state.activePassword
        if (password == null) {
            pendingImportUri = uri
            pendingBackupPasswordAction = BackupPasswordAction.Import
            backupState.updateBusy(false)
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
            quickUnlockState.resetUnlockAttempt()
        }
    }

    LaunchedEffect(syncState.homeCopyStatusMessage, syncState.homeErrorStatusMessage) {
        if (syncState.homeCopyStatusMessage.isBlank() && syncState.homeErrorStatusMessage.isBlank()) {
            return@LaunchedEffect
        }
        delay(2_000)
        syncState.clearHomeMessages()
    }

    LaunchedEffect(syncState.webDavStatusMessage) {
        if (syncState.webDavStatusMessage.isBlank()) {
            return@LaunchedEffect
        }
        delay(2_000)
        syncState.clearSettingsMessage()
    }

    fun showPersistenceError(message: String) {
        unlockState.showError(message)
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
            backupState.showError("保管库未解锁。")
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
            backupState.showError("保管库未解锁。")
            return
        }
        backupState.updateBusy(true)
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
            quickUnlockState.updateBusy(false)
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
                    quickUnlockState.updateBusy(false)
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
            quickUnlockState.updateBusy(false)
            onError(error.message ?: "无法启动系统凭据验证")
        }
    }

    val enableBiometricUnlock: (ByteArray) -> Unit = enableBiometricUnlock@{ vaultKey ->
        refreshQuickUnlockAvailability()
        if (quickUnlockState.setupRequired) {
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
            return@enableBiometricUnlock
        }
        if (!quickUnlockState.available) {
            Toast.makeText(context, "当前设备不支持快速解锁", Toast.LENGTH_SHORT).show()
            return@enableBiometricUnlock
        }
        quickUnlockState.updateBusy(true)
        authenticateQuickUnlock(
            title = "开启快速解锁",
            subtitle = "确认后将使用系统凭据保护本地快速解锁凭据。",
            onAuthenticated = {
                quickUnlockState.launchCredentialTask(
                    task = {
                        withContext(Dispatchers.IO) {
                            val authenticatedCipher = quickUnlockCoordinator.createSetupCipher()
                            quickUnlockCoordinator.saveCredential(authenticatedCipher, vaultKey)
                        }
                    },
                    onSuccess = {
                        quickUnlockState.updateEnabled(true)
                        Toast.makeText(context, "快速解锁已开启", Toast.LENGTH_SHORT).show()
                    },
                    onFailure = { error ->
                        Toast.makeText(context, error.message ?: "Could not enable biometric unlock", Toast.LENGTH_SHORT).show()
                    }
                )
            }
        )
    }

    val disableBiometricUnlock: () -> Unit = {
        quickUnlockCoordinator.disable()
        quickUnlockState.updateEnabled(false)
        Toast.makeText(context, "快速解锁已关闭", Toast.LENGTH_SHORT).show()
    }

    val refreshQuickUnlockCredentialIfNeeded: (ByteArray?, ByteArray) -> Unit = refreshQuickUnlockCredentialIfNeeded@{ previousVaultKey, nextVaultKey ->
        if (!quickUnlockCoordinator.shouldRefreshCredential(quickUnlockState.enabled, previousVaultKey, nextVaultKey)) {
            return@refreshQuickUnlockCredentialIfNeeded
        }
        quickUnlockState.updateBusy(true)
        authenticateQuickUnlock(
            title = "更新快速解锁",
            subtitle = "同步密钥已切换为远端权威源，请确认后更新本机快速解锁凭据。",
            onAuthenticated = {
                quickUnlockState.launchCredentialTask(
                    task = {
                        withContext(Dispatchers.IO) {
                            val authenticatedCipher = quickUnlockCoordinator.createSetupCipher()
                            quickUnlockCoordinator.saveCredential(authenticatedCipher, nextVaultKey)
                        }
                    },
                    onSuccess = {
                        Toast.makeText(context, "快速解锁凭据已更新", Toast.LENGTH_SHORT).show()
                    },
                    onFailure = { error ->
                        Toast.makeText(context, error.message ?: "快速解锁凭据更新失败，请重新开启快速解锁。", Toast.LENGTH_SHORT).show()
                    }
                )
            },
            onError = { message ->
                Toast.makeText(context, message.ifBlank { "快速解锁凭据未更新，请重新开启快速解锁。" }, Toast.LENGTH_SHORT).show()
            }
        )
    }

    fun needsMasterPasswordForSync(result: WebDavSyncResult): Boolean {
        return webDavFlowCoordinator.needsMasterPassword(result)
    }

    fun formatWebDavResultMessage(result: WebDavSyncResult): String {
        return webDavFlowCoordinator.formatResultMessage(result)
    }

    fun canUseFastWebDavSync(vaultKey: ByteArray?): Boolean {
        return webDavFlowCoordinator.canUseFastSync(vaultKey)
    }

    fun quickUnlockTitleForMessage(hasStrongBiometric: Boolean): String {
        return if (hasStrongBiometric) "生物识别解锁" else "系统凭证解锁"
    }

    val syncWebDavWithPassword: (String) -> Unit = syncWebDavWithPassword@{ password ->
        val vault = state.vault
        if (vault == null) {
            syncState.showHomeError("保管库未解锁。")
            return@syncWebDavWithPassword
        }
        syncState.launchExclusiveSyncTask(
            task = {
                withContext(Dispatchers.IO) {
                    webDavFlowCoordinator.syncWithPassword(vault, password)
                }
            },
            onSuccess = { flowResult ->
                syncState.updateMetadata(flowResult.metadata)
                val syncMessage = formatWebDavResultMessage(flowResult.syncResult)
                if (needsMasterPasswordForSync(flowResult.syncResult)) {
                    syncState.showHomeError(syncMessage)
                    pendingBackupPasswordAction = BackupPasswordAction.WebDavSync
                } else {
                    val previousVaultKey = state.activeVaultKey
                    state.updateUnlockedVault(flowResult.refreshedVault ?: vault, password, flowResult.vaultKey)
                    if (flowResult.syncResult.vaultKey != null && flowResult.vaultKey != null) {
                        refreshQuickUnlockCredentialIfNeeded(previousVaultKey, flowResult.vaultKey)
                    }
                    syncState.showHomeCopy(syncMessage)
                }
            },
            onFailure = { error ->
                syncState.updateMetadata(webDavSyncService.loadMetadata())
                syncState.showHomeError(error.message ?: "同步失败，请稍后重试。")
            }
        )
    }

    val syncWebDavAfterUnlock: (LocalVault, String?, ByteArray?) -> Unit = syncWebDavAfterUnlock@{ _, password, vaultKey ->
        val settings = webDavSyncService.loadSettings()
        if (syncState.hasSyncedAfterUnlock || !settings.enabled || !settings.isConfigured) {
            return@syncWebDavAfterUnlock
        }
        syncState.markSyncedAfterUnlock()
        syncState.launchExclusiveSyncTask(
            task = {
                withContext(Dispatchers.IO) {
                    webDavFlowCoordinator.syncUnlocked(password, vaultKey)
                }
            },
            onSuccess = { flowResult ->
                syncState.updateSettings(flowResult.settings)
                syncState.updateMetadata(flowResult.metadata)
                val syncMessage = formatWebDavResultMessage(flowResult.syncResult)
                if (flowResult.refreshedVault != null) {
                    if (password != null && flowResult.vaultKey != null) {
                        val previousVaultKey = state.activeVaultKey
                        state.updateUnlockedVault(flowResult.refreshedVault, password, flowResult.vaultKey)
                        if (flowResult.syncResult.vaultKey != null) {
                            refreshQuickUnlockCredentialIfNeeded(previousVaultKey, flowResult.vaultKey)
                        }
                    } else if (flowResult.vaultKey != null) {
                        state.updateUnlockedVaultWithKey(flowResult.refreshedVault, flowResult.vaultKey)
                    }
                }
                if (needsMasterPasswordForSync(flowResult.syncResult)) {
                    syncState.showHomeError(syncMessage)
                    pendingBackupPasswordAction = BackupPasswordAction.WebDavSync
                } else {
                    syncState.showHomeCopy(syncMessage)
                }
            },
            onFailure = { error ->
                syncState.updateMetadata(webDavSyncService.loadMetadata())
                syncState.showHomeError(error.message ?: "同步失败，请稍后重试。")
            }
        )
    }

    val startBiometricUnlock: () -> Unit = startBiometricUnlock@{
        quickUnlockState.updateBusy(false)
        quickUnlockState.markAutoAttempted()
        if (!quickUnlockState.enabled) {
            unlockState.showError("快速解锁未开启，请使用主密码。")
            return@startBiometricUnlock
        }
        quickUnlockState.updateBusy(true)
        authenticateQuickUnlock(
            title = "快速解锁",
            subtitle = "验证系统凭据后快速解锁本地保管库。",
            onAuthenticated = {
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
                        state.applyUnlockedVaultWithKey(result.vault, result.vaultKey)
                        syncWebDavAfterUnlock(result.vault, null, result.vaultKey)
                    },
                    onFailure = { error ->
                        unlockState.showError(error.message ?: "快速解锁失败，请使用主密码。")
                    }
                )
            },
            onError = { message ->
                unlockState.showError(message.ifBlank { "快速解锁已取消，请使用主密码。" })
            }
        )
    }

    val syncWebDavAfterLocalChange: (LocalVault, String?, ByteArray?) -> Unit = syncWebDavAfterLocalChange@{ vault, password, vaultKey ->
        if (!webDavSyncService.loadSettings().enabled) {
            return@syncWebDavAfterLocalChange
        }
        syncState.launchExclusiveSyncTask(
            task = {
                withContext(Dispatchers.IO) {
                    webDavFlowCoordinator.syncUnlocked(password, vaultKey, localChange = true)
                }
            },
            onSuccess = { flowResult ->
                syncState.updateMetadata(flowResult.metadata)
                val syncMessage = formatWebDavResultMessage(flowResult.syncResult)
                flowResult.syncResult.vaultKey?.let { nextVaultKey ->
                    val previousVaultKey = state.activeVaultKey
                    if (password != null) {
                        state.updateUnlockedVault(vault, password, nextVaultKey)
                        refreshQuickUnlockCredentialIfNeeded(previousVaultKey, nextVaultKey)
                    } else {
                        state.updateUnlockedVaultWithKey(vault, nextVaultKey)
                    }
                }
                if (needsMasterPasswordForSync(flowResult.syncResult)) {
                    syncState.showHomeError(syncMessage)
                    pendingBackupPasswordAction = BackupPasswordAction.WebDavSync
                } else {
                    syncState.showHomeCopy(syncMessage)
                }
            },
            onFailure = { error ->
                syncState.updateMetadata(webDavSyncService.loadMetadata())
                syncState.showHomeError(error.message ?: "同步失败，请稍后重试。")
            }
        )
    }

    importBackupFromUri = { uri, password ->
        backupState.launchTask(
            task = {
                withContext(Dispatchers.IO) {
                    backupFlowCoordinator.importBackup(readTextFromUri(uri), password)
                }
            },
            onSuccess = { result ->
                state.updateUnlockedVault(result.vault, password, result.vaultKey)
                backupState.showSuccess("已导入 ${result.vault.accounts.size} 个账号。")
                syncWebDavAfterLocalChange(result.vault, password, result.vaultKey)
            },
            onFailure = { error ->
                backupState.showError(error.message ?: "导入备份失败，请稍后重试。")
            }
        )
    }

    fun isRemotePasswordError(message: String): Boolean {
        return message.contains("远端保管库") ||
            message.contains("远端密码库") ||
            message.contains("Master password is incorrect") ||
            message.contains("主密码")
    }

    fun homeSyncStatus(): String {
        if (syncState.isBusy) {
            return "同步中..."
        }
        if (!syncState.webDavSettings.enabled) {
            return "WebDAV 同步未开启，本地模式。"
        }
        if (syncState.webDavMetadata.lastStatus == "blocked" || isRemotePasswordError(syncState.webDavMetadata.lastError)) {
            return "远端保管库需要主密码验证后才能继续同步。"
        }
        return "本地与 WebDAV 已经是最新版本。"
    }

    fun lastSyncLabel(): String {
        val lastSyncedAt = syncState.webDavMetadata.lastSyncedAt
        if (lastSyncedAt <= 0L) {
            return "最新同步：暂无"
        }
        val formatted = SimpleDateFormat("MM-dd HH:mm", Locale.getDefault()).format(Date(lastSyncedAt))
        return "最新同步：$formatted"
    }

    val syncWebDavFromHome: () -> Unit = syncWebDavFromHome@{
        val vault = state.vault
        val password = state.activePassword
        val vaultKey = state.activeVaultKey
        if (vault == null || (password == null && vaultKey == null)) {
            syncState.showHomeError("保管库未解锁。")
            return@syncWebDavFromHome
        }
        if (!syncState.webDavSettings.enabled) {
            syncState.showHomeCopy("WebDAV 同步未开启，本地模式。")
            return@syncWebDavFromHome
        }
        syncState.launchExclusiveSyncTask(
            task = {
                withContext(Dispatchers.IO) {
                    webDavFlowCoordinator.syncUnlocked(password, vaultKey)
                }
            },
            onSuccess = { flowResult ->
                syncState.updateMetadata(flowResult.metadata)
                val syncMessage = formatWebDavResultMessage(flowResult.syncResult)
                if (flowResult.refreshedVault != null) {
                    if (password != null && flowResult.vaultKey != null) {
                        val previousVaultKey = state.activeVaultKey
                        state.updateUnlockedVault(flowResult.refreshedVault, password, flowResult.vaultKey)
                        if (flowResult.syncResult.vaultKey != null) {
                            refreshQuickUnlockCredentialIfNeeded(previousVaultKey, flowResult.vaultKey)
                        }
                    } else if (flowResult.vaultKey != null) {
                        state.updateUnlockedVaultWithKey(flowResult.refreshedVault, flowResult.vaultKey)
                    }
                }
                if (needsMasterPasswordForSync(flowResult.syncResult)) {
                    syncState.showHomeError(syncMessage)
                    pendingBackupPasswordAction = BackupPasswordAction.WebDavSync
                } else {
                    syncState.showHomeCopy(syncMessage)
                }
            },
            onFailure = { error ->
                syncState.updateMetadata(webDavSyncService.loadMetadata())
                syncState.showHomeError(error.message ?: "同步失败，请稍后重试。")
            }
        )
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
                unlockState.clearError()
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
                unlockState.clearError()
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
                backupState.updateBusy(false)
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
                            backupState.showError("未选择导入文件。")
                        }
                    }
                    BackupPasswordAction.WebDavSync -> syncWebDavWithPassword(password)
                    null -> Unit
                }
            }
        )
    }

    if (passwordChangeState.dialogVisible) {
        BlockingProgressDialog(
            inProgress = passwordChangeState.inProgress,
            message = passwordChangeState.dialogMessage,
            isError = passwordChangeState.dialogIsError
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
            LaunchedEffect(state.currentRoute, hasExistingVault, quickUnlockState.enabled, quickUnlockState.available, foregroundUnlockTick) {
                if (state.currentRoute == TotpRoute.Unlock && hasExistingVault && quickUnlockState.enabled && !quickUnlockState.autoUnlockAttempted) {
                    delay(700)
                    refreshQuickUnlockAvailability()
                }
                if (state.currentRoute == TotpRoute.Unlock && hasExistingVault && quickUnlockState.enabled && quickUnlockState.available && !quickUnlockState.autoUnlockAttempted && !quickUnlockState.isBusy) {
                    startBiometricUnlock()
                }
            }
            LaunchedEffect(quickUnlockState.isBusy, state.currentRoute) {
                if (quickUnlockState.isBusy && state.currentRoute == TotpRoute.Unlock) {
                    delay(15_000)
                    if (quickUnlockState.isBusy && state.currentRoute == TotpRoute.Unlock) {
                        quickUnlockState.resetUnlockAttempt()
                    }
                }
            }
            UnlockScreen(
                hasExistingVault = hasExistingVault,
                errorMessage = unlockState.errorMessage,
                isBusy = unlockState.isBusy,
                biometricUnlockEnabled = hasExistingVault && quickUnlockState.enabled && quickUnlockState.available,
                isBiometricBusy = quickUnlockState.isBusy,
                modifier = Modifier.padding(padding),
                onCreatePassword = { password ->
                    unlockState.launchTask(
                        task = {
                            withContext(Dispatchers.IO) {
                                val vault = repository.create(password, now = System.currentTimeMillis())
                                val vaultKey = repository.exportVaultKey(password)
                                vault to vaultKey
                            }
                        },
                        onSuccess = { (vault, vaultKey) ->
                            hasExistingVault = true
                            state.applyUnlockedVault(vault, password, vaultKey)
                            syncWebDavAfterUnlock(vault, password, vaultKey)
                        },
                        onFailure = {
                            unlockState.showError("Could not create vault")
                        }
                    )
                },
                onBiometricUnlock = startBiometricUnlock,
                onUnlock = { password ->
                    unlockState.launchTask(
                        task = {
                            withContext(Dispatchers.IO) {
                                val vault = repository.unlock(password)
                                val vaultKey = repository.exportVaultKey(password)
                                vault to vaultKey
                            }
                        },
                        onSuccess = { (vault, vaultKey) ->
                            state.applyUnlockedVault(vault, password, vaultKey)
                            syncWebDavAfterUnlock(vault, password, vaultKey)
                        },
                        onFailure = {
                            unlockState.showError("Could not unlock vault")
                        }
                    )
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
                            spinning = syncState.isBusy,
                            onClick = syncWebDavFromHome
                        )
                    }
                ) { padding ->
                    HomeScreen(
                        vault = vault,
                        nowMillis = nowMillis,
                        syncStatusMessage = homeSyncStatus(),
                        copyStatusMessage = syncState.homeCopyStatusMessage,
                        errorMessage = syncState.homeErrorStatusMessage,
                        lastSyncLabel = lastSyncLabel(),
                        onAdd = { state.navigate(TotpRoute.Add) },
                        onEdit = { accountId -> state.navigate(TotpRoute.Edit(accountId)) },
                        onCopy = { code, account ->
                            val clipboard = context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
                            clipboard.setPrimaryClip(ClipData.newPlainText("TOTP code", code))
                            val label = account.issuer.ifBlank { "当前账号" }
                            syncState.showHomeCopy("已复制 ${label} 的验证码到系统剪贴板。")
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
            val settingsUiModel = settingsState.buildUiModel(syncState, backupState, quickUnlockState)
            SettingsScreen(
                accountCount = state.vault?.accounts?.size ?: 0,
                biometricUnlockEnabled = quickUnlockState.enabled,
                webDavSettings = syncState.webDavSettings,
                isWebDavBusy = syncState.isBusy,
                settingsUiModel = settingsUiModel,
                isPasswordChangeBusy = passwordChangeState.dialogVisible,
                masterPasswordErrorMessage = passwordChangeState.masterPasswordErrorMessage,
                onSaveWebDavSettings = { settings ->
                    syncState.launchExclusiveSyncTask(
                        task = {
                            withContext(Dispatchers.IO) {
                                webDavFlowCoordinator.saveSettingsAndSyncIfUnlocked(
                                    settings = settings,
                                    isUnlocked = state.vault != null,
                                    password = state.activePassword,
                                    vaultKey = state.activeVaultKey
                                )
                            }
                        },
                        onSuccess = { settingsFlowResult ->
                            val syncFlowResult = settingsFlowResult.syncFlowResult
                            val syncResult = syncFlowResult?.syncResult
                            val refreshedVault = syncFlowResult?.refreshedVault
                            val nextVaultKey = syncFlowResult?.vaultKey
                            syncState.updateSettings(settingsFlowResult.settings)
                            syncState.updateMetadata(settingsFlowResult.metadata)
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
                                    syncState.showHomeError(syncMessage)
                                    syncState.showSettingsError(syncMessage)
                                    pendingBackupPasswordAction = BackupPasswordAction.WebDavSync
                                } else {
                                    syncState.showHomeCopy(syncMessage)
                                    syncState.showSettingsCopy(syncMessage)
                                }
                            } else {
                                syncState.showHomeCopy(if (settingsFlowResult.settings.enabled) "WebDAV 设置已保存" else "")
                                syncState.showSettingsCopy(if (settingsFlowResult.settings.enabled) "WebDAV 设置已保存" else "")
                            }
                        },
                        onFailure = { error ->
                            val message = error.message ?: "无法保存 WebDAV 设置"
                            syncState.showHomeError(message)
                            syncState.showSettingsError(message)
                        }
                    )
                },
                onTestWebDav = { settings ->
                    syncState.launchExclusiveSyncTask(
                        task = {
                            withContext(Dispatchers.IO) {
                                webDavFlowCoordinator.testConnection(settings)
                            }
                        },
                        onSuccess = {
                            syncState.showHomeCopy("WebDAV 连接正常")
                            syncState.showSettingsCopy("WebDAV 连接正常")
                        },
                        onFailure = { error ->
                            val message = error.message ?: "WebDAV 测试失败"
                            syncState.showHomeError(message)
                            syncState.showSettingsError(message)
                        }
                    )
                },
                onSyncWebDav = {
                    val vault = state.vault
                    val password = state.activePassword
                    val vaultKey = state.activeVaultKey
                    if (vault == null || (password == null && vaultKey == null)) {
                        syncState.showHomeError("保管库未解锁")
                        syncState.showSettingsError("保管库未解锁")
                        return@SettingsScreen
                    }
                    syncState.launchExclusiveSyncTask(
                        task = {
                            withContext(Dispatchers.IO) {
                                webDavFlowCoordinator.syncUnlocked(password, vaultKey)
                            }
                        },
                        onSuccess = { flowResult ->
                            val result = flowResult.syncResult
                            val refreshedVault = flowResult.refreshedVault
                            val nextVaultKey = flowResult.vaultKey
                            syncState.updateMetadata(flowResult.metadata)
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
                                syncState.showHomeError(syncMessage)
                                syncState.showSettingsError(syncMessage)
                                pendingBackupPasswordAction = BackupPasswordAction.WebDavSync
                            } else {
                                syncState.showHomeCopy(syncMessage)
                                syncState.showSettingsCopy(syncMessage)
                            }
                        },
                        onFailure = { error ->
                            syncState.updateMetadata(webDavSyncService.loadMetadata())
                            val message = error.message ?: "WebDAV 同步失败"
                            syncState.showHomeError(message)
                            syncState.showSettingsError(message)
                        }
                    )
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
                    val shouldSyncPasswordChange = webDavSyncService.loadSettings().enabled
                    val changePassword: suspend () -> Unit = {
                        passwordChangeState.runChange(
                            successMessage = "主密码已修改，${quickUnlockTitleForMessage(quickUnlockState.hasStrongBiometric)}需要重新开启。",
                            task = {
                                withContext(Dispatchers.IO) {
                                    webDavFlowCoordinator.changeMasterPassword(currentPassword, nextPassword)
                                }
                            },
                            onSuccess = { result ->
                                state.updateUnlockedVault(result.vault, nextPassword, result.vaultKey)
                                syncState.updateMetadata(result.metadata)
                                quickUnlockCoordinator.disable()
                                quickUnlockState.updateEnabled(false)
                            },
                            onFailure = {}
                        )
                    }
                    if (shouldSyncPasswordChange) {
                        syncState.launchExclusiveSync(changePassword)
                    } else {
                        appScope.launch { changePassword() }
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
