package com.totp.authenticator.app

object BackupPasswordPromptPolicy {
    fun shouldPromptForImportPassword(error: Throwable): Boolean {
        return shouldPromptForImportPassword(error.message.orEmpty()) ||
            error.cause?.let(::shouldPromptForImportPassword) == true
    }

    fun shouldPromptForImportPassword(message: String): Boolean {
        return message.contains("备份密码与当前主密码不匹配") ||
            message.contains("导入加密备份失败") ||
            message.contains("解密 WebDAV 保管库失败") ||
            message.contains("AES-GCM", ignoreCase = true) ||
            message.contains("GCM", ignoreCase = true) ||
            message.contains("decrypt", ignoreCase = true) ||
            message.contains("解密") ||
            message.contains("Tag mismatch", ignoreCase = true) ||
            message.contains("mac check", ignoreCase = true) ||
            message.contains("unable to decrypt", ignoreCase = true)
    }
}
