package com.totp.authenticator.ui.settings

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.ListItem
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp

@Composable
fun SettingsScreen(
    accountCount: Int,
    onClearVault: () -> Unit,
    onLock: () -> Unit,
    modifier: Modifier = Modifier
) {
    var showClearConfirmation by remember { mutableStateOf(false) }
    val items = settingsMenuItems()

    Surface(
        modifier = modifier.fillMaxSize(),
        color = MaterialTheme.colorScheme.background
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(vertical = 8.dp)
        ) {
            ListItem(
                headlineContent = { Text("Local vault unlocked") },
                supportingContent = { Text("$accountCount accounts") }
            )
            HorizontalDivider()
            items.forEach { item ->
                ListItem(
                    headlineContent = { Text(item.title) },
                    supportingContent = { Text(item.summary) },
                    trailingContent = {
                        if (!item.enabled) {
                            Text(
                                text = "Off",
                                style = MaterialTheme.typography.labelMedium,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                    },
                    modifier = Modifier.then(
                        when (item.title) {
                            "Clear local vault" -> Modifier.padding(top = 8.dp)
                            else -> Modifier
                        }
                    )
                )
                when (item.title) {
                    "Clear local vault" -> TextButton(
                        modifier = Modifier.padding(horizontal = 16.dp),
                        onClick = { showClearConfirmation = true }
                    ) {
                        Text("Clear")
                    }
                    "Lock vault" -> TextButton(
                        modifier = Modifier.padding(horizontal = 16.dp),
                        onClick = onLock
                    ) {
                        Text("Lock")
                    }
                }
                HorizontalDivider()
            }
        }
    }

    if (showClearConfirmation) {
        AlertDialog(
            onDismissRequest = { showClearConfirmation = false },
            title = { Text("Clear local vault?") },
            text = { Text("All local accounts will be removed from this device.") },
            confirmButton = {
                TextButton(onClick = onClearVault) {
                    Text("Clear")
                }
            },
            dismissButton = {
                TextButton(onClick = { showClearConfirmation = false }) {
                    Text("Cancel")
                }
            }
        )
    }
}
