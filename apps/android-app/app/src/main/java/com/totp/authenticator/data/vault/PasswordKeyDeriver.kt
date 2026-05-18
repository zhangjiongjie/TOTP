package com.totp.authenticator.data.vault

import java.security.SecureRandom
import javax.crypto.SecretKey
import javax.crypto.SecretKeyFactory
import javax.crypto.spec.PBEKeySpec
import javax.crypto.spec.SecretKeySpec

class PasswordKeyDeriver(
    private val secureRandom: SecureRandom = SecureRandom()
) {
    val iterations: Int = 210_000
    val keySizeBits: Int = 256
    val saltSizeBytes: Int = 16
    val kdfLabel: String = "PBKDF2WithHmacSHA256:$iterations:$keySizeBits"

    fun generateSalt(): ByteArray {
        return ByteArray(saltSizeBytes).also(secureRandom::nextBytes)
    }

    fun deriveKey(password: String, salt: ByteArray): SecretKey {
        val spec = PBEKeySpec(password.toCharArray(), salt, iterations, keySizeBits)
        return try {
            val bytes = SecretKeyFactory
                .getInstance("PBKDF2WithHmacSHA256")
                .generateSecret(spec)
                .encoded
            SecretKeySpec(bytes, "AES")
        } finally {
            spec.clearPassword()
        }
    }
}
