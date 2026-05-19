package com.totp.authenticator.data.vault

import com.totp.authenticator.core.account.TotpAccount
import com.totp.authenticator.core.totp.TotpAlgorithm
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json

object VaultEnvelopeJson {
    private val json = Json {
        encodeDefaults = true
        ignoreUnknownKeys = true
    }

    fun encodeVault(vault: LocalVault): String {
        return json.encodeToString(VaultDto.fromDomain(vault))
    }

    fun decodeVault(value: String): LocalVault {
        return json.decodeFromString<VaultDto>(value).toDomain()
    }

    fun encodeEnvelope(envelope: EncryptedVaultEnvelope): String {
        return json.encodeToString(EnvelopeDto.fromDomain(envelope))
    }

    fun decodeEnvelope(value: String): EncryptedVaultEnvelope {
        return json.decodeFromString<EnvelopeDto>(value).toDomain()
    }
}

@Serializable
private data class VaultDto(
    val schemaVersion: Int,
    val accounts: List<TotpAccountDto>,
    val updatedAt: Long
) {
    fun toDomain(): LocalVault {
        return LocalVault(
            schemaVersion = schemaVersion,
            accounts = accounts.map { it.toDomain() },
            updatedAt = updatedAt
        )
    }

    companion object {
        fun fromDomain(vault: LocalVault): VaultDto {
            return VaultDto(
                schemaVersion = vault.schemaVersion,
                accounts = vault.accounts.map(TotpAccountDto::fromDomain),
                updatedAt = vault.updatedAt
            )
        }
    }
}

@Serializable
private data class TotpAccountDto(
    val id: String,
    val issuer: String,
    val accountName: String,
    val secret: String,
    val algorithm: String,
    val digits: Int,
    val period: Int,
    val group: String,
    val createdAt: Long,
    val updatedAt: Long
) {
    fun toDomain(): TotpAccount {
        return TotpAccount(
            id = id,
            issuer = issuer,
            accountName = accountName,
            secret = secret,
            algorithm = TotpAlgorithm.fromName(algorithm),
            digits = digits,
            period = period,
            group = group,
            createdAt = createdAt,
            updatedAt = updatedAt
        )
    }

    companion object {
        fun fromDomain(account: TotpAccount): TotpAccountDto {
            return TotpAccountDto(
                id = account.id,
                issuer = account.issuer,
                accountName = account.accountName,
                secret = account.secret,
                algorithm = account.algorithm.name,
                digits = account.digits,
                period = account.period,
                group = account.group,
                createdAt = account.createdAt,
                updatedAt = account.updatedAt
            )
        }
    }
}

@Serializable
private data class EnvelopeDto(
    val schemaVersion: Int,
    val kdf: String,
    val salt: String,
    val nonce: String,
    val wrappedKeyNonce: String,
    val wrappedVaultKey: String,
    val ciphertext: String,
    val updatedAt: Long
) {
    fun toDomain(): EncryptedVaultEnvelope {
        return EncryptedVaultEnvelope(
            schemaVersion = schemaVersion,
            kdf = kdf,
            salt = salt,
            nonce = nonce,
            wrappedKeyNonce = wrappedKeyNonce,
            wrappedVaultKey = wrappedVaultKey,
            ciphertext = ciphertext,
            updatedAt = updatedAt
        )
    }

    companion object {
        fun fromDomain(envelope: EncryptedVaultEnvelope): EnvelopeDto {
            return EnvelopeDto(
                schemaVersion = envelope.schemaVersion,
                kdf = envelope.kdf,
                salt = envelope.salt,
                nonce = envelope.nonce,
                wrappedKeyNonce = envelope.wrappedKeyNonce,
                wrappedVaultKey = envelope.wrappedVaultKey,
                ciphertext = envelope.ciphertext,
                updatedAt = envelope.updatedAt
            )
        }
    }
}
