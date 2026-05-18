package com.totp.authenticator.app

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.widget.Toast
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import com.google.mlkit.vision.barcode.common.Barcode
import com.google.mlkit.vision.codescanner.GmsBarcodeScannerOptions
import com.google.mlkit.vision.codescanner.GmsBarcodeScanning
import com.totp.authenticator.R
import com.totp.authenticator.core.account.TotpAccount
import com.totp.authenticator.data.vault.LocalVault
import com.totp.authenticator.data.vault.VaultRepository
import com.totp.authenticator.ui.app.HeaderCircleIconButton
import com.totp.authenticator.ui.app.MainDestination
import com.totp.authenticator.ui.app.TotpMainScaffold
import com.totp.authenticator.ui.editor.AccountEditorScreen
import com.totp.authenticator.ui.home.HomeScreen
import com.totp.authenticator.ui.importer.QrImportException
import com.totp.authenticator.ui.importer.QrImportService
import com.totp.authenticator.ui.importer.await
import com.totp.authenticator.ui.settings.SettingsScreen
import com.totp.authenticator.ui.unlock.UnlockScreen
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

@Composable
fun TotpApp() {
    val activityContext = LocalContext.current
    val context = activityContext.applicationContext
    val repository = remember { VaultRepository(context) }
    val qrImportService = remember(activityContext) { QrImportService(activityContext) }
    val appScope = rememberCoroutineScope()
    var hasExistingVault by remember { mutableStateOf(repository.hasVault()) }
    val state = remember { TotpApplicationState(hasExistingVault) }
    var nowMillis by remember { mutableStateOf(System.currentTimeMillis()) }
    var errorMessage by remember { mutableStateOf<String?>(null) }
    var unlockBusy by remember { mutableStateOf(false) }
    var importedOtpAuthUri by remember { mutableStateOf<String?>(null) }

    fun acceptImportedOtpAuthUri(uri: String) {
        importedOtpAuthUri = uri
        state.navigate(TotpRoute.Add)
        Toast.makeText(context, "QR code imported", Toast.LENGTH_SHORT).show()
    }

    fun showQrImportError(message: String = "Could not read QR code") {
        Toast.makeText(context, message, Toast.LENGTH_SHORT).show()
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
                    showQrImportError(
                        if (error is QrImportException) error.message ?: "No QR code found in image" else "Could not read QR image"
                    )
                }
        }
    }

    LaunchedEffect(Unit) {
        launch(Dispatchers.IO) {
            runCatching { repository.warmUpCrypto() }
        }
        while (true) {
            nowMillis = System.currentTimeMillis()
            delay(1_000)
        }
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
        appScope.launch {
            runCatching {
                val options = GmsBarcodeScannerOptions.Builder()
                    .setBarcodeFormats(Barcode.FORMAT_QR_CODE)
                    .build()
                GmsBarcodeScanning.getClient(activityContext, options)
                    .startScan()
                    .await()
                    .rawValue
                    ?: throw QrImportException("No QR code found")
            }.onSuccess(::acceptImportedOtpAuthUri)
                .onFailure { error ->
                    showQrImportError(
                        if (error is QrImportException) error.message ?: "No QR code found" else "Could not scan QR code"
                    )
                }
        }
    }

    fun saveAccount(account: TotpAccount, replaceExisting: Boolean) {
        val vault = state.vault
        val password = state.activePassword
        if (vault == null || password == null) {
            showPersistenceError("Vault is not unlocked")
            return
        }

        val accounts = if (replaceExisting) {
            vault.accounts.map { existing ->
                if (existing.id == account.id) account else existing
            }
        } else {
            vault.accounts + account
        }
        val updatedVault = vault.copy(accounts = accounts, updatedAt = account.updatedAt)
        appScope.launch {
            runCatching {
                withContext(Dispatchers.IO) {
                    repository.save(updatedVault, password)
                }
            }.onSuccess {
                hasExistingVault = true
                errorMessage = null
                state.applyUnlockedVault(updatedVault, password)
                state.navigate(TotpRoute.Home)
            }.onFailure {
                showPersistenceError("Could not save vault")
            }
        }
    }

    fun deleteAccount(accountId: String) {
        val vault = state.vault
        val password = state.activePassword
        if (vault == null || password == null) {
            showPersistenceError("Vault is not unlocked")
            return
        }

        val now = System.currentTimeMillis()
        val updatedVault = vault.copy(
            accounts = vault.accounts.filterNot { it.id == accountId },
            updatedAt = now
        )
        appScope.launch {
            runCatching {
                withContext(Dispatchers.IO) {
                    repository.save(updatedVault, password)
                }
            }.onSuccess {
                hasExistingVault = true
                errorMessage = null
                state.applyUnlockedVault(updatedVault, password)
                state.navigate(TotpRoute.Home)
            }.onFailure {
                showPersistenceError("Could not save vault")
            }
        }
    }

    when (state.currentRoute) {
        TotpRoute.Unlock -> TotpMainScaffold(
            title = "TOTP Authenticator",
            selectedDestination = null,
            onHome = { state.navigate(TotpRoute.Home) },
            onAdd = { state.navigate(TotpRoute.Add) },
            onSettings = { state.navigate(TotpRoute.Settings) }
        ) { padding ->
            UnlockScreen(
                hasExistingVault = hasExistingVault,
                errorMessage = errorMessage,
                isBusy = unlockBusy,
                modifier = Modifier.padding(padding),
                onCreatePassword = { password ->
                    appScope.launch {
                        unlockBusy = true
                        runCatching {
                            withContext(Dispatchers.IO) {
                                repository.create(password, now = System.currentTimeMillis())
                            }
                        }.onSuccess { vault ->
                            hasExistingVault = true
                            errorMessage = null
                            state.applyUnlockedVault(vault, password)
                        }.onFailure {
                            errorMessage = "Could not create vault"
                        }
                        unlockBusy = false
                    }
                },
                onUnlock = { password ->
                    appScope.launch {
                        unlockBusy = true
                        runCatching {
                            withContext(Dispatchers.IO) {
                                repository.unlock(password)
                            }
                        }.onSuccess { vault ->
                            errorMessage = null
                            state.applyUnlockedVault(vault, password)
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
                    title = "TOTP Authenticator",
                    selectedDestination = MainDestination.Home,
                    onHome = { state.navigate(TotpRoute.Home) },
                    onAdd = { state.navigate(TotpRoute.Add) },
                    onSettings = { state.navigate(TotpRoute.Settings) }
                ) { padding ->
                    HomeScreen(
                        vault = vault,
                        nowMillis = nowMillis,
                        onAdd = { state.navigate(TotpRoute.Add) },
                        onEdit = { accountId -> state.navigate(TotpRoute.Edit(accountId)) },
                        onCopy = { code ->
                            val clipboard = context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
                            clipboard.setPrimaryClip(ClipData.newPlainText("TOTP code", code))
                            Toast.makeText(context, "Code copied", Toast.LENGTH_SHORT).show()
                        },
                        modifier = Modifier.padding(padding)
                    )
                }
            }
        }

        TotpRoute.Add -> TotpMainScaffold(
            title = "Add account",
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
                title = "Add account",
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
                    title = "Edit account",
                    selectedDestination = null,
                    onHome = { state.navigate(TotpRoute.Home) },
                    onAdd = { state.navigate(TotpRoute.Add) },
                    onSettings = { state.navigate(TotpRoute.Settings) },
                    onBack = { state.navigate(TotpRoute.Home) }
                ) { padding ->
                    AccountEditorScreen(
                        title = "Edit account",
                        existingAccount = account,
                        onSave = { updatedAccount -> saveAccount(updatedAccount, replaceExisting = true) },
                        onDelete = { accountId -> deleteAccount(accountId) },
                        modifier = Modifier.padding(padding),
                        showTitle = false
                    )
                }
            }
        }

        TotpRoute.Settings -> TotpMainScaffold(
            title = "Settings",
            selectedDestination = MainDestination.Settings,
            onHome = { state.navigate(TotpRoute.Home) },
            onAdd = { state.navigate(TotpRoute.Add) },
            onSettings = { state.navigate(TotpRoute.Settings) }
        ) { padding ->
            SettingsScreen(
                accountCount = state.vault?.accounts?.size ?: 0,
                onClearVault = {
                    appScope.launch {
                        withContext(Dispatchers.IO) {
                            repository.clear()
                        }
                        hasExistingVault = false
                        errorMessage = null
                        state.lock()
                    }
                },
                onLock = { state.lock() },
                modifier = Modifier.padding(padding)
            )
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

private fun VaultRepository.create(password: String, now: Long): LocalVault {
    val vault = LocalVault(
        schemaVersion = 1,
        accounts = emptyList(),
        updatedAt = now
    )
    create(vault, password)
    return vault
}
