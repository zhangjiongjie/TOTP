package com.totp.authenticator.data.backup

import com.totp.authenticator.core.account.TotpAccount
import com.totp.authenticator.core.totp.TotpAlgorithm
import com.totp.authenticator.data.webdav.EncryptedRemoteVaultBlobDto
import com.totp.authenticator.data.webdav.RemoteAesGcmDto
import com.totp.authenticator.data.webdav.RemoteKdfDto
import com.totp.authenticator.data.webdav.RemoteVaultCrypto
import com.totp.authenticator.data.vault.EncryptedVaultEnvelope
import com.totp.authenticator.data.vault.LocalVault
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.UUID
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json

class BackupService(
    private val crypto: RemoteVaultCrypto = RemoteVaultCrypto()
) {
    fun createEncryptedExport(vault: LocalVault, password: String): String {
        return json.encodeToString(
            EncryptedExportBundleDto(
                encryptedVault = crypto.encrypt(vault, password)
            )
        )
    }

    fun createEncryptedExport(vault: LocalVault, existingEnvelope: EncryptedVaultEnvelope, vaultKey: ByteArray): String {
        return json.encodeToString(
            EncryptedExportBundleDto(
                encryptedVault = crypto.encryptWithVaultKey(vault, existingEnvelope.toRemoteDto(), vaultKey)
            )
        )
    }

    fun parseImport(raw: String, password: String): LocalVault {
        val trimmed = raw.trim()
        val bundle = runCatching { json.decodeFromString<ImportEnvelopeDto>(trimmed) }.getOrNull()
        val payload = when (bundle?.mode) {
            "encrypted" -> {
                val encrypted = bundle.encryptedVault ?: throw IllegalArgumentException("加密备份内容无效。")
                return crypto.decrypt(encrypted, password)
            }
            "plain" -> bundle.vault ?: throw IllegalArgumentException("明文备份内容无效。")
            else -> throw IllegalArgumentException("导入文件格式暂不支持，请先使用迁移工具转换为新版备份。")
        }
        val now = System.currentTimeMillis()
        return LocalVault(
            schemaVersion = 1,
            accounts = payload.accounts.mapIndexed { index, account -> account.toDomain(index, now) },
            updatedAt = now
        )
    }

    fun createBackupFilename(nowMillis: Long = System.currentTimeMillis()): String {
        val formatter = DateTimeFormatter.ofPattern("yyyyMMdd-HHmm").withZone(ZoneId.systemDefault())
        return "totp-backup-encrypted-${formatter.format(Instant.ofEpochMilli(nowMillis))}.json"
    }

    private companion object {
        val json = Json {
            encodeDefaults = true
            ignoreUnknownKeys = true
            prettyPrint = true
        }
    }
}

private fun EncryptedVaultEnvelope.toRemoteDto(): EncryptedRemoteVaultBlobDto {
    return EncryptedRemoteVaultBlobDto(
        formatVersion = formatVersion,
        vaultId = vaultId,
        kdf = RemoteKdfDto(
            name = kdf.name,
            iterations = kdf.iterations,
            hash = kdf.hash,
            salt = kdf.salt
        ),
        keyEncryption = RemoteAesGcmDto(
            cipher = keyEncryption.cipher,
            iv = keyEncryption.iv,
            ciphertext = keyEncryption.ciphertext
        ),
        vaultEncryption = RemoteAesGcmDto(
            cipher = vaultEncryption.cipher,
            iv = vaultEncryption.iv,
            ciphertext = vaultEncryption.ciphertext
        )
    )
}

@Serializable
private data class ImportEnvelopeDto(
    val mode: String = "",
    val vault: PlainExportVaultPayloadDto? = null,
    val encryptedVault: EncryptedRemoteVaultBlobDto? = null
)

@Serializable
private data class EncryptedExportBundleDto(
    val mode: String = "encrypted",
    val encryptedVault: EncryptedRemoteVaultBlobDto
)

@Serializable
private data class PlainExportVaultPayloadDto(
    val version: Int = 1,
    val accounts: List<BackupAccountDto>
)

@Serializable
private data class BackupAccountDto(
    val id: String = "",
    val issuer: String = "",
    val accountName: String = "",
    val secret: String = "",
    val digits: Int = 6,
    val period: Int = 30,
    val algorithm: String = "SHA1",
    val tags: List<String> = emptyList(),
    val groupId: String = "",
    val pinned: Boolean = false,
    val iconKey: String = "",
    val updatedAt: String = ""
) {
    fun toDomain(index: Int, nowMillis: Long): TotpAccount {
        return TotpAccount(
            id = id.ifBlank { "imported-${UUID.randomUUID()}-$index" },
            issuer = issuer,
            accountName = accountName,
            secret = secret,
            digits = digits,
            period = period,
            algorithm = TotpAlgorithm.fromName(algorithm),
            group = tags.firstOrNull().orEmpty().ifBlank { "Default" },
            createdAt = nowMillis,
            updatedAt = parseUpdatedAt(updatedAt) ?: nowMillis
        )
    }

    companion object {
        fun fromDomain(account: TotpAccount): BackupAccountDto {
            return BackupAccountDto(
                id = account.id,
                issuer = account.issuer,
                accountName = account.accountName,
                secret = account.secret,
                digits = account.digits,
                period = account.period,
                algorithm = account.algorithm.name,
                tags = listOf(account.group.ifBlank { "Default" }),
                updatedAt = Instant.ofEpochMilli(account.updatedAt).toString()
            )
        }

        private fun parseUpdatedAt(value: String): Long? {
            return runCatching { Instant.parse(value).toEpochMilli() }.getOrNull()
        }
    }
}
