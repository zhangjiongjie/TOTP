package com.totp.authenticator.data.backup

import android.util.Base64
import com.totp.authenticator.core.account.TotpAccount
import com.totp.authenticator.core.totp.TotpAlgorithm
import com.totp.authenticator.data.vault.LocalVault
import com.totp.authenticator.data.vault.VaultEnvelopeJson
import java.security.MessageDigest
import java.security.SecureRandom
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.UUID
import javax.crypto.Cipher
import javax.crypto.SecretKeyFactory
import javax.crypto.spec.GCMParameterSpec
import javax.crypto.spec.PBEKeySpec
import javax.crypto.spec.SecretKeySpec
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json

class BackupService(
    private val secureRandom: SecureRandom = SecureRandom()
) {
    fun createEncryptedExport(vault: LocalVault, password: String): String {
        val plain = PlainExportVaultPayloadDto(
            version = EXPORT_FORMAT_VERSION,
            accounts = vault.accounts.map(BackupAccountDto::fromDomain)
        )
        val salt = ByteArray(SALT_SIZE_BYTES).also(secureRandom::nextBytes)
        val iv = ByteArray(IV_SIZE_BYTES).also(secureRandom::nextBytes)
        val keyBytes = deriveKeyBytes(password, salt)
        val cipher = Cipher.getInstance(AES_GCM)
        cipher.init(Cipher.ENCRYPT_MODE, SecretKeySpec(keyBytes, AES), GCMParameterSpec(TAG_SIZE_BITS, iv))
        val encryptedWithTag = cipher.doFinal(json.encodeToString(plain).toByteArray(Charsets.UTF_8))
        return json.encodeToString(
            EncryptedExportBundleDto(
                encryptedVault = EncryptedBackupBlobDto(
                    salt = base64(salt),
                    iv = base64(iv),
                    ciphertext = base64(encryptedWithTag),
                    passwordVerifier = base64(keyBytes)
                )
            )
        )
    }

    fun parseImport(raw: String, password: String): LocalVault {
        val trimmed = raw.trim()
        val bundle = runCatching { json.decodeFromString<ImportEnvelopeDto>(trimmed) }.getOrNull()
        val payload = when (bundle?.mode) {
            "encrypted" -> {
                val encrypted = bundle.encryptedVault ?: throw IllegalArgumentException("加密备份内容无效。")
                decryptEncryptedPayload(encrypted, password)
            }
            "plain" -> bundle.vault ?: throw IllegalArgumentException("明文备份内容无效。")
            else -> return VaultEnvelopeJson.decodeVault(trimmed)
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

    private fun decryptEncryptedPayload(encrypted: EncryptedBackupBlobDto, password: String): PlainExportVaultPayloadDto {
        validateEncryptedBlob(encrypted)
        val salt = unbase64(encrypted.salt)
        val expectedVerifier = unbase64(encrypted.passwordVerifier)
        val keyBytes = deriveKeyBytes(password, salt)
        require(MessageDigest.isEqual(expectedVerifier, keyBytes)) { "备份密码与当前主密码不匹配。" }
        val cipher = Cipher.getInstance(AES_GCM)
        cipher.init(Cipher.DECRYPT_MODE, SecretKeySpec(keyBytes, AES), GCMParameterSpec(TAG_SIZE_BITS, unbase64(encrypted.iv)))
        val plaintext = cipher.doFinal(unbase64(encrypted.ciphertext)).toString(Charsets.UTF_8)
        return json.decodeFromString(plaintext)
    }

    private fun validateEncryptedBlob(encrypted: EncryptedBackupBlobDto) {
        require(encrypted.formatVersion == EXPORT_FORMAT_VERSION) { "加密备份格式暂不支持。" }
        require(encrypted.kdf.name == KDF_NAME && encrypted.kdf.hash == KDF_HASH && encrypted.kdf.iterations == KDF_ITERATIONS) {
            "加密备份格式暂不支持。"
        }
        require(encrypted.cipher == EXPORT_CIPHER) { "加密备份格式暂不支持。" }
    }

    private fun deriveKeyBytes(password: String, salt: ByteArray): ByteArray {
        val spec = PBEKeySpec(password.toCharArray(), salt, KDF_ITERATIONS, KEY_SIZE_BITS)
        return try {
            secretKeyFactory.generateSecret(spec).encoded
        } finally {
            spec.clearPassword()
        }
    }

    private fun base64(bytes: ByteArray): String = Base64.encodeToString(bytes, Base64.NO_WRAP)

    private fun unbase64(value: String): ByteArray = Base64.decode(value, Base64.NO_WRAP)

    private companion object {
        const val EXPORT_FORMAT_VERSION = 1
        const val KDF_NAME = "PBKDF2"
        const val KDF_HASH = "SHA-256"
        const val KDF_ITERATIONS = 310_000
        const val EXPORT_CIPHER = "AES-GCM"
        const val AES_GCM = "AES/GCM/NoPadding"
        const val AES = "AES"
        const val KEY_SIZE_BITS = 256
        const val SALT_SIZE_BYTES = 16
        const val IV_SIZE_BYTES = 12
        const val TAG_SIZE_BITS = 128

        val secretKeyFactory: SecretKeyFactory by lazy {
            SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256")
        }

        val json = Json {
            encodeDefaults = true
            ignoreUnknownKeys = true
            prettyPrint = true
        }
    }
}

@Serializable
private data class ImportEnvelopeDto(
    val mode: String = "",
    val vault: PlainExportVaultPayloadDto? = null,
    val encryptedVault: EncryptedBackupBlobDto? = null
)

@Serializable
private data class EncryptedExportBundleDto(
    val mode: String = "encrypted",
    val encryptedVault: EncryptedBackupBlobDto
)

@Serializable
private data class PlainExportVaultPayloadDto(
    val version: Int = 1,
    val accounts: List<BackupAccountDto>
)

@Serializable
private data class EncryptedBackupBlobDto(
    val formatVersion: Int = 1,
    val kdf: BackupKdfDto = BackupKdfDto(),
    val cipher: String = "AES-GCM",
    val salt: String = "",
    val iv: String = "",
    val ciphertext: String = "",
    val passwordVerifier: String = ""
)

@Serializable
private data class BackupKdfDto(
    val name: String = "PBKDF2",
    val iterations: Int = 310_000,
    val hash: String = "SHA-256"
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
