package com.totp.authenticator.ui.home

fun formatTotpCode(code: String): String {
    return if (code.length == 6) {
        "${code.substring(0, 3)} ${code.substring(3)}"
    } else {
        code
    }
}

fun secondsRemaining(nowMillis: Long, period: Int): Int {
    val elapsed = (nowMillis / 1000L) % period
    return period - elapsed.toInt()
}
