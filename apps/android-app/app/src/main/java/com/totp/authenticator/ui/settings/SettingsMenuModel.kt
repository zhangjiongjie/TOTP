package com.totp.authenticator.ui.settings

data class SettingsMenuItem(
    val title: String,
    val summary: String,
    val enabled: Boolean
)

fun settingsMenuItems(): List<SettingsMenuItem> {
    return listOf(
        SettingsMenuItem("Biometric unlock", "使用系统凭据保护快速解锁凭据", enabled = true),
        SettingsMenuItem("WebDAV sync", "配置并同步远端保管库", enabled = true),
        SettingsMenuItem("Import / Export", "导入或导出加密备份", enabled = true)
    )
}
