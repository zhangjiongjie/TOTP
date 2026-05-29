package com.totp.authenticator.app

import android.util.Log

internal object BackupPerfLogger {
    fun now(): Long = System.currentTimeMillis()

    fun elapsedSince(startedAt: Long): Long = now() - startedAt

    fun log(message: String) {
        runCatching { Log.d(TAG, message) }
    }

    private const val TAG = "TotpBackupPerf"
}
