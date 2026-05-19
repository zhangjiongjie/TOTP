package com.totp.authenticator.core.totp

import java.io.ByteArrayOutputStream
import java.util.Locale

class InvalidBase32Exception(message: String) : IllegalArgumentException(message)

object Base32 {
    private val alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"
    private val allowedPaddingCounts = mapOf(
        0 to 0,
        2 to 6,
        4 to 4,
        5 to 3,
        7 to 1
    )

    fun decode(secret: String): ByteArray {
        val normalized = secret.trim().uppercase(Locale.US)
        if (normalized.isEmpty()) {
            throw InvalidBase32Exception("Base32 secret is empty")
        }

        val paddingStart = normalized.indexOf('=')
        val data = if (paddingStart == -1) {
            normalized
        } else {
            validatePadding(normalized, paddingStart)
            normalized.substring(0, paddingStart)
        }

        validateDataLength(data.length)
        return decodeData(data)
    }

    private fun validatePadding(value: String, paddingStart: Int) {
        if (value.substring(paddingStart).any { it != '=' }) {
            throw InvalidBase32Exception("Base32 padding must be trailing")
        }
        if (value.length % 8 != 0) {
            throw InvalidBase32Exception("Padded Base32 length must be a multiple of 8")
        }

        val dataLength = paddingStart
        val paddingCount = value.length - dataLength
        val expectedPaddingCount = allowedPaddingCounts[dataLength % 8]
            ?: throw InvalidBase32Exception("Invalid Base32 data length")
        if (paddingCount != expectedPaddingCount) {
            throw InvalidBase32Exception("Invalid Base32 padding")
        }
    }

    private fun validateDataLength(dataLength: Int) {
        if (dataLength == 0 || dataLength % 8 !in allowedPaddingCounts.keys) {
            throw InvalidBase32Exception("Invalid Base32 data length")
        }
    }

    private fun decodeData(data: String): ByteArray {
        val output = ByteArrayOutputStream()
        var buffer = 0
        var bitsLeft = 0

        data.forEach { char ->
            val value = alphabet.indexOf(char)
            if (value == -1) {
                throw InvalidBase32Exception("Invalid Base32 character")
            }

            buffer = (buffer shl 5) or value
            bitsLeft += 5

            while (bitsLeft >= 8) {
                output.write((buffer shr (bitsLeft - 8)) and 0xff)
                bitsLeft -= 8
            }
        }

        if (bitsLeft > 0 && (buffer and ((1 shl bitsLeft) - 1)) != 0) {
            throw InvalidBase32Exception("Base32 trailing bits must be zero")
        }

        return output.toByteArray()
    }
}
