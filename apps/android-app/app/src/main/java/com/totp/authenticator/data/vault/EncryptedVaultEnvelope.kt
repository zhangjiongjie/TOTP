package com.totp.authenticator.data.vault

data class EncryptedVaultEnvelope(
    val formatVersion: Int,
    val vaultId: String,
    val kdf: VaultKdf,
    val keyEncryption: AesGcmPayload,
    val vaultEncryption: AesGcmPayload,
    val updatedAt: Long
)

data class VaultKdf(
    val name: String,
    val iterations: Int,
    val hash: String,
    val salt: String
)

data class AesGcmPayload(
    val cipher: String,
    val iv: String,
    val ciphertext: String
)
