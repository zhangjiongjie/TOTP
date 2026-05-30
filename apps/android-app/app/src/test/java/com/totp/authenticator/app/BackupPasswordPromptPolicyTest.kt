package com.totp.authenticator.app

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class BackupPasswordPromptPolicyTest {
    @Test
    fun promptsWhenEncryptedBackupCannotBeDecryptedWithCurrentPassword() {
        assertTrue(
            BackupPasswordPromptPolicy.shouldPromptForImportPassword(
                IllegalArgumentException("解密 WebDAV 保管库失败：AES-GCM tag mismatch")
            )
        )
        assertTrue(
            BackupPasswordPromptPolicy.shouldPromptForImportPassword(
                IllegalArgumentException("导入加密备份失败：备份密码与当前主密码不匹配。")
            )
        )
    }

    @Test
    fun doesNotPromptForPickerOrFormatFailures() {
        assertFalse(BackupPasswordPromptPolicy.shouldPromptForImportPassword("未选择备份文件。"))
        assertFalse(BackupPasswordPromptPolicy.shouldPromptForImportPassword("明文备份内容无效。"))
    }
}
