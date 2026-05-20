package com.totp.authenticator.app

import android.Manifest
import android.content.pm.PackageManager
import android.util.Log
import android.widget.Toast
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.platform.LocalContext
import androidx.core.content.ContextCompat
import com.totp.authenticator.ui.importer.QrImportException
import com.totp.authenticator.ui.importer.QrImportService
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

data class QrImportActions(
    val startImageImport: () -> Unit,
    val startScan: () -> Unit
)

@Composable
fun rememberQrImportActions(
    appState: TotpApplicationState,
    backupState: BackupViewModel,
    onImportedOtpAuthUri: (String) -> Unit
): QrImportActions {
    val activityContext = LocalContext.current
    val context = activityContext.applicationContext
    val scope = rememberCoroutineScope()
    val qrImportService = remember(context) { QrImportService(context.applicationContext) }

    fun showQrImportError(message: String = "Could not read QR code") {
        Toast.makeText(context, message, Toast.LENGTH_SHORT).show()
    }

    val imagePickerLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.PickVisualMedia()
    ) { uri ->
        if (uri == null) {
            backupState.markExternalPickerActive(false)
            return@rememberLauncherForActivityResult
        }
        backupState.markExternalPickerActive(false)
        scope.launch {
            runCatching {
                withContext(Dispatchers.IO) {
                    qrImportService.decodeImage(uri)
                }
            }.onSuccess(onImportedOtpAuthUri)
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
            appState.navigate(TotpRoute.Scan)
        } else {
            Toast.makeText(context, "Camera permission is required to scan QR codes", Toast.LENGTH_SHORT).show()
        }
    }

    return remember(activityContext, appState, backupState, imagePickerLauncher, cameraPermissionLauncher) {
        QrImportActions(
            startImageImport = {
                backupState.markExternalPickerActive(true)
                imagePickerLauncher.launch(
                    PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly)
                )
            },
            startScan = {
                if (ContextCompat.checkSelfPermission(activityContext, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED) {
                    appState.navigate(TotpRoute.Scan)
                } else {
                    cameraPermissionLauncher.launch(Manifest.permission.CAMERA)
                }
            }
        )
    }
}
