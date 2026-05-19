package com.totp.authenticator.core.account

import com.totp.authenticator.core.totp.TotpAlgorithm

data class TotpAccount(
    val id: String,
    val issuer: String,
    val accountName: String,
    val secret: String,
    val algorithm: TotpAlgorithm = TotpAlgorithm.SHA1,
    val digits: Int = 6,
    val period: Int = 30,
    val group: String = "Default",
    val createdAt: Long,
    val updatedAt: Long
)
