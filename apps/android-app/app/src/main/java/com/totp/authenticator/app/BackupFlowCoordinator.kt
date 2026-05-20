package com.totp.authenticator.app

import com.totp.authenticator.data.backup.BackupService
import com.totp.authenticator.data.vault.LocalVault
import com.totp.authenticator.data.vault.VaultRepository

class BackupFlowCoordinator(
    private val repository: VaultRepository,
    private val backupService: BackupService
) {
    suspend fun createExportWithPassword(vault: LocalVault, password: String): BackupExportPayload {
        repository.exportVaultKey(password)
        return BackupExportPayload(
            content = backupService.createEncryptedExport(vault, password),
            filename = backupService.createBackupFilename()
        )
    }

    suspend fun createExportWithVaultKey(vault: LocalVault, vaultKey: ByteArray): BackupExportPayload {
        val envelope = repository.exportEncryptedEnvelope()
        return BackupExportPayload(
            content = backupService.createEncryptedExport(vault, envelope, vaultKey),
            filename = backupService.createBackupFilename()
        )
    }

    suspend fun importBackup(raw: String, password: String): BackupImportResult {
        val vaultKey = repository.exportVaultKey(password)
        val importedVault = backupService.parseImport(raw, password)
        repository.save(importedVault, password)
        return BackupImportResult(
            vault = importedVault,
            vaultKey = vaultKey
        )
    }
}

data class BackupExportPayload(
    val content: String,
    val filename: String
)

data class BackupImportResult(
    val vault: LocalVault,
    val vaultKey: ByteArray
)
