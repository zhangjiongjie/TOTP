package com.totp.authenticator.ui.home

import androidx.compose.foundation.layout.Arrangement
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
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.totp.authenticator.core.account.AccountSorter
import com.totp.authenticator.core.totp.TotpGenerator
import com.totp.authenticator.data.vault.LocalVault

@Composable
fun HomeScreen(
    vault: LocalVault,
    nowMillis: Long,
    onAdd: () -> Unit,
    onEdit: (String) -> Unit,
    onSettings: () -> Unit,
    onCopy: (String) -> Unit
) {
    val accounts = AccountSorter.sort(vault.accounts)

    Surface(
        modifier = Modifier.fillMaxSize(),
        color = MaterialTheme.colorScheme.background
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(20.dp)
        ) {
            Text(
                text = "TOTP Authenticator",
                style = MaterialTheme.typography.headlineSmall,
                color = MaterialTheme.colorScheme.onBackground
            )
            Text(
                text = "${accounts.size} accounts",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            Spacer(modifier = Modifier.height(16.dp))

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
                    verticalArrangement = Arrangement.spacedBy(12.dp)
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
                            onCopy = onCopy,
                            onEdit = onEdit
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(16.dp))
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                OutlinedButton(
                    modifier = Modifier.weight(1f),
                    onClick = {}
                ) {
                    Text("Home")
                }
                Button(
                    modifier = Modifier.weight(1f),
                    onClick = onAdd
                ) {
                    Text("Add")
                }
                OutlinedButton(
                    modifier = Modifier.weight(1f),
                    onClick = onSettings
                ) {
                    Text("Settings")
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
    Column(
        modifier = modifier,
        verticalArrangement = Arrangement.Center
    ) {
        Text(
            text = "No accounts yet",
            style = MaterialTheme.typography.titleLarge,
            color = MaterialTheme.colorScheme.onBackground
        )
        Spacer(modifier = Modifier.height(8.dp))
        Text(
            text = "Add your first otpauth URI or enter the fields manually.",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
        Spacer(modifier = Modifier.height(16.dp))
        Button(onClick = onAdd) {
            Text("Add account")
        }
    }
}
