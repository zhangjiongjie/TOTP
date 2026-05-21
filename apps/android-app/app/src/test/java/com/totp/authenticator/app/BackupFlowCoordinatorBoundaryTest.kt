package com.totp.authenticator.app

import java.io.File
import org.junit.Assert.assertTrue
import org.junit.Test

class BackupFlowCoordinatorBoundaryTest {
    @Test
    fun importExportsVaultKeyAfterSavingImportedVault() {
        val source = File("src/main/java/com/totp/authenticator/app/BackupFlowCoordinator.kt").readText()
        val importSource = source.substringAfter("suspend fun importBackup").substringBefore("data class BackupExportPayload")

        assertTrue(
            "Imported vault must be saved before exporting the active vault key",
            importSource.indexOf("repository.save(importedVault, password)") < importSource.indexOf("repository.exportVaultKey(password)")
        )
    }
}
