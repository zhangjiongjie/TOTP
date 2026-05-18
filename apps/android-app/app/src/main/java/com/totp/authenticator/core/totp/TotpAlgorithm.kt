package com.totp.authenticator.core.totp

import java.util.Locale

enum class TotpAlgorithm(val hmacName: String) {
    SHA1("HmacSHA1"),
    SHA256("HmacSHA256"),
    SHA512("HmacSHA512");

    companion object {
        fun fromName(name: String): TotpAlgorithm {
            val normalized = name.trim().uppercase(Locale.US)
            return entries.firstOrNull {
                it.name == normalized || it.hmacName.uppercase(Locale.US) == normalized
            } ?: throw IllegalArgumentException("Unsupported TOTP algorithm: $name")
        }
    }
}
