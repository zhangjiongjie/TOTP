package com.totp.authenticator.data.vault

data class EncryptedVaultEnvelope(
    val schemaVersion: Int,
    val kdf: String,
    val salt: String,
    val nonce: String,
    val wrappedKeyNonce: String,
    val wrappedVaultKey: String,
    val ciphertext: String,
    val updatedAt: Long
)
