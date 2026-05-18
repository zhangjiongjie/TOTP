package com.totp.authenticator.ui.settings

data class SettingsMenuItem(
    val title: String,
    val summary: String,
    val enabled: Boolean
)

fun settingsMenuItems(): List<SettingsMenuItem> {
    return listOf(
        SettingsMenuItem("Biometric unlock", "Available in a later version", enabled = false),
        SettingsMenuItem("WebDAV sync", "Available in a later version", enabled = false),
        SettingsMenuItem("Import / Export", "Available in a later version", enabled = false),
        SettingsMenuItem("Clear local vault", "Remove all local accounts from this device", enabled = true),
        SettingsMenuItem("Lock vault", "Return to the password screen", enabled = true)
    )
}
