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
    val formatVersion: Int,
    val vaultId: String,
    val kdf: VaultKdfDto,
    val keyEncryption: AesGcmPayloadDto,
    val vaultEncryption: AesGcmPayloadDto,
    val updatedAt: Long
) {
    fun toDomain(): EncryptedVaultEnvelope {
        return EncryptedVaultEnvelope(
            formatVersion = formatVersion,
            vaultId = vaultId,
            kdf = kdf.toDomain(),
            keyEncryption = keyEncryption.toDomain(),
            vaultEncryption = vaultEncryption.toDomain(),
            updatedAt = updatedAt
        )
    }

    companion object {
        fun fromDomain(envelope: EncryptedVaultEnvelope): EnvelopeDto {
            return EnvelopeDto(
                formatVersion = envelope.formatVersion,
                vaultId = envelope.vaultId,
                kdf = VaultKdfDto.fromDomain(envelope.kdf),
                keyEncryption = AesGcmPayloadDto.fromDomain(envelope.keyEncryption),
                vaultEncryption = AesGcmPayloadDto.fromDomain(envelope.vaultEncryption),
                updatedAt = envelope.updatedAt
            )
        }
    }
}

@Serializable
private data class VaultKdfDto(
    val name: String,
    val iterations: Int,
    val hash: String,
    val salt: String
) {
    fun toDomain(): VaultKdf {
        return VaultKdf(
            name = name,
            iterations = iterations,
            hash = hash,
            salt = salt
        )
    }

    companion object {
        fun fromDomain(kdf: VaultKdf): VaultKdfDto {
            return VaultKdfDto(
                name = kdf.name,
                iterations = kdf.iterations,
                hash = kdf.hash,
                salt = kdf.salt
            )
        }
    }
}

@Serializable
private data class AesGcmPayloadDto(
    val cipher: String,
    val iv: String,
    val ciphertext: String
) {
    fun toDomain(): AesGcmPayload {
        return AesGcmPayload(
            cipher = cipher,
            iv = iv,
            ciphertext = ciphertext
        )
    }

    companion object {
        fun fromDomain(payload: AesGcmPayload): AesGcmPayloadDto {
            return AesGcmPayloadDto(
                cipher = payload.cipher,
                iv = payload.iv,
                ciphertext = payload.ciphertext
            )
        }
    }
}
