package com.totp.authenticator.data.webdav

import android.util.Base64
import android.util.Log
import com.totp.authenticator.core.account.TotpAccount
import com.totp.authenticator.core.totp.TotpAlgorithm
import com.totp.authenticator.data.vault.LocalVault
import java.security.MessageDigest
import java.security.SecureRandom
import java.time.Instant
import javax.crypto.Cipher
import javax.crypto.SecretKeyFactory
import javax.crypto.spec.GCMParameterSpec
import javax.crypto.spec.PBEKeySpec
import javax.crypto.spec.SecretKeySpec
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json

class RemoteVaultCrypto(
    private val persistentKeyCacheStore: RemoteVaultKeyCacheStore? = null,
    private val secureRandom: SecureRandom = SecureRandom()
) {
    private var cachedKey: RemoteKeyCache? = null

    fun clearCache() {
        cachedKey = null
    }

    fun clearPersistentCache() {
        cachedKey = null
        persistentKeyCacheStore?.clear()
    }

    fun encrypt(vault: LocalVault, password: String, cacheProfileKey: String? = null): EncryptedRemoteVaultBlobDto {
        val startedAt = System.currentTimeMillis()
        val previousCache = cachedKey
        val cached = if (previousCache != null && previousCache.matches(password, REMOTE_KDF_ITERATIONS)) previousCache else null
        val persisted = if (cached == null && cacheProfileKey != null) {
            persistentKeyCacheStore?.load(cacheProfileKey, REMOTE_KDF_ITERATIONS)
        } else {
            null
        }
        val salt = cached?.salt ?: persisted?.salt?.let(::unbase64) ?: ByteArray(SALT_SIZE_BYTES).also(secureRandom::nextBytes)
        val iv = ByteArray(IV_SIZE_BYTES).also(secureRandom::nextBytes)
        val randomAt = System.currentTimeMillis()
        val keyBytes = cached?.keyBytes ?: persisted?.keyBytes ?: deriveKeyBytes(password, salt, REMOTE_KDF_ITERATIONS)
        cachedKey = RemoteKeyCache(password, REMOTE_KDF_ITERATIONS, salt.copyOf(), keyBytes.copyOf())
        val keyAt = System.currentTimeMillis()
        val key = SecretKeySpec(keyBytes, "AES")
        val cipher = Cipher.getInstance(AES_GCM)
        cipher.init(Cipher.ENCRYPT_MODE, key, GCMParameterSpec(TAG_SIZE_BITS, iv))
        val encryptedWithTag = cipher.doFinal(json.encodeToString(RemoteVaultDto.fromDomain(vault)).toByteArray(Charsets.UTF_8))
        val encryptedAt = System.currentTimeMillis()
        val saltBase64 = base64(salt)
        val passwordVerifier = base64(keyBytes)
        if (cacheProfileKey != null) {
            persistentKeyCacheStore?.save(cacheProfileKey, saltBase64, REMOTE_KDF_ITERATIONS, passwordVerifier, keyBytes)
        }
        Log.d(
            "TotpWebDavPerf",
            "remote encrypt total=${encryptedAt - startedAt}ms random=${randomAt - startedAt}ms kdf=${keyAt - randomAt}ms aes=${encryptedAt - keyAt}ms cached=${cached != null || persisted != null} persisted=${persisted != null} accounts=${vault.accounts.size}"
        )
        return EncryptedRemoteVaultBlobDto(
            formatVersion = 1,
            kdf = RemoteKdfDto(name = "PBKDF2", iterations = REMOTE_KDF_ITERATIONS, hash = "SHA-256"),
            cipher = "AES-GCM",
            salt = saltBase64,
            iv = base64(iv),
            ciphertext = base64(encryptedWithTag),
            passwordVerifier = passwordVerifier
        )
    }

    fun decrypt(blob: EncryptedRemoteVaultBlobDto, password: String, cacheProfileKey: String? = null): LocalVault {
        val startedAt = System.currentTimeMillis()
        require(blob.formatVersion == 1) { "Unsupported WebDAV vault format" }
        require(blob.kdf.name == "PBKDF2" && blob.kdf.hash == "SHA-256") { "Unsupported WebDAV KDF" }
        require(blob.cipher == "AES-GCM") { "Unsupported WebDAV cipher" }
        val salt = unbase64(blob.salt)
        val expectedVerifier = unbase64(blob.passwordVerifier)
        val decodedAt = System.currentTimeMillis()
        val previousCache = cachedKey
        val cached = if (previousCache != null && previousCache.matches(password, blob.kdf.iterations, salt)) previousCache else null
        val persisted = if (cached == null && cacheProfileKey != null) {
            persistentKeyCacheStore?.load(cacheProfileKey, blob.kdf.iterations, blob.salt, blob.passwordVerifier)
        } else {
            null
        }
        val keyBytes = cached?.keyBytes ?: persisted?.keyBytes ?: deriveKeyBytes(password, salt, blob.kdf.iterations)
        cachedKey = RemoteKeyCache(password, blob.kdf.iterations, salt.copyOf(), keyBytes.copyOf())
        val keyAt = System.currentTimeMillis()
        require(MessageDigest.isEqual(expectedVerifier, keyBytes)) { "Remote vault password does not match" }
        if (cacheProfileKey != null) {
            persistentKeyCacheStore?.save(cacheProfileKey, blob.salt, blob.kdf.iterations, blob.passwordVerifier, keyBytes)
        }

        val key = SecretKeySpec(keyBytes, "AES")
        val cipher = Cipher.getInstance(AES_GCM)
        cipher.init(Cipher.DECRYPT_MODE, key, GCMParameterSpec(TAG_SIZE_BITS, unbase64(blob.iv)))
        val plaintext = cipher.doFinal(unbase64(blob.ciphertext)).toString(Charsets.UTF_8)
        val decryptedAt = System.currentTimeMillis()
        val vault = json.decodeFromString<RemoteVaultDto>(plaintext).toDomain()
        val finishedAt = System.currentTimeMillis()
        Log.d(
            "TotpWebDavPerf",
            "remote decrypt total=${finishedAt - startedAt}ms decode=${decodedAt - startedAt}ms kdf=${keyAt - decodedAt}ms aes=${decryptedAt - keyAt}ms json=${finishedAt - decryptedAt}ms cached=${cached != null || persisted != null} persisted=${persisted != null} accounts=${vault.accounts.size}"
        )
        return vault
    }

    private fun deriveKeyBytes(password: String, salt: ByteArray, iterations: Int): ByteArray {
        val spec = PBEKeySpec(password.toCharArray(), salt, iterations, KEY_SIZE_BITS)
        return try {
            secretKeyFactory.generateSecret(spec).encoded
        } finally {
            spec.clearPassword()
        }
    }

    private fun base64(bytes: ByteArray): String = Base64.encodeToString(bytes, Base64.NO_WRAP)

    private fun unbase64(value: String): ByteArray = Base64.decode(value, Base64.NO_WRAP)

    private companion object {
        const val REMOTE_KDF_ITERATIONS = 310_000
        const val KEY_SIZE_BITS = 256
        const val SALT_SIZE_BYTES = 16
        const val IV_SIZE_BYTES = 12
        const val TAG_SIZE_BITS = 128
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
    val keyBytes: ByteArray
) {
    fun matches(candidatePassword: String, candidateIterations: Int): Boolean {
        return password == candidatePassword && iterations == candidateIterations
    }

    fun matches(candidatePassword: String, candidateIterations: Int, candidateSalt: ByteArray): Boolean {
        return matches(candidatePassword, candidateIterations) && MessageDigest.isEqual(salt, candidateSalt)
    }
}

@Serializable
data class EncryptedRemoteVaultBlobDto(
    val formatVersion: Int,
    val kdf: RemoteKdfDto,
    val cipher: String,
    val salt: String,
    val iv: String,
    val ciphertext: String,
    val passwordVerifier: String
)

@Serializable
data class RemoteKdfDto(
    val name: String,
    val iterations: Int,
    val hash: String
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
