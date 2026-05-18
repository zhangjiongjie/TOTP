package com.totp.authenticator.core.totp

import com.totp.authenticator.fixtures.TestFixtures
import org.junit.Assert.assertArrayEquals
import org.junit.Test

class Base32Test {
    @Test
    fun decodesValidBase32Secret() {
        assertArrayEquals(
            byteArrayOf(72, 101, 108, 108, 111, 33),
            Base32.decode("JBSWY3DPEE======")
        )
    }

    @Test
    fun rejectsInvalidInputsFromSharedFixtures() {
        TestFixtures.base32InvalidInputs.forEach { input ->
            try {
                Base32.decode(input)
                throw AssertionError("Expected InvalidBase32Exception for $input")
            } catch (_: InvalidBase32Exception) {
                // Expected.
            }
        }
    }
}
