package com.totp.authenticator.ui.home

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.totp.authenticator.core.account.AccountSorter
import com.totp.authenticator.core.totp.TotpGenerator
import com.totp.authenticator.data.vault.LocalVault

@Composable
fun HomeScreen(
    vault: LocalVault,
    nowMillis: Long,
    syncStatusMessage: String,
    copyStatusMessage: String,
    errorMessage: String,
    lastSyncLabel: String,
    onAdd: () -> Unit,
    onEdit: (String) -> Unit,
    onCopy: (String, com.totp.authenticator.core.account.TotpAccount) -> Unit,
    modifier: Modifier = Modifier
) {
    val accounts = AccountSorter.sort(vault.accounts)

    Surface(
        modifier = modifier.fillMaxSize(),
        color = MaterialTheme.colorScheme.background
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(horizontal = 16.dp, vertical = 12.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp)
        ) {
            HomeMetaLine(
                accountCount = accounts.size,
                lastSyncLabel = lastSyncLabel
            )
            if (syncStatusMessage.isNotBlank() || copyStatusMessage.isNotBlank() || errorMessage.isNotBlank()) {
                HomeStatusCard(
                    syncStatusMessage = syncStatusMessage,
                    copyStatusMessage = copyStatusMessage,
                    errorMessage = errorMessage
                )
            }

            if (accounts.isEmpty()) {
                EmptyHomeState(
                    modifier = Modifier
                        .weight(1f)
                        .fillMaxWidth(),
                    onAdd = onAdd
                )
            } else {
                LazyColumn(
                    modifier = Modifier.weight(1f),
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    items(accounts, key = { it.id }) { account ->
                        val code = runCatching {
                            TotpGenerator.generate(
                                secret = account.secret,
                                timestampMillis = nowMillis,
                                period = account.period,
                                digits = account.digits,
                                algorithm = account.algorithm
                            )
                        }.getOrDefault("------")
                        AccountCard(
                            account = account,
                            code = code,
                            secondsRemaining = secondsRemaining(nowMillis, account.period),
                            onCopy = { copiedCode -> onCopy(copiedCode, account) },
                            onEdit = onEdit
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun EmptyHomeState(
    modifier: Modifier,
    onAdd: () -> Unit
) {
    Box(
        modifier = modifier,
        contentAlignment = Alignment.Center
    ) {
        Surface(
            modifier = Modifier.fillMaxWidth(),
            shape = MaterialTheme.shapes.extraLarge,
            color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.78f),
            tonalElevation = 1.dp
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 20.dp, vertical = 28.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                Text(
                    text = "还没有账号",
                    style = MaterialTheme.typography.titleMedium,
                    color = MaterialTheme.colorScheme.onSurface
                )
                Text(
                    text = "点击底部添加按钮录入账号。",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                Spacer(modifier = Modifier.height(4.dp))
                Button(onClick = onAdd) {
                    Text("添加账号")
                }
            }
        }
    }
}

@Composable
private fun HomeMetaLine(
    accountCount: Int,
    lastSyncLabel: String
) {
    Text(
        text = "$accountCount 个账号 · $lastSyncLabel",
        modifier = Modifier.fillMaxWidth(),
        style = MaterialTheme.typography.bodyMedium,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        maxLines = 1,
        overflow = TextOverflow.Ellipsis
    )
}

@Composable
private fun HomeStatusCard(
    syncStatusMessage: String,
    copyStatusMessage: String,
    errorMessage: String
) {
    Surface(
        modifier = Modifier.fillMaxWidth(),
        shape = MaterialTheme.shapes.extraLarge,
        color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.78f),
        tonalElevation = 1.dp
    ) {
        Column(
            modifier = Modifier.padding(horizontal = 16.dp, vertical = 14.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            StatusText(syncStatusMessage, MaterialTheme.colorScheme.onSurfaceVariant)
            StatusText(copyStatusMessage, Color(0xFF2D7A59))
            StatusText(errorMessage, MaterialTheme.colorScheme.error)
        }
    }
}

@Composable
private fun StatusText(message: String, color: Color) {
    if (message.isBlank()) {
        return
    }
    Text(
        text = message,
        style = MaterialTheme.typography.bodySmall,
        color = color
    )
}
