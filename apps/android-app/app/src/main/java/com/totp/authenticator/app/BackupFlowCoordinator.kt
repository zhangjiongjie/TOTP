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

    suspend fun importBackup(
        raw: String,
        importPassword: String,
        localPassword: String?,
        currentVaultKey: ByteArray? = null
    ): BackupImportResult {
        val startedAt = BackupPerfLogger.now()
        BackupPerfLogger.log("import flow start bytes=${raw.length}")
        val importedVault = backupService.parseImport(raw, importPassword, currentVaultKey)
        val parsedAt = BackupPerfLogger.now()
        BackupPerfLogger.log(
            "import flow parsed elapsed=${parsedAt - startedAt}ms accounts=${importedVault.vault.accounts.size} fastKey=${importedVault.vaultKey != null}"
        )
        val vaultKey = if (currentVaultKey != null) {
            repository.saveWithVaultKey(importedVault.vault, currentVaultKey)
            currentVaultKey.copyOf()
        } else {
            val savePassword = localPassword ?: importPassword
            repository.save(importedVault.vault, savePassword)
            importedVault.vaultKey ?: repository.exportVaultKey(savePassword)
        }
        val savedAt = BackupPerfLogger.now()
        BackupPerfLogger.log("import flow saved elapsed=${savedAt - startedAt}ms save=${savedAt - parsedAt}ms")
        val exportedKeyAt = BackupPerfLogger.now()
        BackupPerfLogger.log(
            "import flow vaultKey elapsed=${exportedKeyAt - startedAt}ms exportKey=${exportedKeyAt - savedAt}ms"
        )
        return BackupImportResult(
            vault = importedVault.vault,
            vaultKey = vaultKey
        ).also {
            val finishedAt = BackupPerfLogger.now()
            BackupPerfLogger.log("import flow total=${finishedAt - startedAt}ms accounts=${importedVault.vault.accounts.size}")
        }
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
