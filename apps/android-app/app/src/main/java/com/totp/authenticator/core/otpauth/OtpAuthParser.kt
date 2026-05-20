package com.totp.authenticator.core.otpauth

import com.totp.authenticator.core.totp.Base32
import com.totp.authenticator.core.totp.InvalidBase32Exception
import com.totp.authenticator.core.totp.TotpAlgorithm
import java.net.URI
import java.net.URISyntaxException
import java.nio.ByteBuffer
import java.nio.charset.CharacterCodingException
import java.nio.charset.CodingErrorAction
import java.nio.charset.StandardCharsets

class InvalidOtpAuthUriException(message: String, cause: Throwable? = null) :
    IllegalArgumentException(message, cause)

data class ParsedOtpAuth(
    val issuer: String,
    val accountName: String,
    val secret: String,
    val algorithm: TotpAlgorithm = TotpAlgorithm.SHA1,
    val digits: Int = 6,
    val period: Int = 30
)

object OtpAuthParser {
    fun parse(value: String): ParsedOtpAuth {
        val uri = parseUri(value)
        if (!uri.scheme.equals("otpauth", ignoreCase = true) || !uri.host.equals("totp", ignoreCase = true)) {
            throw InvalidOtpAuthUriException("Only otpauth://totp URIs are supported")
        }

        val rawLabel = uri.rawPath?.removePrefix("/")?.takeIf { it.isNotEmpty() }
            ?: throw InvalidOtpAuthUriException("TOTP account label is required")
        val labelColon = rawLabel.indexOf(':')
        val labelIssuer = if (labelColon == -1) "" else strictDecode(rawLabel.substring(0, labelColon))
        val accountName = strictDecode(if (labelColon == -1) rawLabel else rawLabel.substring(labelColon + 1))

        val params = parseQuery(uri.rawQuery.orEmpty())
        val issuer = params["issuer"] ?: labelIssuer
        val secret = params["secret"] ?: throw InvalidOtpAuthUriException("TOTP secret is required")
        validateSecret(secret)

        return ParsedOtpAuth(
            issuer = issuer,
            accountName = accountName,
            secret = secret,
            algorithm = parseAlgorithm(params["algorithm"]),
            digits = parsePositiveDecimal(params["digits"], default = 6, name = "digits"),
            period = parsePositiveDecimal(params["period"], default = 30, name = "period")
        )
    }

    private fun parseUri(value: String): URI {
        return try {
            URI(encodeRawWhitespace(value))
        } catch (exception: URISyntaxException) {
            throw InvalidOtpAuthUriException("Invalid otpauth URI", exception)
        }
    }

    private fun encodeRawWhitespace(value: String): String {
        return buildString(value.length) {
            value.forEach { char ->
                when (char) {
                    ' ' -> append("%20")
                    '\t' -> append("%09")
                    '\n' -> append("%0A")
                    '\r' -> append("%0D")
                    else -> append(char)
                }
            }
        }
    }

    private fun parseQuery(rawQuery: String): Map<String, String> {
        if (rawQuery.isEmpty()) {
            return emptyMap()
        }

        return rawQuery.split('&')
            .filter { it.isNotEmpty() }
            .associate { pair ->
                val equalsIndex = pair.indexOf('=')
                val rawKey = if (equalsIndex == -1) pair else pair.substring(0, equalsIndex)
                val rawValue = if (equalsIndex == -1) "" else pair.substring(equalsIndex + 1)
                strictDecode(rawKey, plusAsSpace = true) to strictDecode(rawValue, plusAsSpace = true)
            }
    }

    private fun parseAlgorithm(value: String?): TotpAlgorithm {
        if (value.isNullOrBlank()) {
            return TotpAlgorithm.SHA1
        }

        return try {
            TotpAlgorithm.fromName(value)
        } catch (exception: IllegalArgumentException) {
            throw InvalidOtpAuthUriException("Invalid TOTP algorithm", exception)
        }
    }

    private fun parsePositiveDecimal(value: String?, default: Int, name: String): Int {
        if (value == null) {
            return default
        }
        if (value.isEmpty() || value.any { it !in '0'..'9' }) {
            throw InvalidOtpAuthUriException("$name must be a positive decimal integer")
        }

        val parsed = try {
            value.toInt()
        } catch (exception: NumberFormatException) {
            throw InvalidOtpAuthUriException("$name must be a positive decimal integer", exception)
        }
        if (parsed <= 0) {
            throw InvalidOtpAuthUriException("$name must be a positive decimal integer")
        }
        return parsed
    }

    private fun validateSecret(secret: String) {
        try {
            Base32.decode(secret)
        } catch (exception: InvalidBase32Exception) {
            throw InvalidOtpAuthUriException("Invalid TOTP secret", exception)
        }
    }

    private fun strictDecode(value: String, plusAsSpace: Boolean = false): String {
        val bytes = ArrayList<Byte>(value.length)
        var index = 0
        while (index < value.length) {
            when (val char = value[index]) {
                '%' -> {
                    if (index + 2 >= value.length) {
                        throw InvalidOtpAuthUriException("Malformed percent encoding")
                    }
                    val hex = value.substring(index + 1, index + 3)
                    val byte = hex.toIntOrNull(16)
                        ?: throw InvalidOtpAuthUriException("Malformed percent encoding")
                    bytes.add(byte.toByte())
                    index += 3
                }
                '+' -> {
                    bytes.add(if (plusAsSpace) ' '.code.toByte() else char.code.toByte())
                    index += 1
                }
                else -> {
                    char.toString().toByteArray(StandardCharsets.UTF_8).forEach { bytes.add(it) }
                    index += 1
                }
            }
        }

        val decoder = StandardCharsets.UTF_8.newDecoder()
            .onMalformedInput(CodingErrorAction.REPORT)
            .onUnmappableCharacter(CodingErrorAction.REPORT)
        return try {
            decoder.decode(ByteBuffer.wrap(bytes.toByteArray())).toString()
        } catch (exception: CharacterCodingException) {
            throw InvalidOtpAuthUriException("Malformed UTF-8 percent encoding", exception)
        }
    }
}
