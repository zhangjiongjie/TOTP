package com.totp.authenticator.app

import java.io.File
import org.junit.Assert.assertTrue
import org.junit.Test

class BackupFlowCoordinatorBoundaryTest {
    @Test
    fun importWithCurrentVaultKeyAvoidsPasswordKdfAfterBackupDecrypt() {
        val source = File("src/main/java/com/totp/authenticator/app/BackupFlowCoordinator.kt").readText()
        val importSource = source.substringAfter("suspend fun importBackup").substringBefore("data class BackupExportPayload")

        assertTrue("Import should accept the already-unlocked local vault key", importSource.contains("currentVaultKey: ByteArray?"))
        assertTrue("Import should pass the active local vault key into backup parsing", importSource.contains("backupService.parseImport(raw, importPassword, currentVaultKey)"))
        assertTrue("Import should save with the active local vault key when it is available", importSource.contains("repository.saveWithVaultKey(importedVault.vault, currentVaultKey)"))
        assertTrue("The active vault key fast path should return the key without exporting it from the password", importSource.contains("currentVaultKey.copyOf()"))
        assertTrue("Import should save retries with the current local password instead of adopting the backup password", importSource.contains("val savePassword = localPassword ?: importPassword"))
        assertTrue(
            "Active vault key reuse should happen before the password KDF fallback",
            importSource.indexOf("currentVaultKey.copyOf()") < importSource.indexOf("repository.exportVaultKey(savePassword)")
        )
    }

    @Test
    fun backupServiceTriesActiveVaultKeyBeforePasswordKdf() {
        val source = File("src/main/java/com/totp/authenticator/data/backup/BackupService.kt").readText()
        val parseSource = source.substringAfter("fun parseImport").substringBefore("fun createBackupFilename")

        assertTrue("Backup import parsing should accept the already-unlocked vault key", parseSource.contains("currentVaultKey: ByteArray?"))
        assertTrue("Encrypted backup import should first try the active vault key", parseSource.contains("crypto.decryptWithVaultKey(encrypted, currentVaultKey)"))
        assertTrue(
            "Password KDF fallback should only run after the active vault key fast path",
            parseSource.indexOf("crypto.decryptWithVaultKey(encrypted, currentVaultKey)") < parseSource.indexOf("crypto.decryptWithKey(encrypted, password)")
        )
    }

    @Test
    fun backupActionPassesActiveVaultKeyIntoImportFlow() {
        val source = File("src/main/java/com/totp/authenticator/app/BackupActionCoordinator.kt").readText()
        val importSource = source.substringAfter("fun importContent")

        assertTrue(
            "Backup import should pass the already-unlocked active vault key so local save avoids password KDF",
            importSource.contains("backupFlowCoordinator.importBackup(content, importPassword, localPassword, localVaultKey)")
        )
        assertTrue(
            "Backup import should keep local-change sync on the current local password, not the backup password",
            importSource.contains("onLocalChange(result.vault, localPassword, result.vaultKey)")
        )
    }
}
