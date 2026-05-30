package com.totp.authenticator.app

import android.app.Activity
import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.os.Build
import android.provider.Settings
import android.util.Log
import android.widget.Toast
import androidx.biometric.BiometricManager.Authenticators.BIOMETRIC_STRONG
import androidx.biometric.BiometricManager.Authenticators.DEVICE_CREDENTIAL
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
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.lifecycle.viewmodel.compose.viewModel
import com.totp.authenticator.R
import com.totp.authenticator.data.backup.BackupService
import com.totp.authenticator.data.biometric.BiometricVaultUnlockStore
import com.totp.authenticator.data.vault.VaultRepository
import com.totp.authenticator.data.webdav.RemoteVaultCrypto
import com.totp.authenticator.data.webdav.RemoteVaultKeyCacheStore
import com.totp.authenticator.data.webdav.WebDavSettingsStore
import com.totp.authenticator.data.webdav.WebDavSyncService
import com.totp.authenticator.ui.app.HeaderCircleIconButton
import com.totp.authenticator.ui.app.MainDestination
import com.totp.authenticator.ui.app.TotpMainScaffold
import com.totp.authenticator.ui.editor.AccountEditorScreen
import com.totp.authenticator.ui.home.HomeScreen
import com.totp.authenticator.ui.importer.QrScannerScreen
import com.totp.authenticator.ui.common.PasswordVisibilityIcon
import com.totp.authenticator.ui.settings.SettingsScreen
import com.totp.authenticator.ui.unlock.UnlockScreen
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

@Composable
fun TotpApp() {
    val activityContext = LocalContext.current
    val lifecycleOwner = LocalLifecycleOwner.current
    val context = activityContext.applicationContext
    val repository = remember { VaultRepository(context) }
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
    val vaultAccountState: VaultAccountViewModel = viewModel(key = "vaultAccount")
    val quickUnlockState: QuickUnlockViewModel = viewModel(
        key = "quickUnlock",
        factory = object : ViewModelProvider.Factory {
            @Suppress("UNCHECKED_CAST")
            override fun <T : ViewModel> create(modelClass: Class<T>): T {
                return QuickUnlockViewModel(quickUnlockCoordinator.availability()) as T
            }
        }
    )
    var importedOtpAuthUri by remember { mutableStateOf<String?>(null) }
    var foregroundUnlockTick by remember { mutableStateOf(0) }

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
                    if (state.isUnlocked && !isConfigurationChange && !backupState.externalPickerActive) {
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

    val qrImportActions = rememberQrImportActions(
        appState = state,
        backupState = backupState,
        onImportedOtpAuthUri = ::acceptImportedOtpAuthUri
    )

    LaunchedEffect(Unit) {
        launch(Dispatchers.IO) {
            runCatching { repository.warmUpCrypto() }
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

    LaunchedEffect(backupState.messageVersion) {
        val version = backupState.messageVersion
        if (version == 0 || (backupState.statusMessage.isBlank() && backupState.errorMessage.isBlank())) {
            return@LaunchedEffect
        }
        delay(2_500)
        backupState.clearMessageIfVersion(version)
    }

    fun showPersistenceError(message: String) {
        unlockState.showError(message)
        Toast.makeText(context, message, Toast.LENGTH_SHORT).show()
    }

    val quickUnlockMessage: (String) -> Unit = { message ->
        Toast.makeText(context, message, Toast.LENGTH_SHORT).show()
    }
    val quickUnlockPrompt = rememberQuickUnlockPromptBridge(quickUnlockState)
    val quickUnlockCredentialRefresher = remember {
        QuickUnlockCredentialRefresher(
            quickUnlockState = quickUnlockState,
            quickUnlockCoordinator = quickUnlockCoordinator,
            onPrompt = quickUnlockPrompt,
            onMessage = quickUnlockMessage
        )
    }
    val homeSyncActions = remember {
        HomeSyncActionCoordinator(
            appState = state,
            syncState = syncState,
            backupState = backupState,
            webDavFlowCoordinator = webDavFlowCoordinator,
            webDavSyncService = webDavSyncService,
            onRefreshQuickUnlockCredentialIfNeeded = quickUnlockCredentialRefresher::refreshIfNeeded
        )
    }
    val unlockActions = remember {
        UnlockActionCoordinator(
            appState = state,
            repository = repository,
            unlockState = unlockState,
            onVaultExists = { hasExistingVault = true },
            onSyncAfterUnlock = homeSyncActions::syncAfterUnlock
        )
    }
    val quickUnlockActions = remember {
        QuickUnlockActionCoordinator(
            appState = state,
            quickUnlockState = quickUnlockState,
            unlockState = unlockState,
            quickUnlockCoordinator = quickUnlockCoordinator,
            onRefreshAvailability = ::refreshQuickUnlockAvailability,
            onPrompt = quickUnlockPrompt,
            onOpenSystemCredentialSettings = {
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
            },
            onMessage = quickUnlockMessage,
            onSyncAfterUnlock = homeSyncActions::syncAfterUnlock
        )
    }
    val backupActions = remember {
        BackupActionCoordinator(
            appState = state,
            backupState = backupState,
            backupFlowCoordinator = backupFlowCoordinator,
            onLocalChange = homeSyncActions::syncAfterLocalChange
        )
    }

    BackupPickerBridge(
        appState = state,
        backupState = backupState,
        backupActions = backupActions
    )

    fun lastSyncLabel(): String {
        val lastSyncedAt = syncState.webDavMetadata.lastSyncedAt
        if (lastSyncedAt <= 0L) {
            return "最新同步：暂无"
        }
        val formatted = SimpleDateFormat("MM-dd HH:mm", Locale.getDefault()).format(Date(lastSyncedAt))
        return "最新同步：$formatted"
    }

    val accountActions = remember {
        VaultAccountActionCoordinator(
            appState = state,
            repository = repository,
            unlockState = unlockState,
            accountState = vaultAccountState,
            callbacks = VaultAccountCallbacks(
                onVaultExists = { hasExistingVault = true },
                onPersistenceError = ::showPersistenceError,
                onLocalChange = homeSyncActions::syncAfterLocalChange
            )
        )
    }

    if (backupState.pendingPasswordAction != null) {
        BackupMasterPasswordDialog(
            action = backupState.pendingPasswordAction!!,
            onDismiss = {
                backupState.dismissPasswordPrompt()
            },
            onConfirm = { password ->
                val request = backupState.consumePasswordRequest()
                when (request?.action) {
                    BackupPasswordAction.Export -> backupActions.exportWithPassword(password)
                    BackupPasswordAction.Import -> {
                        if (request.importContent != null) {
                            backupActions.importContent(request.importContent, password)
                        } else {
                            backupState.showError("未选择导入文件。")
                        }
                    }
                    BackupPasswordAction.WebDavSync -> homeSyncActions.syncWithPassword(password)
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
                    quickUnlockActions.startUnlock()
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
                onCreatePassword = unlockActions::createVault,
                onBiometricUnlock = quickUnlockActions::startUnlock,
                onUnlock = unlockActions::unlock
            )
        }

        TotpRoute.Home -> {
            val vault = state.vault
            if (vault == null) {
                MissingVaultEffect { state.lock() }
            } else {
                TotpMainScaffold(
                    title = context.getString(R.string.app_name),
                    selectedDestination = MainDestination.Home,
                    onHome = { state.navigate(TotpRoute.Home) },
                    onAdd = { state.navigate(TotpRoute.Add) },
                    onSettings = { state.navigate(TotpRoute.Settings) },
                    actions = {
                        HeaderCircleIconButton(
                            iconRes = R.drawable.action_sync,
                            contentDescription = "Sync",
                            spinning = syncState.isBusy,
                            onClick = homeSyncActions::syncFromHome
                        )
                    }
                ) { padding ->
                    HomeScreen(
                        vault = vault,
                        syncStatusMessage = syncState.homeSyncStatus,
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
                    onClick = qrImportActions.startImageImport
                )
                Spacer(modifier = Modifier.width(8.dp))
                HeaderCircleIconButton(
                    iconRes = R.drawable.action_scan,
                    contentDescription = "Scan QR code",
                    onClick = qrImportActions.startScan
                )
            }
        ) { padding ->
            AccountEditorScreen(
                title = "添加账号",
                existingAccount = null,
                onSave = { account -> accountActions.saveAccount(account, replaceExisting = false) },
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
                        onSave = { updatedAccount -> accountActions.saveAccount(updatedAccount, replaceExisting = true) },
                        onDelete = accountActions::deleteAccount,
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
            val settingsScreenState = settingsState.buildScreenState(
                syncState = syncState,
                backupState = backupState,
                quickUnlockState = quickUnlockState,
                passwordChangeState = passwordChangeState
            )
            val settingsActions = remember(
                state,
                syncState,
                quickUnlockState,
                passwordChangeState,
                webDavFlowCoordinator,
                webDavSyncService,
                backupState
            ) {
                SettingsActionCoordinator(
                    appState = state,
                    syncState = syncState,
                    quickUnlockState = quickUnlockState,
                    passwordChangeState = passwordChangeState,
                    webDavFlowCoordinator = webDavFlowCoordinator,
                    webDavSyncService = webDavSyncService,
                    onRefreshQuickUnlockAvailability = ::refreshQuickUnlockAvailability,
                    onEnableQuickUnlock = quickUnlockActions::enable,
                    onDisableQuickUnlock = quickUnlockActions::disable,
                    onRefreshQuickUnlockCredentialIfNeeded = quickUnlockCredentialRefresher::refreshIfNeeded,
                    onRemotePasswordNeeded = backupState::requestRemotePassword,
                    onVaultLocked = { Toast.makeText(context, "保管库未解锁", Toast.LENGTH_SHORT).show() },
                    onExportBackup = backupActions::startExport,
                    onImportBackup = backupActions::startImport
                ).buildActions()
            }
            SettingsScreen(
                accountCount = state.vault?.accounts?.size ?: 0,
                state = settingsScreenState,
                actions = settingsActions,
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
        BackupPasswordAction.Import -> "备份文件密码"
        else -> "主密码"
    }
    val message = when (action) {
        BackupPasswordAction.WebDavSync -> "远端主密码已变化，请输入新的远端主密码后继续同步。"
        BackupPasswordAction.Import -> "当前主密码无法解开该加密备份，请输入备份文件密码。导入成功后，本地仍使用当前主密码保存。"
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

private data class Quad<A, B, C, D>(
    val first: A,
    val second: B,
    val third: C,
    val fourth: D
)
