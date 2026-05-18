package com.totp.authenticator.data.vault

import javax.crypto.SecretKey

interface WrappingKeyProvider {
    fun getOrCreateWrappingKey(): SecretKey
}
