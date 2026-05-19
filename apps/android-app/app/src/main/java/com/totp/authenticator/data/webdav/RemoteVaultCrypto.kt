package com.totp.authenticator.data.webdav

import android.util.Base64
import android.util.Log
import com.totp.authenticator.core.account.TotpAccount
import com.totp.authenticator.core.totp.TotpAlgorithm
import com.totp.authenticator.data.vault.LocalVault
import java.security.SecureRandom
import java.time.Instant
import java.util.UUID
import javax.crypto.Cipher
import javax.crypto.SecretKeyFactory
import javax.crypto.spec.GCMParameterSpec
import javax.crypto.spec.PBEKeySpec
import javax.crypto.spec.SecretKeySpec
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json

class RemoteVaultCrypto(
    @Suppress("UNUSED_PARAMETER")
    private val persistentKeyCacheStore: RemoteVaultKeyCacheStore? = null,
    private val secureRandom: SecureRandom = SecureRandom()
) {
    private var cachedKey: RemoteKeyCache? = null

    fun clearCache() {
        cachedKey = null
    }

    fun clearPersistentCache() {
        cachedKey = null
    }

    fun encrypt(vault: LocalVault, password: String, cacheProfileKey: String? = null): EncryptedRemoteVaultBlobDto {
        val startedAt = System.currentTimeMillis()
        val cached = cachedKey?.takeIf { it.matches(password, REMOTE_KDF_ITERATIONS) }
        val salt = cached?.salt ?: ByteArray(SALT_SIZE_BYTES).also(secureRandom::nextBytes)
        val vaultKey = cached?.keyBytes ?: ByteArray(KEY_SIZE_BYTES).also(secureRandom::nextBytes)
        val keyIv = randomIv()
        val vaultIv = randomIv()
        val randomAt = System.currentTimeMillis()
        val wrappingKeyBytes = deriveKeyBytes(password, salt, REMOTE_KDF_ITERATIONS)
        val keyAt = System.currentTimeMillis()

        val encryptedVaultKey = encryptAesGcm(SecretKeySpec(wrappingKeyBytes, AES), keyIv, vaultKey)
        val encryptedVault = encryptAesGcm(
            SecretKeySpec(vaultKey, AES),
            vaultIv,
            json.encodeToString(RemoteVaultDto.fromDomain(vault)).toByteArray(Charsets.UTF_8)
        )
        val encryptedAt = System.currentTimeMillis()
        val vaultId = cached?.vaultId ?: UUID.randomUUID().toString()
        cachedKey = RemoteKeyCache(password, REMOTE_KDF_ITERATIONS, salt.copyOf(), vaultKey.copyOf(), vaultId)

        Log.d(
            "TotpWebDavPerf",
            "remote encrypt total=${encryptedAt - startedAt}ms random=${randomAt - startedAt}ms kdf=${keyAt - randomAt}ms aes=${encryptedAt - keyAt}ms cached=${cached != null} accounts=${vault.accounts.size}"
        )
        return EncryptedRemoteVaultBlobDto(
            formatVersion = REMOTE_FORMAT_VERSION,
            vaultId = vaultId,
            kdf = RemoteKdfDto(
                name = KDF_NAME,
                iterations = REMOTE_KDF_ITERATIONS,
                hash = KDF_HASH,
                salt = base64(salt)
            ),
            keyEncryption = RemoteAesGcmDto(
                cipher = CIPHER_NAME,
                iv = base64(keyIv),
                ciphertext = base64(encryptedVaultKey)
            ),
            vaultEncryption = RemoteAesGcmDto(
                cipher = CIPHER_NAME,
                iv = base64(vaultIv),
                ciphertext = base64(encryptedVault)
            )
        )
    }

    fun decrypt(blob: EncryptedRemoteVaultBlobDto, password: String, cacheProfileKey: String? = null): LocalVault {
        val startedAt = System.currentTimeMillis()
        require(blob.formatVersion == REMOTE_FORMAT_VERSION) { "Unsupported WebDAV vault format" }
        require(blob.kdf.name == KDF_NAME && blob.kdf.hash == KDF_HASH) { "Unsupported WebDAV KDF" }
        require(blob.keyEncryption.cipher == CIPHER_NAME && blob.vaultEncryption.cipher == CIPHER_NAME) { "Unsupported WebDAV cipher" }
        val salt = unbase64(blob.kdf.salt)
        val decodedAt = System.currentTimeMillis()
        val cached = cachedKey?.takeIf { it.matches(password, blob.kdf.iterations, salt, blob.vaultId) }
        val wrappingKeyBytes = deriveKeyBytes(password, salt, blob.kdf.iterations)
        val vaultKey = cached?.keyBytes ?: decryptAesGcm(
            SecretKeySpec(wrappingKeyBytes, AES),
            unbase64(blob.keyEncryption.iv),
            unbase64(blob.keyEncryption.ciphertext)
        )
        cachedKey = RemoteKeyCache(password, blob.kdf.iterations, salt.copyOf(), vaultKey.copyOf(), blob.vaultId)
        val keyAt = System.currentTimeMillis()

        val plaintext = decryptAesGcm(
            SecretKeySpec(vaultKey, AES),
            unbase64(blob.vaultEncryption.iv),
            unbase64(blob.vaultEncryption.ciphertext)
        ).toString(Charsets.UTF_8)
        val decryptedAt = System.currentTimeMillis()
        val vault = json.decodeFromString<RemoteVaultDto>(plaintext).toDomain()
        val finishedAt = System.currentTimeMillis()
        Log.d(
            "TotpWebDavPerf",
            "remote decrypt total=${finishedAt - startedAt}ms decode=${decodedAt - startedAt}ms kdf=${keyAt - decodedAt}ms aes=${decryptedAt - keyAt}ms json=${finishedAt - decryptedAt}ms cached=${cached != null} accounts=${vault.accounts.size}"
        )
        return vault
    }

    private fun randomIv(): ByteArray = ByteArray(IV_SIZE_BYTES).also(secureRandom::nextBytes)

    private fun deriveKeyBytes(password: String, salt: ByteArray, iterations: Int): ByteArray {
        val spec = PBEKeySpec(password.toCharArray(), salt, iterations, KEY_SIZE_BITS)
        return try {
            secretKeyFactory.generateSecret(spec).encoded
        } finally {
            spec.clearPassword()
        }
    }

    private fun encryptAesGcm(key: SecretKeySpec, iv: ByteArray, plaintext: ByteArray): ByteArray {
        val cipher = Cipher.getInstance(AES_GCM)
        cipher.init(Cipher.ENCRYPT_MODE, key, GCMParameterSpec(TAG_SIZE_BITS, iv))
        return cipher.doFinal(plaintext)
    }

    private fun decryptAesGcm(key: SecretKeySpec, iv: ByteArray, ciphertext: ByteArray): ByteArray {
        val cipher = Cipher.getInstance(AES_GCM)
        cipher.init(Cipher.DECRYPT_MODE, key, GCMParameterSpec(TAG_SIZE_BITS, iv))
        return cipher.doFinal(ciphertext)
    }

    private fun base64(bytes: ByteArray): String = Base64.encodeToString(bytes, Base64.NO_WRAP)

    private fun unbase64(value: String): ByteArray = Base64.decode(value, Base64.NO_WRAP)

    private companion object {
        const val REMOTE_FORMAT_VERSION = 2
        const val REMOTE_KDF_ITERATIONS = 310_000
        const val KEY_SIZE_BITS = 256
        const val KEY_SIZE_BYTES = 32
        const val SALT_SIZE_BYTES = 16
        const val IV_SIZE_BYTES = 12
        const val TAG_SIZE_BITS = 128
        const val KDF_NAME = "PBKDF2"
        const val KDF_HASH = "SHA-256"
        const val CIPHER_NAME = "AES-GCM"
        const val AES = "AES"
        const val AES_GCM = "AES/GCM/NoPadding"

        val secretKeyFactory: SecretKeyFactory by lazy {
            SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256")
        }

        val json = Json {
            encodeDefaults = true
            ignoreUnknownKeys = true
        }
    }
}

private data class RemoteKeyCache(
    private val password: String,
    private val iterations: Int,
    val salt: ByteArray,
    val keyBytes: ByteArray,
    val vaultId: String
) {
    fun matches(candidatePassword: String, candidateIterations: Int): Boolean {
        return password == candidatePassword && iterations == candidateIterations
    }

    fun matches(candidatePassword: String, candidateIterations: Int, candidateSalt: ByteArray, candidateVaultId: String): Boolean {
        return matches(candidatePassword, candidateIterations) && vaultId == candidateVaultId && salt.contentEquals(candidateSalt)
    }
}

@Serializable
data class EncryptedRemoteVaultBlobDto(
    val formatVersion: Int,
    val vaultId: String,
    val kdf: RemoteKdfDto,
    val keyEncryption: RemoteAesGcmDto,
    val vaultEncryption: RemoteAesGcmDto
)

@Serializable
data class RemoteKdfDto(
    val name: String,
    val iterations: Int,
    val hash: String,
    val salt: String
)

@Serializable
data class RemoteAesGcmDto(
    val cipher: String,
    val iv: String,
    val ciphertext: String
)

@Serializable
data class WebDavRemoteEnvelopeDto(
    val schemaVersion: Int = 1,
    val revision: String,
    val updatedAt: String,
    val encryptedVault: EncryptedRemoteVaultBlobDto
)

@Serializable
private data class RemoteVaultDto(
    val version: Int = 1,
    val accounts: List<RemoteAccountDto>
) {
    fun toDomain(): LocalVault {
        val accounts = accounts.map { it.toDomain() }
        return LocalVault(
            schemaVersion = 1,
            accounts = accounts,
            updatedAt = accounts.maxOfOrNull { it.updatedAt } ?: System.currentTimeMillis()
        )
    }

    companion object {
        fun fromDomain(vault: LocalVault): RemoteVaultDto {
            return RemoteVaultDto(
                accounts = vault.accounts.map(RemoteAccountDto::fromDomain)
            )
        }
    }
}

@Serializable
private data class RemoteAccountDto(
    val id: String,
    val issuer: String,
    val accountName: String,
    val secret: String,
    val digits: Int,
    val period: Int,
    val algorithm: String,
    val tags: List<String> = emptyList(),
    val groupId: String? = null,
    val pinned: Boolean = false,
    val iconKey: String? = null,
    val updatedAt: String
) {
    fun toDomain(): TotpAccount {
        val updatedAtMillis = parseIsoMillis(updatedAt)
        return TotpAccount(
            id = id,
            issuer = issuer,
            accountName = accountName,
            secret = secret,
            algorithm = TotpAlgorithm.fromName(algorithm),
            digits = digits,
            period = period,
            group = groupId?.replaceFirstChar { it.uppercase() } ?: "Default",
            createdAt = updatedAtMillis,
            updatedAt = updatedAtMillis
        )
    }

    companion object {
        fun fromDomain(account: TotpAccount): RemoteAccountDto {
            return RemoteAccountDto(
                id = account.id,
                issuer = account.issuer,
                accountName = account.accountName,
                secret = account.secret,
                digits = account.digits,
                period = account.period,
                algorithm = account.algorithm.name,
                groupId = account.group.lowercase().ifBlank { "default" },
                iconKey = null,
                updatedAt = Instant.ofEpochMilli(account.updatedAt).toString()
            )
        }

        private fun parseIsoMillis(value: String): Long {
            return runCatching { Instant.parse(value).toEpochMilli() }
                .getOrDefault(System.currentTimeMillis())
        }
    }
}
