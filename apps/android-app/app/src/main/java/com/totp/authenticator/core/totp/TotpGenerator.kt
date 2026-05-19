package com.totp.authenticator.core.totp

import javax.crypto.Mac
import javax.crypto.spec.SecretKeySpec
import kotlin.math.pow

object TotpGenerator {
    fun generate(
        secret: String,
        timestampMillis: Long,
        period: Int,
        digits: Int,
        algorithm: TotpAlgorithm
    ): String {
        require(period > 0) { "period must be positive" }
        require(digits in 6..8) { "digits must be in 6..8" }

        val counter = timestampMillis / 1000L / period
        val hmac = hmac(
            key = Base32.decode(secret),
            counterBytes = counter.toByteArray(),
            algorithm = algorithm
        )

        val offset = hmac.last().toInt() and 0x0f
        val binary = ((hmac[offset].toInt() and 0x7f) shl 24) or
            ((hmac[offset + 1].toInt() and 0xff) shl 16) or
            ((hmac[offset + 2].toInt() and 0xff) shl 8) or
            (hmac[offset + 3].toInt() and 0xff)
        val modulo = 10.0.pow(digits).toInt()

        return (binary % modulo).toString().padStart(digits, '0')
    }

    private fun hmac(key: ByteArray, counterBytes: ByteArray, algorithm: TotpAlgorithm): ByteArray {
        val mac = Mac.getInstance(algorithm.hmacName)
        mac.init(SecretKeySpec(key, algorithm.hmacName))
        return mac.doFinal(counterBytes)
    }

    private fun Long.toByteArray(): ByteArray = ByteArray(8) { index ->
        (this shr (8 * (7 - index))).toByte()
    }
}
