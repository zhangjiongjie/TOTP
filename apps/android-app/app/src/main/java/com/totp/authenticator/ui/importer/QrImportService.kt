package com.totp.authenticator.ui.importer

import android.content.Context
import android.net.Uri
import com.google.android.gms.tasks.Task
import com.google.mlkit.vision.barcode.BarcodeScannerOptions
import com.google.mlkit.vision.barcode.BarcodeScanning
import com.google.mlkit.vision.barcode.common.Barcode
import com.google.mlkit.vision.common.InputImage
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException
import kotlinx.coroutines.suspendCancellableCoroutine

class QrImportService(
    private val context: Context
) {
    private val scannerOptions = BarcodeScannerOptions.Builder()
        .setBarcodeFormats(Barcode.FORMAT_QR_CODE)
        .build()

    suspend fun decodeImage(uri: Uri): String {
        val image = InputImage.fromFilePath(context, uri)
        val codes = BarcodeScanning.getClient(scannerOptions).process(image).await()
        return codes.firstNotNullOfOrNull { it.rawValue }
            ?: throw QrImportException("No QR code found in image")
    }
}

class QrImportException(message: String) : Exception(message)

suspend fun <T> Task<T>.await(): T {
    return suspendCancellableCoroutine { continuation ->
        addOnSuccessListener { result ->
            continuation.resume(result)
        }
        addOnFailureListener { error ->
            continuation.resumeWithException(error)
        }
        addOnCanceledListener {
            continuation.cancel()
        }
    }
}
